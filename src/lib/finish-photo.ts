/**
 * A supplier photo of a decor is usually a small swatch with white bars.
 * We keep the colour, then build one large sheet so the drawing reads as a
 * single board: grain runs the long way, and the swatch is not stamped in a grid.
 */

export type RgbaImage = { width: number; height: number; data: Uint8ClampedArray }

export type DecorSheet = {
  url: string
  acrossMm: number
  alongMm: number
}

const SHEET_MM = 3200
const MAX_STORED_CHARS = 180_000

function isPaperPixel(data: Uint8ClampedArray, i: number): boolean {
  const a = data[i + 3]
  if (a < 16) return true
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  return r >= 247 && g >= 247 && b >= 247 && Math.max(r, g, b) - Math.min(r, g, b) <= 10
}

function fraction(width: number, height: number, data: Uint8ClampedArray, fixed: 'row' | 'col', index: number): number {
  let paper = 0
  const n = fixed === 'row' ? width : height
  for (let i = 0; i < n; i++) {
    const px = fixed === 'row' ? i : index
    const py = fixed === 'row' ? index : i
    if (isPaperPixel(data, (py * width + px) * 4)) paper++
  }
  return paper / n
}

/** Drop the white bars suppliers put around a swatch. A white decor is left as it is. */
export function cropPaperMargins(image: RgbaImage): RgbaImage {
  const { width, height, data } = image
  if (width < 8 || height < 8) return image

  let centerPaper = 0
  let centerN = 0
  const y0 = Math.floor(height * 0.3)
  const y1 = Math.ceil(height * 0.7)
  const x0 = Math.floor(width * 0.3)
  const x1 = Math.ceil(width * 0.7)
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      centerN++
      if (isPaperPixel(data, (y * width + x) * 4)) centerPaper++
    }
  }
  if (centerN > 0 && centerPaper / centerN > 0.72) return image

  const maxCutY = Math.floor(height * 0.46)
  const maxCutX = Math.floor(width * 0.46)
  let top = 0
  while (top < maxCutY && fraction(width, height, data, 'row', top) > 0.9) top++
  let bottom = 0
  while (bottom < maxCutY && fraction(width, height, data, 'row', height - 1 - bottom) > 0.9) bottom++
  let left = 0
  while (left < maxCutX && fraction(width, height, data, 'col', left) > 0.9) left++
  let right = 0
  while (right < maxCutX && fraction(width, height, data, 'col', width - 1 - right) > 0.9) right++

  if (top + bottom < 4 && left + right < 4) return image
  const w = width - left - right
  const h = height - top - bottom
  if (w < 24 || h < 24) return image

  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const src = ((y + top) * width + left) * 4
    out.set(data.subarray(src, src + w * 4), y * w * 4)
  }
  return { width: w, height: h, data: out }
}

function lumaAt(image: RgbaImage, x: number, y: number): number {
  const i = (y * image.width + x) * 4
  const data = image.data
  return data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722
}

/**
 * Vertical grain changes from column to column and stays similar down a column.
 * That shows up as a stronger sideways gradient than an up-down one.
 */
function grainRunsVertically(image: RgbaImage): boolean {
  const { width, height } = image
  const step = Math.max(1, Math.floor(Math.max(width, height) / 160))
  let across = 0
  let along = 0
  let n = 0
  for (let y = 0; y < height - step; y += step) {
    for (let x = 0; x < width - step; x += step) {
      const here = lumaAt(image, x, y)
      across += Math.abs(lumaAt(image, x + step, y) - here)
      along += Math.abs(lumaAt(image, x, y + step) - here)
      n++
    }
  }
  if (n === 0) return true
  return across >= along
}

/** Wood grain runs top to bottom in the stored swatch, so a side and a door share one direction. */
export function orientGrainVertical(image: RgbaImage): RgbaImage {
  if (grainRunsVertically(image)) return image
  const { width, height, data } = image
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4
      const nx = height - 1 - y
      const ny = x
      const di = (ny * height + nx) * 4
      out[di] = data[si]
      out[di + 1] = data[si + 1]
      out[di + 2] = data[si + 2]
      out[di + 3] = data[si + 3]
    }
  }
  return { width: height, height: width, data: out }
}

export function averageHex(image: RgbaImage): string {
  const { data } = image
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  const step = Math.max(4, Math.floor(data.length / 4 / 4000) * 4)
  for (let i = 0; i < data.length; i += step) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    n++
  }
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  if (n === 0) return '#c4a574'
  return `#${byte(r / n)}${byte(g / n)}${byte(b / n)}`
}

function mod1(n: number): number {
  return ((n % 1) + 1) % 1
}

/**
 * Paint a full sheet. The swatch is placed on a brick grid, mirrored, and
 * drifted, then the joins are cross-faded so a door does not show a stamp.
 */
