import { app } from 'electron'
import fetch from 'node-fetch'
import { UpdateCheckResult } from '../shared/types'

const REPOSITORY = 'SyroxXploits/Download-Shutdown-Guard'
const DEFAULT_RELEASE_URL = `https://github.com/${REPOSITORY}/releases/latest`

interface GitHubRelease {
  tag_name?: string
  name?: string
  html_url?: string
  published_at?: string
}

interface CachedUpdateResult {
  at: number
  result: UpdateCheckResult
}

function normalizeVersion(input: string): string {
  return input.trim().replace(/^v/i, '').trim()
}

function parseSemver(input: string): [number, number, number] | null {
  const match = normalizeVersion(input).match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareVersions(a: string, b: string): number {
  const left = parseSemver(a)
  const right = parseSemver(b)

  if (!left || !right) return 0
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1
    if (left[i] < right[i]) return -1
  }
  return 0
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error ?? 'Unknown error')
}

const UPDATE_CHECK_CACHE_MS = 10 * 60 * 1000
let cachedUpdate: CachedUpdateResult | null = null

function parseReleaseTagFromUrl(releaseUrl: string): string | null {
  const match = releaseUrl.match(/\/releases\/tag\/([^/?#]+)/i) ?? releaseUrl.match(/\/tag\/([^/?#]+)/i)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

async function fetchLatestReleaseFromWeb(currentVersion: string): Promise<UpdateCheckResult> {
  const response = await fetch(DEFAULT_RELEASE_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': `Download Shutdown Guard/${currentVersion}`
    }
  })

  if (!response.ok) {
    throw new Error(`GitHub release page returned HTTP ${response.status}`)
  }

  const releaseUrl = response.url || DEFAULT_RELEASE_URL
  const latestVersion = normalizeVersion(parseReleaseTagFromUrl(releaseUrl) ?? currentVersion)
  const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0

  return {
    currentVersion,
    latestVersion,
    releaseName: latestVersion,
    releaseUrl,
    isUpdateAvailable
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()

  if (cachedUpdate && Date.now() - cachedUpdate.at < UPDATE_CHECK_CACHE_MS) {
    return cachedUpdate.result
  }

  try {
    const result = await fetchLatestReleaseFromWeb(currentVersion)
    cachedUpdate = { at: Date.now(), result }
    return result
  } catch (webError) {
    try {
      const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Download Shutdown Guard/${currentVersion}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      })

      if (!response.ok) {
        throw new Error(`GitHub API returned HTTP ${response.status}`)
      }

      const release = (await response.json()) as GitHubRelease
      const latestVersion = normalizeVersion(release.tag_name ?? release.name ?? currentVersion)
      const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0

      const result: UpdateCheckResult = {
        currentVersion,
        latestVersion,
        releaseName: release.name ?? release.tag_name ?? latestVersion,
        releaseUrl: release.html_url ?? DEFAULT_RELEASE_URL,
        publishedAt: release.published_at,
        isUpdateAvailable
      }
      cachedUpdate = { at: Date.now(), result }
      return result
    } catch (apiError) {
      const error = webError instanceof Error ? webError : apiError
      return {
        currentVersion,
        latestVersion: currentVersion,
        releaseName: '',
        releaseUrl: DEFAULT_RELEASE_URL,
        isUpdateAvailable: false,
        error: getErrorMessage(error)
      }
    }
  }
}
