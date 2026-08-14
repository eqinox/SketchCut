import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

async function createIcon(size, filename) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#0f172a"/>
      <rect x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.7}" rx="8" fill="none" stroke="#3b82f6" stroke-width="${size * 0.04}"/>
      <rect x="${size * 0.22}" y="${size * 0.22}" width="${size * 0.28}" height="${size * 0.35}" fill="#3b82f6" opacity="0.8"/>
      <rect x="${size * 0.55}" y="${size * 0.22}" width="${size * 0.23}" height="${size * 0.22}" fill="#10b981" opacity="0.8"/>
      <rect x="${size * 0.22}" y="${size * 0.62}" width="${size * 0.56}" height="${size * 0.16}" fill="#f59e0b" opacity="0.8"/>
    </svg>
  `

  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  writeFileSync(join(publicDir, filename), png)
}

await createIcon(192, 'pwa-192x192.png')
await createIcon(512, 'pwa-512x512.png')
await createIcon(180, 'apple-touch-icon.png')
console.log('Icons generated')
