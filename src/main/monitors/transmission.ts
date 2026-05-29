import http from 'http'
import { DownloadItem, DownloadState, MonitorStatus } from '../../shared/types'
import { logger } from '../logger'

// Transmission RPC uses X-Transmission-Session-Id header to prevent CSRF
let sessionId: string | null = null

interface TransmissionTorrent {
  id: number
  name: string
  totalSize: number
  downloadedEver: number
  rateDownload: number
  eta: number
  status: number
  downloadDir: string
  percentDone: number
}

// Transmission torrent status codes
const TR_STATUS_STOPPED = 0
const TR_STATUS_CHECK = 2
const TR_STATUS_DOWNLOAD_WAIT = 3
const TR_STATUS_DOWNLOAD = 4

async function rpcRequest(
  url: string,
  method: string,
  args: Record<string, unknown> = {},
  credentials?: { username: string; password: string }
): Promise<unknown> {
  const body = JSON.stringify({ method, arguments: args })
  const parsed = new URL(url)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Transmission-Session-Id': sessionId || '0'
  }

  if (credentials?.username) {
    const b64 = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
    headers['Authorization'] = `Basic ${b64}`
  }

  const result = await new Promise<{ status: number; body: string; headers: Record<string, string> }>(
    (resolve, reject) => {
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || 9091,
          path: parsed.pathname,
          method: 'POST',
          headers
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
      req.write(body)
      req.end()
    }
  )

  // Transmission returns 409 with new session ID when old one is invalid
  if (result.status === 409) {
    sessionId = result.headers['x-transmission-session-id'] || null
    if (sessionId) {
      // Retry with new session ID
      return rpcRequest(url, method, args, credentials)
    }
    throw new Error('Could not obtain Transmission session ID')
  }

  if (result.status !== 200) {
    throw new Error(`HTTP ${result.status}: ${result.body}`)
  }

  const json = JSON.parse(result.body)
  if (json.result !== 'success') {
    throw new Error(`Transmission RPC error: ${json.result}`)
  }
  return json.arguments
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }
  return ''
}

export async function checkTransmission(
  baseUrl = 'http://localhost:9091',
  username = '',
  password = ''
): Promise<MonitorStatus> {
  const id = 'transmission'
  const label = 'Transmission'
  const rpcUrl = `${baseUrl}/transmission/rpc`
  const credentials = username ? { username, password } : undefined

  try {
    const args = await rpcRequest(
      rpcUrl,
      'torrent-get',
      {
        fields: [
          'id',
          'name',
          'totalSize',
          'downloadedEver',
          'rateDownload',
          'eta',
          'status',
          'downloadDir',
          'percentDone'
        ]
      },
      credentials
    )

    const torrents = ((args as { torrents: TransmissionTorrent[] }).torrents || [])
    const downloads: DownloadItem[] = []
    let hasActive = false
    let hasPaused = false

    for (const t of torrents) {
      if (t.status === TR_STATUS_DOWNLOAD || t.status === TR_STATUS_DOWNLOAD_WAIT || t.status === TR_STATUS_CHECK) {
        hasActive = true
        downloads.push({
          id: `tr_${t.id}`,
          name: t.name,
          totalBytes: t.totalSize,
          downloadedBytes: t.downloadedEver,
          speedBps: t.rateDownload,
          eta: t.eta < 0 ? -1 : t.eta,
          state: 'downloading',
          source: 'transmission',
          path: t.downloadDir
        })
      } else if (t.status === TR_STATUS_STOPPED && t.percentDone < 1) {
        hasPaused = true
        downloads.push({
          id: `tr_${t.id}`,
          name: t.name,
          totalBytes: t.totalSize,
          downloadedBytes: t.downloadedEver,
          speedBps: 0,
          eta: -1,
          state: 'paused',
          source: 'transmission',
          path: t.downloadDir
        })
      }
      // Skip TR_STATUS_SEED and TR_STATUS_SEED_WAIT (seeding only)
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
      totalSpeedBps: downloads.reduce((s, d) => s + d.speedBps, 0),
      lastUpdated: Date.now()
    }
  } catch (e: unknown) {
    const message = getErrorMessage(e)
    const isOffline =
      message.includes('ECONNREFUSED') ||
      message.includes('EHOSTUNREACH') ||
      message.includes('timeout')

    if (!isOffline && message.trim()) logger.warn('Transmission monitor error:', message)

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