export function synthesizeSheetPixels(source: RgbaImage): RgbaImage {
  const sw = source.width
  const sh = source.height
  const sd = source.data
  const pxPerMm = 0.2
  const outW = Math.round(SHEET_MM * pxPerMm)
  const outH = Math.round(SHEET_MM * pxPerMm)

  let tileAcross = Math.min(2000, Math.max(700, 1100 * (sw / sh)))
  let tileAlong = Math.max(1700, tileAcross * (sh / sw))
  if (tileAcross * (sh / sw) > tileAlong) tileAlong = tileAcross * (sh / sw)

  const feather = 0.2
  const out = new Uint8ClampedArray(outW * outH * 4)

  const sample = (lu: number, lv: number, col: number, row: number): [number, number, number] => {
    let u = mod1(lu)
    let v = mod1(lv)
    if ((col & 1) === 1) u = 1 - u
    u = mod1(u + mod1(row * 0.29 + col * 0.13) * 0.45)
    v = mod1(v + mod1(col * 0.41 + row * 0.17))
    const x = Math.min(sw - 1, Math.max(0, Math.round(u * (sw - 1))))
    const y = Math.min(sh - 1, Math.max(0, Math.round(v * (sh - 1))))
    const i = (y * sw + x) * 4
    return [sd[i], sd[i + 1], sd[i + 2]]
  }

  for (let py = 0; py < outH; py++) {
    const yMm = (py / (outH - 1)) * SHEET_MM
    for (let px = 0; px < outW; px++) {
      const xMm = (px / (outW - 1)) * SHEET_MM
      const x = xMm + Math.sin(yMm / 340) * tileAcross * 0.045
      const y = yMm + Math.sin(xMm / 390) * tileAlong * 0.04
      const col = Math.floor(x / tileAcross)
      const yBrick = y + ((col & 1) ? tileAlong * 0.47 : 0)
      const row = Math.floor(yBrick / tileAlong)
      const lu = (x - col * tileAcross) / tileAcross
      const lv = (yBrick - row * tileAlong) / tileAlong
      let [r, g, b] = sample(lu, lv, col, row)
      const blend = (t: number, col2: number, row2: number, lu2: number, lv2: number) => {
        const s = t * t * (3 - 2 * t)
        const other = sample(lu2, lv2, col2, row2)
        r = r * s + other[0] * (1 - s)
        g = g * s + other[1] * (1 - s)
        b = b * s + other[2] * (1 - s)
      }
      if (lu < feather) blend(lu / feather, col - 1, row, lu, lv)
      else if (lu > 1 - feather) blend((1 - lu) / feather, col + 1, row, lu, lv)
      if (lv < feather) blend(lv / feather, col, row - 1, lu, lv)
      else if (lv > 1 - feather) blend((1 - lv) / feather, col, row + 1, lu, lv)
      const i = (py * outW + px) * 4
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
      out[i + 3] = 255
    }
  }
  return { width: outW, height: outH, data: out }
}

function canvasFromImage(image: RgbaImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const pixels = new Uint8ClampedArray(image.data)
  ctx.putImageData(new ImageData(pixels, image.width, image.height), 0, 0)
  return canvas
}

function jpegUnder(image: RgbaImage, maxChars: number): string {
  let w = image.width
  let h = image.height
  const longest = Math.max(w, h)
  if (longest > 720) {
    const scale = 720 / longest
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
  }
  let quality = 0.82
  let url = ''
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) break
    ctx.drawImage(canvasFromImage(image), 0, 0, w, h)
    url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= maxChars) return url
    quality -= 0.12
    w = Math.max(80, Math.round(w * 0.8))
    h = Math.max(80, Math.round(h * 0.8))
  }
  return url
}

function readImageData(source: CanvasImageSource, width: number, height: number): RgbaImage {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { width, height, data: new Uint8ClampedArray(width * height * 4) }
  ctx.drawImage(source, 0, 0, width, height)
  const read = ctx.getImageData(0, 0, width, height)
  return { width, height, data: read.data }
}

/** Crop the white frame, turn the grain upright, and keep a small JPEG for the account. */
export async function prepareDecorPhoto(file: Blob): Promise<{ image: string; color: string }> {
  const bitmap = await createImageBitmap(file)
  const raw = readImageData(bitmap, bitmap.width, bitmap.height)
  bitmap.close()
  const cropped = orientGrainVertical(cropPaperMargins(raw))
  return { image: jpegUnder(cropped, MAX_STORED_CHARS), color: averageHex(cropped) }
}

const sheetCache = new Map<string, Promise<DecorSheet>>()

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decor'))
    img.src = url
  })
}

/** One sheet bitmap for this swatch. Built once and reused for every cabinet. */
export function decorSheetFor(imageUrl: string): Promise<DecorSheet> {
  const cached = sheetCache.get(imageUrl)
  if (cached) return cached
  const pending = (async () => {
    const img = await loadImage(imageUrl)
    const source = orientGrainVertical(readImageData(img, img.naturalWidth, img.naturalHeight))
    const sheet = synthesizeSheetPixels(source)
    const canvas = canvasFromImage(sheet)
    return { url: canvas.toDataURL('image/jpeg', 0.86), acrossMm: SHEET_MM, alongMm: SHEET_MM }
  })()
  sheetCache.set(imageUrl, pending)
  return pending
}
