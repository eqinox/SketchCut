import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public', 'kronospan')
const DATA = path.join(ROOT, 'src', 'data', 'kronospan-color.ts')
mkdirSync(OUT, { recursive: true })
mkdirSync(path.dirname(DATA), { recursive: true })

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: 'https://kronospan.com/bg_BG/decors/by_collection/kronodesign/color/',
  Origin: 'https://kronospan.com',
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function download(urlPath, file) {
  if (existsSync(file)) return
  const url = urlPath.startsWith('http') ? urlPath : `https://kronospan.com${urlPath}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 200) throw new Error(`tiny ${url}`)
  writeFileSync(file, buf)
}

function combinationsFrom(html) {
  const start = html.indexOf('id="menu2"')
  if (start < 0) return []
  const end = html.indexOf('id="menu4"', start)
  const block = html.slice(start, end < 0 ? start + 30000 : end)
  const re =
    /deco-comb-comp[\s\S]*?url\((\/public\/thumbs\/[^)]+)\)[\s\S]*?href="[^"]*\/([A-Za-z0-9]+)\/"[^>]*>\s*([A-Za-z0-9]+)\s+([\s\S]*?)<\/a>/g
  const out = []
  const seen = new Set()
  for (const match of block.matchAll(re)) {
    const code = match[3].trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push({
      code,
      name: match[4].replace(/\s+/g, ' ').trim(),
      imageUrl: match[1],
    })
  }
  return out
}

const listRes = await fetch('https://kronospan.com/bg_BG/ajax/decors/get_decors', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ collection_id: 6 }),
})
const listText = await listRes.text()
if (!listRes.ok || listText.startsWith('<')) {
  throw new Error(`list ${listRes.status} ${listRes.headers.get('content-type')} ${listText.slice(0, 180)}`)
}
const items = JSON.parse(listText)
if (!Array.isArray(items) || items.length < 10) throw new Error(`unexpected list ${items?.length}`)

const colors = []
for (const item of items) {
  const code = String(item.decor_number || '').trim()
  const name = String(item.decor_title || '').trim()
  if (!code || !name) continue
  const file = path.join(OUT, `${code}.jpg`)
  await download(item.decor_image, file)
  const pageUrl = `https://kronospan.com/bg_BG${item.decor_url}`
  const page = await fetch(pageUrl, { headers: { 'User-Agent': 'SketchCut' } })
  const html = page.ok ? await page.text() : ''
  const combinations = combinationsFrom(html)
  for (const combo of combinations) {
    try {
      await download(combo.imageUrl, path.join(OUT, `${combo.code}.jpg`))
    } catch (error) {
      console.warn('combo image', combo.code, error.message)
    }
    await sleep(40)
  }
  colors.push({
    code,
    name,
    image: `/kronospan/${code}.jpg`,
    combinations: combinations.map((combo) => ({
      code: combo.code,
      name: combo.name,
      image: `/kronospan/${combo.code}.jpg`,
    })),
  })
  console.log(`${colors.length}/${items.length} ${code} ${name} +${combinations.length}`)
  await sleep(80)
}

const sampleScript = path.join(ROOT, 'scripts', 'sample-krono-color.ps1')
writeFileSync(
  sampleScript,
  `
Add-Type -AssemblyName System.Drawing
Get-ChildItem -LiteralPath '${OUT.replace(/'/g, "''")}' -Filter *.jpg | ForEach-Object {
  $bmp = [System.Drawing.Bitmap]::FromFile($_.FullName)
  try {
    $stepX = [Math]::Max(1, [int][Math]::Floor($bmp.Width / 12))
    $stepY = [Math]::Max(1, [int][Math]::Floor($bmp.Height / 12))
    $sr = 0; $sg = 0; $sb = 0; $n = 0
    for ($y = 0; $y -lt $bmp.Height; $y += $stepY) {
      for ($x = 0; $x -lt $bmp.Width; $x += $stepX) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.A -lt 16) { continue }
        if ($c.R -ge 247 -and $c.G -ge 247 -and $c.B -ge 247) { continue }
        $sr += $c.R; $sg += $c.G; $sb += $c.B; $n++
      }
    }
    if ($n -eq 0) {
      $c = $bmp.GetPixel([int]($bmp.Width / 2), [int]($bmp.Height / 2))
      $sr = $c.R; $sg = $c.G; $sb = $c.B; $n = 1
    }
    $hex = '{0:X2}{1:X2}{2:X2}' -f [int]($sr / $n), [int]($sg / $n), [int]($sb / $n)
    Write-Output ($_.BaseName + ' #' + $hex)
  } finally {
    $bmp.Dispose()
  }
}
`,
)
const sampled = execFileSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', sampleScript],
  { encoding: 'utf8' },
)
const hexByCode = new Map()
for (const line of sampled.split(/\r?\n/)) {
  const match = /^(\S+)\s+#([0-9A-Fa-f]{6})$/.exec(line.trim())
  if (match) hexByCode.set(match[1], `#${match[2].toLowerCase()}`)
}

function withColor(swatch) {
  return { ...swatch, color: hexByCode.get(swatch.code) ?? '#c4a574' }
}

const catalog = colors.map((color) => ({
  ...withColor(color),
  combinations: color.combinations.map(withColor),
}))

const missing = catalog.flatMap((color) =>
  [color, ...color.combinations].filter((swatch) => !hexByCode.has(swatch.code)).map((swatch) => swatch.code),
)
if (missing.length) console.warn('no hex', [...new Set(missing)].join(', '))

writeFileSync(
  DATA,
  `/** Kronospan Color swatches. Pictures live in public/kronospan. */\nexport const KRONOSPAN_COLORS = ${JSON.stringify(catalog, null, 2)}\n`,
)
console.log(`wrote ${catalog.length} colors`)
