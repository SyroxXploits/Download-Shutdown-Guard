import { app } from 'electron'
import path from 'path'
import fs from 'fs'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private logPath: string
  private stream: fs.WriteStream | null = null
  private maxSizeBytes = 5 * 1024 * 1024 // 5 MB rotate

  constructor() {
    const userDataPath = app.getPath('userData')
    this.logPath = path.join(userDataPath, 'logs', 'app.log')
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true })
    this.openStream()
  }

  private openStream(): void {
    this.stream = fs.createWriteStream(this.logPath, { flags: 'a' })
  }

  private rotate(): void {
    try {
      const stats = fs.statSync(this.logPath)
      if (stats.size > this.maxSizeBytes) {
        this.stream?.end()
        const rotated = this.logPath.replace('.log', `.${Date.now()}.log`)
        fs.renameSync(this.logPath, rotated)
        this.openStream()
        // Keep only last 3 log files
        this.pruneOldLogs()
      }
    } catch {
      // Ignore rotation errors
    }
  }

  private pruneOldLogs(): void {
    try {
      const dir = path.dirname(this.logPath)
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.log') && f !== 'app.log')
        .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time)
      files.slice(3).forEach(f => fs.unlinkSync(path.join(dir, f.name)))
    } catch {
      // Ignore
    }
  }

  private write(level: LogLevel, ...args: unknown[]): void {
    this.rotate()
    const ts = new Date().toISOString()
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    const line = `[${ts}] [${level.toUpperCase()}] ${msg}\n`
    this.stream?.write(line)
    // Also log to console in dev
    if (!app.isPackaged) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      fn(line.trim())
    }
  }

  debug = (...args: unknown[]): void => this.write('debug', ...args)
  info = (...args: unknown[]): void => this.write('info', ...args)
  warn = (...args: unknown[]): void => this.write('warn', ...args)
  error = (...args: unknown[]): void => this.write('error', ...args)

  getLogPath(): string {
    return this.logPath
  }
}

export const logger = new Logger()
