import { writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'src', 'data', 'gstroy-kronospan.json')
const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: 'https://www.gstroy.bg/products/mebelni-materiali/mebelni-ploskosti/lpdch/',
}
const base =
  'https://www.gstroy.bg/products/mebelni-materiali/mebelni-ploskosti/lpdch/?brands=669&characteristic_125=18%20%D0%BC%D0%BC'

const rows = []
for (let page = 1; page <= 30; page++) {
  const url = page === 1 ? base : `${base}&page=${page}`
  const res = await fetch(url, { headers })
  const text = await res.text()
  let html = text
  let last = page === 1 ? false : false
  if (text.trim().startsWith('{')) {
    const json = JSON.parse(text)
    html = json.html || ''
    last = Boolean(json.isLastChunk)
  }
  const re =
    /<p class="title">([^<]+)<\/p>[\s\S]*?<p class="box-price euro-price">\s*([0-9]+)\.<span>([0-9]+)/g
  let match
  let count = 0
  while ((match = re.exec(html))) {
    count++
    rows.push({
      title: match[1].replace(/\s+/g, ' ').trim(),
      price: Number(`${match[2]}.${match[3]}`),
    })
  }
  console.log(`page ${page}: ${count} last=${last}`)
  if (page > 1 && (last || count === 0)) break
}

const seen = new Set()
const uniq = []
for (const row of rows) {
  const key = `${row.title}|${row.price}`
  if (seen.has(key)) continue
  seen.add(key)
  uniq.push(row)
}
writeFileSync(OUT, JSON.stringify(uniq, null, 2))
console.log(`wrote ${uniq.length}`)
