import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { AppStatus } from '../shared/types'
import { logger } from './logger'

let tray: Tray | null = null

type Rgba = { r: number; g: number; b: number; a?: number }

const STATUS_COLORS: Record<'green' | 'yellow' | 'red' | 'gray', Rgba> = {
  green: { r: 111, g: 214, b: 128 },
  yellow: { r: 255, g: 196, b: 72 },
  red: { r: 255, g: 102, b: 102 },
  gray: { r: 165, g: 171, b: 182 }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function setPixel(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  color: Rgba
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const offset = (y * width + x) * 4
  pixels[offset] = clampByte(color.r)
  pixels[offset + 1] = clampByte(color.g)
  pixels[offset + 2] = clampByte(color.b)
  pixels[offset + 3] = clampByte(color.a ?? 255)
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  color: Rgba
): void {
  for (let yy = y; yy < y + rectHeight; yy += 1) {
    for (let xx = x; xx < x + rectWidth; xx += 1) {
      setPixel(pixels, width, height, xx, yy, color)
    }
  }
}

function fillCircle(
  pixels: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  color: Rgba
): void {
  const radiusSq = radius * radius
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= radiusSq) {
        setPixel(pixels, width, height, x, y, color)
      }
    }
  }
}

function fillTriangle(
  pixels: Uint8Array,
  width: number,
  height: number,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  color: Rgba
): void {
  const minX = Math.floor(Math.min(p1.x, p2.x, p3.x))
  const maxX = Math.ceil(Math.max(p1.x, p2.x, p3.x))
  const minY = Math.floor(Math.min(p1.y, p2.y, p3.y))
  const maxY = Math.ceil(Math.max(p1.y, p2.y, p3.y))

  const area = (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)
  if (area === 0) return

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w1 = ((p2.x - p1.x) * (y - p1.y) - (p2.y - p1.y) * (x - p1.x)) / area
      const w2 = ((p3.x - p2.x) * (y - p2.y) - (p3.y - p2.y) * (x - p2.x)) / area
      const w3 = ((p1.x - p3.x) * (y - p3.y) - (p1.y - p3.y) * (x - p3.x)) / area
      const hasSameSign =
        (w1 >= 0 && w2 >= 0 && w3 >= 0) ||
        (w1 <= 0 && w2 <= 0 && w3 <= 0)

      if (hasSameSign) {
        setPixel(pixels, width, height, x, y, color)
      }
    }
  }
}

let crcTable: number[] | null = null

function getCrcTable(): number[] {
  if (crcTable) return crcTable
  crcTable = []
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crcTable[n] = c >>> 0
  }
  return crcTable
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  const table = getCrcTable()

  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createPng(width: number, height: number, pixels: Uint8Array): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1)
    raw[rowOffset] = 0
    const pixelOffset = y * width * 4
    raw.set(pixels.subarray(pixelOffset, pixelOffset + width * 4), rowOffset + 1)
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })

  const chunk = (type: string, data: Buffer): Buffer => {
    const typeBuf = Buffer.from(type, 'ascii')
    const lengthBuf = Buffer.alloc(4)
    lengthBuf.writeUInt32BE(data.length, 0)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
    return Buffer.concat([lengthBuf, typeBuf, data, crcBuf])
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function createTrayBitmap(color: Rgba): Buffer {
  const size = 64
  const pixels = new Uint8Array(size * size * 4)
  const center = 32

  fillCircle(pixels, size, size, center, center, 29, { r: 0, g: 0, b: 0, a: 0 })
  fillCircle(pixels, size, size, center, center, 27, { r: 28, g: 31, b: 38, a: 255 })
  fillCircle(pixels, size, size, center, center, 30, color)
  fillCircle(pixels, size, size, center, center, 24, { r: 30, g: 33, b: 40, a: 255 })

  // A simple arrow keeps the icon readable at tray size.
  fillRect(pixels, size, size, 29, 18, 6, 16, { r: 250, g: 250, b: 250, a: 255 })
  fillTriangle(
    pixels,
    size,
    size,
    { x: 24, y: 31 },
    { x: 40, y: 31 },
    { x: 32, y: 45 },
    { r: 250, g: 250, b: 250, a: 255 }
  )
  fillRect(pixels, size, size, 24, 45, 16, 4, { r: 250, g: 250, b: 250, a: 255 })

  return createPng(size, size, Buffer.from(pixels))
}

function createTrayIcon(color: 'green' | 'yellow' | 'red' | 'gray'): Electron.NativeImage {
  const png = createTrayBitmap(STATUS_COLORS[color] ?? STATUS_COLORS.gray)
  return nativeImage.createFromBuffer(png)
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = createTrayIcon('gray')
  tray = new Tray(icon)
  tray.setToolTip('Download Shutdown Guard - Monitoring')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Cancel Shutdown',
      click: () => {
        mainWindow.webContents.send('action:cancel-shutdown')
      }
    },
    {
      label: 'Snooze 10 min',
      click: () => {
        mainWindow.webContents.send('action:snooze', 10)
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.exit(0)
      }
    }
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  logger.info('Tray created')
  return tray
}

export function updateTrayStatus(status: AppStatus): void {
  if (!tray) return

  const { allComplete, activeDownloadCount, shutdown } = status

  let tooltip: string
  let iconColor: 'green' | 'yellow' | 'red' | 'gray'

  if (shutdown.phase === 'countdown') {
    iconColor = 'red'
    tooltip = `Shutting down in ${shutdown.countdownRemaining}s...`
  } else if (shutdown.phase === 'shutting_down') {
    iconColor = 'red'
    tooltip = 'Executing shutdown...'
  } else if (activeDownloadCount > 0) {
    iconColor = 'yellow'
    tooltip = `Downloading - ${activeDownloadCount} active`
  } else if (shutdown.phase === 'cooldown') {
    iconColor = 'green'
    tooltip = `All done - shutdown in ${shutdown.cooldownRemaining}s`
  } else if (allComplete) {
    iconColor = 'green'
    tooltip = 'All downloads complete'
  } else {
    iconColor = 'gray'
    tooltip = 'Monitoring downloads...'
  }

  try {
    tray.setImage(createTrayIcon(iconColor))
    tray.setToolTip(`Download Shutdown Guard\n${tooltip}`)
  } catch (error) {
    logger.warn('Failed to update tray icon:', error)
  }
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
