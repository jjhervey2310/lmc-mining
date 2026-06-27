// Generates one professional SVG per miner slug
// Run: node scripts/gen-miner-svgs.js
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '../public/miners')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

// All miners with their display props
const MINERS = [
  // Bitmain air
  { slug: 'antminer-s21-xp',          label: 'S21 XP',           mfr: 'BITMAIN',  color: '#f7931a', th: 270,  w: 3645 },
  { slug: 'antminer-s21-pro',         label: 'S21 Pro',          mfr: 'BITMAIN',  color: '#f7931a', th: 234,  w: 3510 },
  { slug: 'antminer-s21',             label: 'S21',              mfr: 'BITMAIN',  color: '#e8851a', th: 200,  w: 3500 },
  { slug: 'antminer-s23',             label: 'S23',              mfr: 'BITMAIN',  color: '#f7931a', th: 280,  w: 3640 },
  { slug: 'antminer-s19-xp',          label: 'S19 XP',           mfr: 'BITMAIN',  color: '#d4790f', th: 140,  w: 3010 },
  { slug: 'antminer-s19j-pro-plus',   label: 'S19j Pro+',        mfr: 'BITMAIN',  color: '#c87010', th: 122,  w: 3355 },
  { slug: 'antminer-s19j-pro',        label: 'S19j Pro',         mfr: 'BITMAIN',  color: '#c07010', th: 104,  w: 3068 },
  { slug: 'antminer-s19-pro',         label: 'S19 Pro',          mfr: 'BITMAIN',  color: '#b86a0e', th: 110,  w: 3250 },
  // Bitmain hydro
  { slug: 'antminer-s21-xp-hydro',    label: 'S21 XP Hydro',     mfr: 'BITMAIN',  color: '#60a5fa', th: 473,  w: 5676, cooling: 'HYDRO' },
  { slug: 'antminer-s21-pro-hydro',   label: 'S21 Pro Hydro',    mfr: 'BITMAIN',  color: '#38bdf8', th: 335,  w: 5360, cooling: 'HYDRO' },
  { slug: 'antminer-s21-hydro',       label: 'S21 Hydro',        mfr: 'BITMAIN',  color: '#7dd3fc', th: 319,  w: 5360, cooling: 'HYDRO' },
  { slug: 'antminer-s23-hydro',       label: 'S23 Hydro',        mfr: 'BITMAIN',  color: '#60a5fa', th: 490,  w: 5880, cooling: 'HYDRO' },
  { slug: 'antminer-s19-xp-hydro',    label: 'S19 XP Hydro',     mfr: 'BITMAIN',  color: '#93c5fd', th: 255,  w: 5346, cooling: 'HYDRO' },
  { slug: 'antminer-s19-pro-plus-hydro', label: 'S19 Pro+ Hydro', mfr: 'BITMAIN', color: '#bfdbfe', th: 175,  w: 3451, cooling: 'HYDRO' },
  // Bitmain immersion
  { slug: 'antminer-s19-xp-immersion',  label: 'S19 XP Immersion',  mfr: 'BITMAIN', color: '#a855f7', th: 255,  w: 5346, cooling: 'IMMERSION' },
  { slug: 'antminer-s21-pro-immersion', label: 'S21 Pro Immersion',  mfr: 'BITMAIN', color: '#c084fc', th: 335,  w: 5360, cooling: 'IMMERSION' },
  // MicroBT air
  { slug: 'whatsminer-m70s',           label: 'M70S',             mfr: 'MICROBT',  color: '#00d4aa', th: 240,  w: 3360 },
  { slug: 'whatsminer-m70',            label: 'M70',              mfr: 'MICROBT',  color: '#00c49a', th: 230,  w: 3220 },
  { slug: 'whatsminer-m60s-plus',      label: 'M60S+',            mfr: 'MICROBT',  color: '#00d4aa', th: 186,  w: 3534 },
  { slug: 'whatsminer-m60s',           label: 'M60S',             mfr: 'MICROBT',  color: '#00b896', th: 170,  w: 3400 },
  { slug: 'whatsminer-m50s',           label: 'M50S',             mfr: 'MICROBT',  color: '#00a882', th: 126,  w: 3276 },
  // MicroBT hydro
  { slug: 'whatsminer-m53s',           label: 'M53S',             mfr: 'MICROBT',  color: '#38bdf8', th: 230,  w: 6555, cooling: 'HYDRO' },
  { slug: 'whatsminer-m63s-hydro',     label: 'M63S Hydro',       mfr: 'MICROBT',  color: '#60a5fa', th: 390,  w: 6630, cooling: 'HYDRO' },
  // MicroBT immersion
  { slug: 'whatsminer-m50s-plus-plus-immersion', label: 'M50S++ Imm.', mfr: 'MICROBT', color: '#c084fc', th: 126, w: 3276, cooling: 'IMMERSION' },
  // Canaan
  { slug: 'canaan-avalon-a1566',       label: 'Avalon A1566',     mfr: 'CANAAN',   color: '#f472b6', th: 150,  w: 3420 },
  { slug: 'canaan-avalon-a1466',       label: 'Avalon A1466',     mfr: 'CANAAN',   color: '#e879f9', th: 150,  w: 3400 },
  { slug: 'canaan-avalon-a1366',       label: 'Avalon A1366',     mfr: 'CANAAN',   color: '#d946ef', th: 110,  w: 3250 },
  // Fallback
  { slug: 'asic-miner',               label: 'ASIC Miner',       mfr: 'BITCOIN',  color: '#6b7280', th: null, w: null },
]

