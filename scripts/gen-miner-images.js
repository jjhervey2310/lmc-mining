// Generates product-render PNG images for each ASIC miner model
// Run with: node scripts/gen-miner-images.js

const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const OUT = path.join(__dirname, '../public/miners')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

function minerSVG({ label, sub, accentColor, fanColor, chipColor, ledColor }) {
  // Grill lines for fans
  const grillLines = (x1, x2) =>
    Array.from({ length: 22 }, (_, i) => {
      const y = 46 + i * 8
      return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#252525" stroke-width="0.7"/>`
    }).join('')

  // Hash chip grid (6 rows x 4 cols)
  const chips = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      const x = 126 + col * 40
      const y = 58 + row * 25
      return `<rect x="${x}" y="${y}" width="32" height="18" rx="2.5"
        fill="${chipColor}" stroke="${accentColor}44" stroke-width="0.6"/>`
    }).join('')
  ).join('')

  // Fan blade paths
  const fan = (cx, cy, r) => {
    const blades = [0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
      const rad = (deg * Math.PI) / 180
      const bx = cx + Math.cos(rad) * r * 0.55
      const by = cy + Math.sin(rad) * r * 0.55
      return `<ellipse cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" rx="${(r * 0.28).toFixed(1)}" ry="${(r * 0.14).toFixed(1)}"
        transform="rotate(${deg}, ${bx.toFixed(1)}, ${by.toFixed(1)})"
        fill="${fanColor}" opacity="0.75"/>`
    }).join('')
    return `
      <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#1c1c1c" stroke="#2e2e2e" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a1a1a" stroke="#333" stroke-width="1.5"/>
      ${blades}
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.22).toFixed(1)}" fill="#252525" stroke="#333" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.1).toFixed(1)}" fill="${accentColor}" opacity="0.6"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 280" width="440" height="280">
  <defs>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2c2c2c"/>
      <stop offset="50%" stop-color="#222222"/>
      <stop offset="100%" stop-color="#1e1e1e"/>
    </linearGradient>
    <linearGradient id="pcbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e1a0e"/>
      <stop offset="100%" stop-color="#0a140a"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="440" height="280" fill="#141414"/>

  <!-- Main housing -->
  <rect x="18" y="28" width="404" height="208" rx="9" fill="url(#bodyGrad)" stroke="#3c3c3c" stroke-width="1.5"/>
  <!-- Housing top highlight -->
  <rect x="18" y="28" width="404" height="4" rx="2" fill="#363636" opacity="0.6"/>
  <!-- Housing bottom shadow -->
  <rect x="18" y="232" width="404" height="4" rx="2" fill="#111111" opacity="0.8"/>

  <!-- Left fan housing -->
  <rect x="26" y="36" width="100" height="192" rx="5" fill="#1a1a1a" stroke="#2e2e2e" stroke-width="1"/>
  ${grillLines(28, 124)}
  ${fan(76, 132, 38)}

  <!-- Right fan housing -->
  <rect x="314" y="36" width="100" height="192" rx="5" fill="#1a1a1a" stroke="#2e2e2e" stroke-width="1"/>
  ${grillLines(316, 412)}
  ${fan(364, 132, 38)}

  <!-- PCB / hashboard area -->
  <rect x="134" y="40" width="172" height="188" rx="4" fill="url(#pcbGrad)" stroke="#1e2e1e" stroke-width="1"/>
  <!-- PCB trace lines -->
  <line x1="138" y1="55" x2="302" y2="55" stroke="#152015" stroke-width="1"/>
  <line x1="138" y1="215" x2="302" y2="215" stroke="#152015" stroke-width="1"/>

  <!-- Hash chips -->
  ${chips}

  <!-- Power connectors at bottom -->
  <rect x="142" y="196" width="158" height="10" rx="2" fill="#0a0f0a" stroke="${accentColor}33" stroke-width="0.5"/>
  ${Array.from({ length: 6 }, (_, i) =>
    `<rect x="${148 + i * 24}" y="198" width="16" height="6" rx="1" fill="#151f15"/>`
  ).join('')}

  <!-- Status LEDs top-right of PCB -->
  <circle cx="295" cy="47" r="4.5" fill="${ledColor}" filter="url(#glow)" opacity="0.95"/>
  <circle cx="283" cy="47" r="4.5" fill="#00c853" opacity="0.8"/>
  <circle cx="271" cy="47" r="4.5" fill="#1a2a1a" opacity="0.5"/>

  <!-- Corner screws -->
  ${[[28, 38], [28, 226], [412, 38], [412, 226]].map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="4" fill="#282828" stroke="#3a3a3a" stroke-width="1"/>
     <line x1="${cx - 2}" y1="${cy}" x2="${cx + 2}" y2="${cy}" stroke="#444" stroke-width="0.8"/>
     <line x1="${cx}" y1="${cy - 2}" x2="${cx}" y2="${cy + 2}" stroke="#444" stroke-width="0.8"/>`
  ).join('')}

  <!-- Label bar -->
  <rect x="18" y="244" width="404" height="30" rx="0" fill="#0e0e0e" stroke="#2a2a2a" stroke-width="0"/>
  <rect x="18" y="244" width="404" height="1" fill="#2a2a2a"/>
  <!-- Model name -->
  <text x="220" y="263" font-family="'Courier New', monospace" font-size="14" font-weight="700"
    fill="${accentColor}" text-anchor="middle" letter-spacing="1">${label}</text>
  <!-- Sub label -->
  <text x="40" y="263" font-family="'Courier New', monospace" font-size="9"
    fill="#555" text-anchor="start">${sub}</text>
