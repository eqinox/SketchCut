import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const raw = JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'gstroy-kronospan.json'), 'utf8'))
const colorSrc = readFileSync(path.join(ROOT, 'src', 'data', 'kronospan-color.ts'), 'utf8')
const colors = new Function(`${colorSrc.replace('export const KRONOSPAN_COLORS =', 'return ')}`)()
const swatches = new Map()
for (const color of colors) {
  swatches.set(color.code, { name: color.name, image: color.image, color: color.color })
  for (const combo of color.combinations) {
    if (!swatches.has(combo.code)) swatches.set(combo.code, { name: combo.name, image: combo.image, color: combo.color })
  }
}

const COLOR_GROUP = new Map()
const groups = {
  Бели: ['K8681', 'K8685', 'K8100', 'K110', 'K101', '114'],
  Сиви: ['K191', 'K112', '0540', 'K1700', 'K522', 'K197', 'K519', 'K523', 'K171', 'K6299', 'K162', 'K164', 'K166', 'K096'],
  Черни: ['K190'],
  'Бежови и кафяви': ['K564', 'K7031', '0514', 'K5982', '0522', 'K680', 'K681', '0515', 'K7045', 'K5981', 'K8533', 'K301', 'K7166', 'K684', 'K7181'],
  Цветни: ['K134', 'K516', 'K132', 'K7113', 'K514', 'K098', 'K9551', 'K686', 'K513', 'K512', 'K682', 'K683', 'K515', 'K518', 'K517', 'K125', 'K5994', 'K8984', 'K685', 'K7063', 'K097', 'K7190', 'K9561', 'K521', '0244', 'K520', 'K687'],
}
for (const [label, codes] of Object.entries(groups)) {
  for (const code of codes) COLOR_GROUP.set(code, label)
}

const SURFACE = {
  PE: 'шагре',
  PD: 'пясъчна',
  SM: 'гладко',
  BS: 'офисна',
  SU: 'супер мат',
  UM: 'ултра мат',
  PW: 'дървесен фладер',
  SN: 'дълбок фладер',
  PN: 'камък',
  RT: 'рустик',
  RW: 'дървесен фладер',
  HU: 'синхронизиран дъб',
  AD: 'синхронизиран дъб',
  PV: 'дъб',
}

const CYR = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y' }
function latin(text) {
  return text.replace(/[АВЕКМНОРСТХУ]/g, (ch) => CYR[ch] || ch)
}

const WOOD = /OAK|WALNUT|ASH|BEECH|CHERRY|MAPLE|WENGE|ELM|PINE|ALDER|BIRCH|HICKORY|CHESTNUT|WOOD|CANELLA|ARTWOOD|OREGON|BOLO|SPRUCE|FIR|TEAK|ACACIA|POPLAR|APPLE|PEAR|ZEBRA|FINELINE|MOCCA/
const STONE = /CONCRETE|GRANITE|MARBLE|STONE|SLATE|ALBUS|AROSA|FLOW|TESSEA|TERRA|METAL|ALUMINIUM|ALUMINUM|GRANADA|ATELIER/

function canonicalCode(shopCode, english, bulgarian) {
  const digits = shopCode.replace(/\D/g, '')
  const hadK = /[KК]/.test(shopCode)
  if (hadK) return `K${digits}`
  const blob = `${bulgarian} ${english}`.toUpperCase()
  if (digits === '514' && blob.includes('IVORY')) return '0514'
  if (digits === '515' && blob.includes('SAND')) return '0515'
  if (digits === '522' && blob.includes('BEIGE')) return '0522'
  if (digits === '540' && blob.includes('MANHATTAN')) return '0540'
  if (digits === '244' && blob.includes('PETROL')) return '0244'
  if (digits === '110' || blob.includes('КОРПУС')) return 'K110'
  if (digits === '101' || blob.includes('FRONT')) return 'K101'
  if (swatches.has(`K${digits}`)) return `K${digits}`
  if (swatches.has(digits.padStart(4, '0'))) return digits.padStart(4, '0')
  if (swatches.has(digits)) return digits
  return digits
}

function groupFor(code, name) {
  if (COLOR_GROUP.has(code)) return COLOR_GROUP.get(code)
  const upper = name.toUpperCase()
  if (WOOD.test(upper)) return 'Дървесни'
  if (STONE.test(upper)) return 'Камък и бетон'
  if (/WHITE|БЯЛ/.test(upper)) return 'Бели'
  if (/RED|BLUE|GREEN|YELLOW|PINK|ORANGE/.test(upper)) return 'Цветни'
  return 'Други'
}

const boards = []
const failed = []
for (const row of raw) {
  let title = row.title.replace(/^ЛАМИНИРАНО ПДЧ\s+/, '')
  title = title.replace(/---/g, '').replace(/\s*2800х2070х18.*$/i, '').trim()
  const match = title.match(/^((?:[KК]\d+|\d+[KК]?))\s+([A-ZА-Я]{2})(?:\s+\/[^/]+\/)?\s+(.+)$/)
  if (!match) {
    failed.push(row.title)
    continue
  }
  const surface = latin(match[2])
  const rest = match[3].trim()
  const parts = rest.split(/\s+\/\s+/)
  const english = parts.length > 1 ? parts[parts.length - 1].trim() : rest
  const bulgarian = parts.length > 1 ? parts.slice(0, -1).join(' / ') : ''
  const code = canonicalCode(latin(match[1]), english, bulgarian)
  const known = swatches.get(code)
  const plain = english.replace(/\s+/g, ' ')
  const name =
    known?.name ||
    (plain === plain.toUpperCase()
      ? plain.toLowerCase().replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
      : plain)
  const imagePath = path.join(ROOT, 'public', 'kronospan', `${code}.jpg`)
  const image = existsSync(imagePath) ? `/kronospan/${code}.jpg` : known?.image
  boards.push({
    code,
    name,
    surface,
    surfaceLabel: SURFACE[surface] || surface,
    priceEur: row.price,
    group: groupFor(code, `${name} ${english}`),
    image: image || undefined,
    color: known?.color || '#c4a574',
  })
}

boards.sort((a, b) => a.group.localeCompare(b.group, 'bg') || a.name.localeCompare(b.name, 'en') || a.surface.localeCompare(b.surface))

const order = ['Бели', 'Сиви', 'Черни', 'Бежови и кафяви', 'Цветни', 'Дървесни', 'Камък и бетон', 'Други']
boards.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.code.localeCompare(b.code, 'en') || a.surface.localeCompare(b.surface))

if (failed.length) {
  console.log('FAILED', failed.length)
  console.log(failed.join('\n'))
}

const counts = {}
for (const board of boards) counts[board.group] = (counts[board.group] || 0) + 1
console.log(counts, 'boards', boards.length, 'with image', boards.filter((b) => b.image).length)

const lines = boards.map(
  (board) =>
    `  { "code": ${JSON.stringify(board.code)}, "name": ${JSON.stringify(board.name)}, "surface": ${JSON.stringify(board.surface)}, "surfaceLabel": ${JSON.stringify(board.surfaceLabel)}, "priceEur": ${board.priceEur}, "group": ${JSON.stringify(board.group)}, "color": ${JSON.stringify(board.color)}${board.image ? `, "image": ${JSON.stringify(board.image)}` : ''} },`,
)
const file = `/** Kronospan 18 mm boards from G-Stroy, one row per surface. */
export const KRONOSPAN_BOARDS = [
${lines.join('\n')}
]
`
writeFileSync(path.join(ROOT, 'src', 'data', 'kronospan-boards.ts'), file)
console.log('wrote boards')