function svgFor({ slug, label, mfr, color, th, w, cooling }) {
  const eff = th && w ? (w / th).toFixed(1) : null

  // Chip pins
  const pinsLeft  = [0,1,2,3].map(i => `<rect x="118" y="${82+i*22}" width="18" height="9" rx="2.5" fill="${color}44" stroke="${color}88" stroke-width="0.7"/>`).join('')
  const pinsRight = [0,1,2,3].map(i => `<rect x="264" y="${82+i*22}" width="18" height="9" rx="2.5" fill="${color}44" stroke="${color}88" stroke-width="0.7"/>`).join('')
  const pinsTop   = [0,1,2,3].map(i => `<rect x="${148+i*22}" y="42" width="9" height="18" rx="2.5" fill="${color}44" stroke="${color}88" stroke-width="0.7"/>`).join('')
  const pinsBot   = [0,1,2,3].map(i => `<rect x="${148+i*22}" y="200" width="9" height="18" rx="2.5" fill="${color}44" stroke="${color}88" stroke-width="0.7"/>`).join('')

  // Grid lines inside chip
  const gridH = [0,1,2].map(i => `<line x1="140" y1="${90+i*26}" x2="260" y2="${90+i*26}" stroke="${color}18" stroke-width="0.8"/>`).join('')
  const gridV = [0,1,2].map(i => `<line x1="${170+i*26}" y1="62" x2="${170+i*26}" y2="198" stroke="${color}18" stroke-width="0.8"/>`).join('')

  // Cooling badge
  const badge = cooling ? `
    <rect x="152" y="152" width="96" height="20" rx="4" fill="${color}22" stroke="${color}66" stroke-width="0.8"/>
    <text x="200" y="166" text-anchor="middle" font-family="monospace" font-size="9" fill="${color}" letter-spacing="1">${cooling}</text>
  ` : ''

  // Stats
  const stats = eff ? `
    <text x="110" y="250" text-anchor="middle" font-family="monospace" font-size="11" fill="${color}" font-weight="600">${th} TH/s</text>
    <text x="200" y="250" text-anchor="middle" font-family="monospace" font-size="11" fill="#555">·</text>
    <text x="290" y="250" text-anchor="middle" font-family="monospace" font-size="11" fill="${color}" font-weight="600">${eff} J/TH</text>
  ` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 290" width="400" height="290">
  <!-- Background -->
  <rect width="400" height="290" fill="#0d0d0d"/>
  <!-- Outer glow border -->
  <rect x="1" y="1" width="398" height="288" rx="14" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.25"/>
  <!-- Card -->
  <rect x="6" y="6" width="388" height="278" rx="12" fill="#131313" stroke="#222222" stroke-width="1"/>

  <!-- Chip pins -->
  ${pinsLeft}${pinsRight}${pinsTop}${pinsBot}

  <!-- Chip body -->
  <rect x="136" y="60" width="128" height="140" rx="8" fill="#1a1a1a" stroke="${color}" stroke-width="1.8"/>
  <!-- Chip inner area -->
  <rect x="144" y="68" width="112" height="124" rx="4" fill="#0e0e0e" stroke="${color}2a" stroke-width="0.8"/>
  <!-- Grid -->
  ${gridH}${gridV}

  <!-- LED dots corner -->
  <circle cx="154" cy="78" r="3.5" fill="${color}" opacity="0.9"/>
  <circle cx="165" cy="78" r="3.5" fill="#00c853" opacity="0.7"/>
  <circle cx="176" cy="78" r="3.5" fill="#1a1a1a" opacity="0.4"/>

  <!-- ASIC label -->
  <text x="200" y="122" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" fill="${color}" letter-spacing="2">ASIC</text>
  <text x="200" y="140" text-anchor="middle" font-family="monospace" font-size="8" fill="${color}66" letter-spacing="1">SHA-256</text>

  ${badge}

  <!-- Divider -->
  <line x1="30" y1="215" x2="370" y2="215" stroke="#1e1e1e" stroke-width="1"/>

  <!-- Model label -->
  <text x="200" y="236" text-anchor="middle" font-family="'Courier New', monospace" font-size="15" font-weight="700" fill="#ffffff" letter-spacing="0.5">${label}</text>

  <!-- Stats row -->
  ${stats}

  <!-- Manufacturer -->
  <text x="200" y="276" text-anchor="middle" font-family="monospace" font-size="8" fill="#3a3a3a" letter-spacing="2">${mfr}</text>
</svg>`
}

let generated = 0, skipped = 0
for (const m of MINERS) {
  const outPath = path.join(OUT, `${m.slug}.svg`)
  if (fs.existsSync(outPath)) { skipped++; continue }
  fs.writeFileSync(outPath, svgFor(m), 'utf8')
  console.log(`✓ ${m.slug}.svg`)
  generated++
}
console.log(`\nGenerated ${generated}, skipped ${skipped} (already exist).`)
