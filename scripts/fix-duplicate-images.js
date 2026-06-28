// Generates unique branded JPG images for every miner slug that currently has a duplicate
// Run: node scripts/fix-duplicate-images.js
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const OUT = path.join(__dirname, '../public/miners')

// Chip-style SVG — unique per model with label, specs, cooling badge
function svgFor({ label, mfr, color, th, w, cooling }) {
  const eff = th && w ? (w / th).toFixed(1) : null

  const pinsLeft  = [0,1,2,3].map(i => `<rect x="118" y="${82+i*22}" width="18" height="9" rx="2.5" fill="${color}44" stroke="${color}88" stroke-width="0.7"/>`).join('')
  const pinsRight = [0,1,2,3].map(i => `<rect x="264" y="${82+i*22}" width="18" height="9" rx="2.5" fill="${color}44" stroke="${color}88" stroke-width="0.7"/>`).join('')
  const pinsTop   = [0,1,2,3].map(i => `<rect x="${148+i*22}" y="42" width="9" height="18" rx="2.5" fill="${color}44" stroke="${color}88" stroke-width="0.7"/>`).join('')
  const pinsBot   = [0,1,2,3].map(i => `<rect x="${148+i*22}" y="200" width="9" height="18" rx="2.5" fill="${color}44" stroke="${color}88" stroke-width="0.7"/>`).join('')
  const gridH = [0,1,2].map(i => `<line x1="140" y1="${90+i*26}" x2="260" y2="${90+i*26}" stroke="${color}18" stroke-width="0.8"/>`).join('')
  const gridV = [0,1,2].map(i => `<line x1="${170+i*26}" y1="62" x2="${170+i*26}" y2="198" stroke="${color}18" stroke-width="0.8"/>`).join('')

  const badge = cooling ? `
    <rect x="152" y="152" width="96" height="20" rx="4" fill="${color}22" stroke="${color}66" stroke-width="0.8"/>
    <text x="200" y="166" text-anchor="middle" font-family="monospace" font-size="9" fill="${color}" letter-spacing="1">${cooling}</text>
  ` : ''

  const stats = eff ? `
    <text x="110" y="250" text-anchor="middle" font-family="monospace" font-size="11" fill="${color}" font-weight="600">${th} TH/s</text>
    <text x="200" y="250" text-anchor="middle" font-family="monospace" font-size="11" fill="#555">·</text>
    <text x="290" y="250" text-anchor="middle" font-family="monospace" font-size="11" fill="${color}" font-weight="600">${eff} J/TH</text>
  ` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 290" width="400" height="290">
  <rect width="400" height="290" fill="#0d0d0d"/>
  <rect x="1" y="1" width="398" height="288" rx="14" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.25"/>
  <rect x="6" y="6" width="388" height="278" rx="12" fill="#131313" stroke="#222222" stroke-width="1"/>
  ${pinsLeft}${pinsRight}${pinsTop}${pinsBot}
  <rect x="136" y="60" width="128" height="140" rx="8" fill="#1a1a1a" stroke="${color}" stroke-width="1.8"/>
  <rect x="144" y="68" width="112" height="124" rx="4" fill="#0e0e0e" stroke="${color}2a" stroke-width="0.8"/>
  ${gridH}${gridV}
  <circle cx="154" cy="78" r="3.5" fill="${color}" opacity="0.9"/>
  <circle cx="165" cy="78" r="3.5" fill="#00c853" opacity="0.7"/>
  <circle cx="176" cy="78" r="3.5" fill="#1a1a1a" opacity="0.4"/>
  <text x="200" y="122" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" fill="${color}" letter-spacing="2">ASIC</text>
  <text x="200" y="140" text-anchor="middle" font-family="monospace" font-size="8" fill="${color}66" letter-spacing="1">SHA-256</text>
  ${badge}
  <line x1="30" y1="215" x2="370" y2="215" stroke="#1e1e1e" stroke-width="1"/>
  <text x="200" y="236" text-anchor="middle" font-family="'Courier New', monospace" font-size="15" font-weight="700" fill="#ffffff" letter-spacing="0.5">${label}</text>
  ${stats}
  <text x="200" y="276" text-anchor="middle" font-family="monospace" font-size="8" fill="#3a3a3a" letter-spacing="2">${mfr}</text>
</svg>`
}

// Only the 19 slugs that currently have duplicate hashes — generate unique images for each
const TARGETS = [
  // Bitmain S23 variants (currently = S21 XP hash)
  { slug: 'antminer-s23',            label: 'S23',            mfr: 'BITMAIN',  color: '#f7931a', th: 280,  w: 3640 },
  { slug: 'antminer-s23-hydro',      label: 'S23 Hydro',      mfr: 'BITMAIN',  color: '#60a5fa', th: 490,  w: 5880, cooling: 'HYDRO' },
  { slug: 'antminer-s21-xp-hydro',   label: 'S21 XP Hydro',   mfr: 'BITMAIN',  color: '#38bdf8', th: 473,  w: 5676, cooling: 'HYDRO' },
  // Bitmain S21 Pro variants (currently = S21 Pro hash)
  { slug: 'antminer-s21-pro-hydro',  label: 'S21 Pro Hydro',  mfr: 'BITMAIN',  color: '#60a5fa', th: 335,  w: 5360, cooling: 'HYDRO' },
  { slug: 'antminer-s21-pro-immersion', label: 'S21 Pro Imm', mfr: 'BITMAIN',  color: '#c084fc', th: 335,  w: 5360, cooling: 'IMMERSION' },
  // Bitmain S21 variants (currently = S21 hash)
  { slug: 'antminer-s21-hydro',      label: 'S21 Hydro',      mfr: 'BITMAIN',  color: '#7dd3fc', th: 319,  w: 5360, cooling: 'HYDRO' },
  // Bitmain S19 XP variants (currently = S19 XP hash)
  { slug: 'antminer-s19-pro',        label: 'S19 Pro',        mfr: 'BITMAIN',  color: '#d97706', th: 110,  w: 3250 },
  { slug: 'antminer-s19-xp-hydro',   label: 'S19 XP Hydro',  mfr: 'BITMAIN',  color: '#93c5fd', th: 255,  w: 5346, cooling: 'HYDRO' },
  { slug: 'antminer-s19-xp-immersion', label: 'S19 XP Imm',  mfr: 'BITMAIN',  color: '#a855f7', th: 255,  w: 5346, cooling: 'IMMERSION' },
  // Bitmain S19j Pro variants (currently = S19j Pro hash)
  { slug: 'antminer-s19j-pro-plus',  label: 'S19j Pro+',      mfr: 'BITMAIN',  color: '#e08810', th: 122,  w: 3355 },
  { slug: 'antminer-s19-pro-plus-hydro', label: 'S19 Pro+ Hydro', mfr: 'BITMAIN', color: '#bfdbfe', th: 175, w: 3451, cooling: 'HYDRO' },
  // Canaan (currently = S19 XP or S19j Pro hash)
  { slug: 'canaan-avalon-a1566',     label: 'Avalon A1566',   mfr: 'CANAAN',   color: '#f472b6', th: 150,  w: 3420 },
  { slug: 'canaan-avalon-a1466',     label: 'Avalon A1466',   mfr: 'CANAAN',   color: '#e879f9', th: 150,  w: 3400 },
  { slug: 'canaan-avalon-a1366',     label: 'Avalon A1366',   mfr: 'CANAAN',   color: '#d946ef', th: 110,  w: 3250 },
  // MicroBT variants (currently = M60S hash)
  { slug: 'whatsminer-m60s-plus',    label: 'M60S+',          mfr: 'MICROBT',  color: '#2dd4bf', th: 186,  w: 3534 },
  { slug: 'whatsminer-m53s',         label: 'M53S',           mfr: 'MICROBT',  color: '#60a5fa', th: 230,  w: 6555, cooling: 'HYDRO' },
  { slug: 'whatsminer-m63s-hydro',   label: 'M63S Hydro',     mfr: 'MICROBT',  color: '#38bdf8', th: 390,  w: 6630, cooling: 'HYDRO' },
  // MicroBT immersion (currently = M50S hash)
  { slug: 'whatsminer-m50s-plus-plus-immersion', label: 'M50S++ Imm', mfr: 'MICROBT', color: '#c084fc', th: 126, w: 3276, cooling: 'IMMERSION' },
  // asic-miner fallback (currently = S21 hash)
  { slug: 'asic-miner',              label: 'ASIC Miner',     mfr: 'SHA-256',  color: '#6b7280', th: null, w: null },
]

async function run() {
  let done = 0, failed = 0
  for (const m of TARGETS) {
    const outPath = path.join(OUT, `${m.slug}.jpg`)
    try {
      const svg = Buffer.from(svgFor(m))
      await sharp(svg)
        .resize(400, 290)
        .jpeg({ quality: 88 })
        .toFile(outPath)
      const size = fs.statSync(outPath).size
      console.log(`✓ ${m.slug}.jpg  (${(size / 1024).toFixed(1)} KB)`)
      done++
    } catch (err) {
      console.error(`✗ ${m.slug}: ${err.message}`)
      failed++
    }
  }
  console.log(`\nDone: ${done} generated, ${failed} failed`)
}

run().catch(console.error)
