import http from 'http'
import { DownloadItem, DownloadState, MonitorStatus } from '../../shared/types'
import { logger } from '../logger'

// µTorrent / BitTorrent Web API. Unlike qBittorrent it returns torrents as
// positional arrays and requires a CSRF token (fetched from /gui/token.html)
// plus a GUID cookie that must be echoed back on every subsequent request.
// Auth is HTTP Basic.
//
// Torrent array layout (the indices we care about):
//   [0] hash  [1] status bitfield  [2] name  [3] size (bytes)
//   [4] progress (per-mille, 0–1000)  [5] downloaded  [8] upspeed
//   [9] downspeed (B/s)  [10] eta (s, -1 unknown)  [26] save path (newer builds)
const I_HASH = 0
const I_STATUS = 1
const I_NAME = 2
const I_SIZE = 3
const I_PROGRESS = 4
const I_DOWNLOADED = 5
const I_DOWNSPEED = 9
const I_ETA = 10
const I_PATH = 26

// Status bitfield flags.
const ST_STARTED = 1
const ST_CHECKING = 2
const ST_PAUSED = 32
const ST_QUEUED = 64

type UtTorrent = unknown[]

let token: string | null = null
let guidCookie: string | null = null

function authHeader(username: string, password: string): Record<string, string> {
  if (!username && !password) return {}
  const b64 = Buffer.from(`${username}:${password}`).toString('base64')
  return { Authorization: `Basic ${b64}` }
}

function httpRequest(
  url: string,
  headers: Record<string, string>
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          ...(guidCookie ? { Cookie: guidCookie } : {}),
          ...headers
        }
      },
      res => {
        let data = ''
        res.on('data', chunk => (data += chunk))
        res.on('end', () => {
          const h: Record<string, string> = {}
          Object.entries(res.headers).forEach(([k, v]) => {
            h[k] = Array.isArray(v) ? v.join('; ') : (v ?? '')
          })
          resolve({ status: res.statusCode ?? 0, body: data, headers: h })
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(5000, () => req.destroy(new Error('timeout')))
    req.end()
  })
}

async function fetchToken(baseUrl: string, auth: Record<string, string>): Promise<string> {
  const res = await httpRequest(`${baseUrl}/gui/token.html`, auth)
  if (res.status === 401) throw new Error('Unauthorized — check username/password')
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const setCookie = res.headers['set-cookie']
  if (setCookie) guidCookie = setCookie.split(';')[0]
  const match = res.body.match(/<div[^>]*id=['"]token['"][^>]*>([^<]+)<\/div>/i)
  if (!match) throw new Error('Could not parse Web UI token')
  return match[1].trim()
}

async function listTorrents(
  baseUrl: string,
  auth: Record<string, string>
): Promise<UtTorrent[]> {
  const res = await httpRequest(
    `${baseUrl}/gui/?list=1&token=${encodeURIComponent(token ?? '')}`,
    auth
  )
  if (res.status === 400 || res.status === 401) {
    // Stale/invalid token — force a re-fetch on the next attempt.
    token = null
    throw new Error('Unauthorized — token expired')
  }
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const json = JSON.parse(res.body) as { torrents?: UtTorrent[] }
  return json.torrents ?? []
}

function num(t: UtTorrent, i: number): number {
  const v = t[i]
  return typeof v === 'number' ? v : Number(v) || 0
}

function str(t: UtTorrent, i: number): string {
  const v = t[i]
  return typeof v === 'string' ? v : ''
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export async function checkUtorrent(
  baseUrl = 'http://localhost:8080',
  username = '',
  password = '',
  ignoreSeeders = true
): Promise<MonitorStatus> {
  const id = 'utorrent'
  const label = 'µTorrent'
  const normalizedBase = baseUrl.replace(/\/+$/, '').replace(/\/gui$/i, '')
  const auth = authHeader(username, password)

  const tryFetch = async (): Promise<UtTorrent[]> => {
    if (!token) token = await fetchToken(normalizedBase, auth)
    try {
      return await listTorrents(normalizedBase, auth)
    } catch (e) {
      // One retry after refreshing the token (handles expiry mid-session).
      if (getErrorMessage(e).includes('Unauthorized')) {
        token = await fetchToken(normalizedBase, auth)
        return listTorrents(normalizedBase, auth)
      }
      throw e
    }
  }

  try {
    const torrents = await tryFetch()
    const downloads: DownloadItem[] = []
    let hasActive = false
    let hasPaused = false

    for (const t of torrents) {
      const status = num(t, I_STATUS)
      const progress = num(t, I_PROGRESS) // 0–1000
      const isComplete = progress >= 1000
      const isPaused = (status & ST_PAUSED) !== 0
      const isChecking = (status & ST_CHECKING) !== 0
      const isQueued = (status & ST_QUEUED) !== 0
      const isStarted = (status & ST_STARTED) !== 0

      if (isComplete) {
        // Seeding / finished — only surface when the user wants seeders counted.
        if (!ignoreSeeders && (isStarted || isQueued)) {
          downloads.push({
            id: `ut_seed_${str(t, I_HASH)}`,
            name: str(t, I_NAME),
            totalBytes: num(t, I_SIZE),
            downloadedBytes: num(t, I_SIZE),
            speedBps: 0,
            eta: 0,
            state: 'seeding',
            source: 'utorrent'
          })
        }
        continue
      }

      const active = !isPaused && (isStarted || isChecking || isQueued)
      if (!active && !isPaused) continue

      const state: DownloadState = isPaused ? 'paused' : 'downloading'
      if (isPaused) hasPaused = true
      else hasActive = true

      const eta = num(t, I_ETA)
      downloads.push({
        id: `ut_${str(t, I_HASH)}`,
        name: str(t, I_NAME),
        totalBytes: num(t, I_SIZE),
        downloadedBytes: num(t, I_DOWNLOADED),
        speedBps: num(t, I_DOWNSPEED),
        eta: eta < 0 ? -1 : eta,
        state,
        source: 'utorrent',
        path: str(t, I_PATH) || undefined
      })
    }

    let state: DownloadState = 'idle'
    if (hasActive) state = 'downloading'
    else if (hasPaused) state = 'paused'

    return {
      id,
      label,
      enabled: true,
      available: true,
      state,
      downloads,
      totalSpeedBps: downloads
        .filter(d => d.state === 'downloading')
        .reduce((s, d) => s + d.speedBps, 0),
      lastUpdated: Date.now()
    }
  } catch (e) {
    const message = getErrorMessage(e)
    const isOffline =
      message.includes('ECONNREFUSED') ||
      message.includes('EHOSTUNREACH') ||
      message.includes('timeout')

    if (!isOffline && message.trim()) logger.warn('µTorrent monitor error:', message)

    return {
      id,
      label,
      enabled: true,
      available: false,
      state: 'idle',
      downloads: [],
      totalSpeedBps: 0,
      lastUpdated: Date.now(),
      error: isOffline ? 'Not running' : message || 'Unknown error'
    }
  }
}
