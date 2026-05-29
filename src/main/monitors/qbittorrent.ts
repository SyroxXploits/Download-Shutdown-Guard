import http from 'http'
import { DownloadItem, DownloadState, MonitorStatus } from '../../shared/types'
import { logger } from '../logger'

interface QbTorrent {
  hash: string
  name: string
  size: number
  downloaded: number
  dlspeed: number
  eta: number
  // State: downloading, stalledDL, pausedDL, queuedDL, uploading, pausedUP, stalledUP, etc.
  state: string
  progress: number
  save_path: string
}

// qBittorrent uses cookie-based auth. We keep the session cookie between calls.
let sessionCookie: string | null = null

async function httpRequest(
  url: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const reqOptions: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        ...options.headers
      }
    }

    const req = http.request(reqOptions, res => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => {
        const headers: Record<string, string> = {}
        Object.entries(res.headers).forEach(([k, v]) => {
          headers[k] = Array.isArray(v) ? v.join('; ') : (v ?? '')
        })
        resolve({ status: res.statusCode ?? 0, body: data, headers })
      })
    })
    req.on('error', reject)
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timeout'))
    })
    if (options.body) req.write(options.body)
    req.end()
  })
}

async function login(baseUrl: string, username: string, password: string): Promise<boolean> {
  // qBittorrent 4.1+ API
  try {
    const res = await httpRequest(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    })
    if (res.status === 200 && res.body === 'Ok.') {
      const setCookie = res.headers['set-cookie']
      if (setCookie) {
        sessionCookie = setCookie.split(';')[0]
      }
      return true
    }
    return false
  } catch {
    return false
  }
}

async function getTorrents(baseUrl: string): Promise<QbTorrent[]> {
  const res = await httpRequest(`${baseUrl}/api/v2/torrents/info`)
  if (res.status === 403) {
    // Session expired
    sessionCookie = null
    throw new Error('Unauthorized — session expired')
  }
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  return JSON.parse(res.body) as QbTorrent[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }
  return ''
}

// qBittorrent state strings that mean "actively getting a download" (not
// seeding, not paused). Includes metadata fetch (magnet links), disk
// allocation, and the v4 "forced"/queued variants.
const DOWNLOADING_STATES = new Set([
  'downloading',
  'stalledDL',
  'checkingDL',
  'queuedDL',
  'forcedDL',
  'metaDL',
  'forcedMetaDL',
  'allocating',
  'checkingResumeData'
])

// qBittorrent 5.x renamed "paused" → "stopped". Accept both so paused downloads
// are still surfaced regardless of the user's qBittorrent version.
const PAUSED_STATES = new Set(['pausedDL', 'stoppedDL'])

function isActiveDownload(t: QbTorrent): boolean {
  return DOWNLOADING_STATES.has(t.state)
}

function isPausedDownload(t: QbTorrent): boolean {
  return PAUSED_STATES.has(t.state)
}

function isSeeding(t: QbTorrent): boolean {
  return (
    t.state === 'uploading' ||
    t.state === 'stalledUP' ||
    t.state === 'forcedUP' ||
    t.state === 'queuedUP'
  )
}

export async function checkQbittorrent(
  baseUrl = 'http://localhost:8080',
  username = '',
  password = '',
  ignoreSeeders = true
): Promise<MonitorStatus> {
  const id = 'qbittorrent'
  const label = 'qBittorrent'

  const tryFetch = async (): Promise<QbTorrent[]> => {
    try {
      return await getTorrents(baseUrl)
    } catch (e: unknown) {
      const err = e as Error
      if (err.message?.includes('Unauthorized') || err.message?.includes('403')) {
        // Try to login with credentials
        if (username || password) {
          const ok = await login(baseUrl, username, password)
          if (ok) return getTorrents(baseUrl)
        }
        // Try blank credentials (qBit default with no password set)
        const ok = await login(baseUrl, username || 'admin', password || '')
        if (ok) return getTorrents(baseUrl)
      }
      throw err
    }
  }

  try {
    const torrents = await tryFetch()
    const active = torrents.filter(isActiveDownload)
    const seeding = torrents.filter(isSeeding)

    const downloads: DownloadItem[] = active.map(t => ({
      id: `qbt_${t.hash}`,
      name: t.name,
      totalBytes: t.size,
      downloadedBytes: Math.round(t.size * t.progress),
      speedBps: t.dlspeed,
      eta: t.eta > 8640000 ? -1 : t.eta, // qBit uses 8640000 for "unknown"
      state: 'downloading',
      source: 'qbittorrent',
      path: t.save_path
    }))

    // Add seeding items only if we're not ignoring them
    if (!ignoreSeeders) {
      seeding.forEach(t =>
        downloads.push({
          id: `qbt_seed_${t.hash}`,
          name: t.name,
          totalBytes: t.size,
          downloadedBytes: t.size,
          speedBps: 0,
          eta: 0,
          state: 'seeding',
          source: 'qbittorrent'
        })
      )
    }

    const paused = torrents.filter(isPausedDownload)
    paused.forEach(t =>
      downloads.push({
        id: `qbt_${t.hash}`,
        name: t.name,
        totalBytes: t.size,
        downloadedBytes: Math.round(t.size * t.progress),
        speedBps: 0,
        eta: -1,
        state: 'paused',
        source: 'qbittorrent',
        path: t.save_path
      })
    )

    let state: DownloadState = 'idle'
    if (active.length > 0) state = 'downloading'
    else if (paused.length > 0) state = 'paused'

    return {
      id,
      label,
      enabled: true,
      available: true,
      state,
      downloads,
      totalSpeedBps: active.reduce((s, t) => s + t.dlspeed, 0),
      lastUpdated: Date.now()
    }
  } catch (e: unknown) {
    const message = getErrorMessage(e)
    const isOffline =
      message.includes('ECONNREFUSED') ||
      message.includes('EHOSTUNREACH') ||
      message.includes('timeout')

    if (!isOffline && message.trim()) {
      logger.warn('qBittorrent monitor error:', message)
    }

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