</svg>`
}

const MINERS = [
  {
    file: 'antminer-s21-xp.png',
    label: 'ANTMINER S21 XP',
    sub: 'BITMAIN',
    accentColor: '#f7931a',
    fanColor: '#3a3a3a',
    chipColor: '#111e11',
    ledColor: '#f7931a',
  },
  {
    file: 'antminer-s21-pro.png',
    label: 'ANTMINER S21 PRO',
    sub: 'BITMAIN',
    accentColor: '#f7931a',
    fanColor: '#3a3a3a',
    chipColor: '#111e11',
    ledColor: '#f7931a',
  },
  {
    file: 'antminer-s21.png',
    label: 'ANTMINER S21',
    sub: 'BITMAIN',
    accentColor: '#f7931a',
    fanColor: '#3a3a3a',
    chipColor: '#111e11',
    ledColor: '#f7931a',
  },
  {
    file: 'antminer-s19-xp.png',
    label: 'ANTMINER S19 XP',
    sub: 'BITMAIN',
    accentColor: '#e08810',
    fanColor: '#363636',
    chipColor: '#0f1c0f',
    ledColor: '#e08810',
  },
  {
    file: 'antminer-s19.png',
    label: 'ANTMINER S19',
    sub: 'BITMAIN',
    accentColor: '#e08810',
    fanColor: '#363636',
    chipColor: '#0f1c0f',
    ledColor: '#e08810',
  },
  {
    file: 'whatsminer-m60s.png',
    label: 'WHATSMINER M60S',
    sub: 'MICROBT',
    accentColor: '#00d4aa',
    fanColor: '#2a3a3a',
    chipColor: '#0a1a18',
    ledColor: '#00d4aa',
  },
  {
    file: 'whatsminer-m50s.png',
    label: 'WHATSMINER M50S',
    sub: 'MICROBT',
    accentColor: '#00b896',
    fanColor: '#2a3a3a',
    chipColor: '#0a1a18',
    ledColor: '#00b896',
  },
  {
    file: 'whatsminer-m53s.png',
    label: 'WHATSMINER M53S',
    sub: 'MICROBT',
    accentColor: '#00d4aa',
    fanColor: '#2a3a3a',
    chipColor: '#0a1a18',
    ledColor: '#00d4aa',
  },
  {
    file: 'canaan-avalon.png',
    label: 'AVALON MINER',
    sub: 'CANAAN',
    accentColor: '#a855f7',
    fanColor: '#2e2a3a',
    chipColor: '#120f1a',
    ledColor: '#a855f7',
  },
  {
    file: 'asic-miner.png',
    label: 'ASIC MINER',
    sub: 'BITCOIN MINING',
    accentColor: '#6b7280',
    fanColor: '#323232',
    chipColor: '#111a11',
    ledColor: '#6b7280',
  },
]

async function generate() {
  for (const m of MINERS) {
    const svg = Buffer.from(minerSVG(m))
    const out = path.join(OUT, m.file)
    await sharp(svg).png({ compressionLevel: 9 }).toFile(out)
    const size = fs.statSync(out).size
    console.log(`✓ ${m.file} (${(size / 1024).toFixed(1)} KB)`)
  }
  console.log('\nAll miner images generated.')
}

generate().catch(console.error)
