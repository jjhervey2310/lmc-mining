// Generates unique PNG images for every miner that lacks a real product photo
// Color-coded by cooling type: orange=air, blue=hydro, purple=immersion, teal=MicroBT
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const OUT = path.join(__dirname, '../public/miners')

function minerSVG({ label, sub, accentColor, fanColor, chipColor, ledColor, badge, badgeColor }) {
  const grillLines = (x1, x2) =>
    Array.from({ length: 22 }, (_, i) => {
      const y = 46 + i * 8
      return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#252525" stroke-width="0.7"/>`
    }).join('')

  const chips = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      const x = 126 + col * 40
      const y = 58 + row * 25
      return `<rect x="${x}" y="${y}" width="32" height="18" rx="2.5"
        fill="${chipColor}" stroke="${accentColor}44" stroke-width="0.6"/>`
    }).join('')
  ).join('')

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

  // Hydro port overlay (water fittings on right fan side)
  const hydroPorts = badge === 'HYDRO' ? `
    <rect x="330" y="70" width="60" height="20" rx="4" fill="#1a2a3a" stroke="#3b82f6" stroke-width="1.5"/>
    <circle cx="345" cy="80" r="6" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/>
    <circle cx="375" cy="80" r="6" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/>
    <text x="360" y="84" font-family="monospace" font-size="7" fill="#60a5fa" text-anchor="middle">H₂O</text>
    <rect x="330" y="155" width="60" height="20" rx="4" fill="#1a2a3a" stroke="#3b82f6" stroke-width="1.5"/>
    <circle cx="345" cy="165" r="6" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/>
    <circle cx="375" cy="165" r="6" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/>
  ` : badge === 'IMMERSION' ? `
    <rect x="26" y="100" width="104" height="64" rx="4" fill="#1a0a2e" stroke="#a855f7" stroke-width="1" opacity="0.85"/>
    <text x="78" y="135" font-family="monospace" font-size="9" fill="#c084fc" text-anchor="middle">IMMERSION</text>
    <text x="78" y="148" font-family="monospace" font-size="8" fill="#9333ea" text-anchor="middle">COOLING</text>
    <rect x="314" y="100" width="104" height="64" rx="4" fill="#1a0a2e" stroke="#a855f7" stroke-width="1" opacity="0.85"/>
    <text x="366" y="135" font-family="monospace" font-size="9" fill="#c084fc" text-anchor="middle">IMMERSION</text>
    <text x="366" y="148" font-family="monospace" font-size="8" fill="#9333ea" text-anchor="middle">COOLING</text>
  ` : ''

  const badgeEl = badge ? `
    <rect x="134" y="215" width="60" height="13" rx="3" fill="${badgeColor}22" stroke="${badgeColor}88" stroke-width="0.8"/>
    <text x="164" y="225" font-family="monospace" font-size="8" fill="${badgeColor}" text-anchor="middle" letter-spacing="0.5">${badge}</text>
  ` : ''

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
  <rect width="440" height="280" fill="#141414"/>
  <rect x="18" y="28" width="404" height="208" rx="9" fill="url(#bodyGrad)" stroke="#3c3c3c" stroke-width="1.5"/>
  <rect x="18" y="28" width="404" height="4" rx="2" fill="#363636" opacity="0.6"/>
  <rect x="18" y="232" width="404" height="4" rx="2" fill="#111111" opacity="0.8"/>
  <rect x="26" y="36" width="100" height="192" rx="5" fill="#1a1a1a" stroke="#2e2e2e" stroke-width="1"/>
  ${grillLines(28, 124)}
  ${fan(76, 132, 38)}
  <rect x="314" y="36" width="100" height="192" rx="5" fill="#1a1a1a" stroke="#2e2e2e" stroke-width="1"/>
  ${grillLines(316, 412)}
  ${fan(364, 132, 38)}
  ${hydroPorts}
  <rect x="134" y="40" width="172" height="188" rx="4" fill="url(#pcbGrad)" stroke="#1e2e1e" stroke-width="1"/>
  <line x1="138" y1="55" x2="302" y2="55" stroke="#152015" stroke-width="1"/>
  <line x1="138" y1="215" x2="302" y2="215" stroke="#152015" stroke-width="1"/>
  ${chips}
  <rect x="142" y="196" width="158" height="10" rx="2" fill="#0a0f0a" stroke="${accentColor}33" stroke-width="0.5"/>
  ${Array.from({ length: 6 }, (_, i) =>
    `<rect x="${148 + i * 24}" y="198" width="16" height="6" rx="1" fill="#151f15"/>`
  ).join('')}
  <circle cx="295" cy="47" r="4.5" fill="${ledColor}" filter="url(#glow)" opacity="0.95"/>
  <circle cx="283" cy="47" r="4.5" fill="#00c853" opacity="0.8"/>
  <circle cx="271" cy="47" r="4.5" fill="#1a2a1a" opacity="0.5"/>
  ${[[28, 38], [28, 226], [412, 38], [412, 226]].map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="4" fill="#282828" stroke="#3a3a3a" stroke-width="1"/>
     <line x1="${cx - 2}" y1="${cy}" x2="${cx + 2}" y2="${cy}" stroke="#444" stroke-width="0.8"/>
     <line x1="${cx}" y1="${cy - 2}" x2="${cx}" y2="${cy + 2}" stroke="#444" stroke-width="0.8"/>`
  ).join('')}
  ${badgeEl}
  <rect x="18" y="244" width="404" height="30" rx="0" fill="#0e0e0e"/>
  <rect x="18" y="244" width="404" height="1" fill="#2a2a2a"/>
  <text x="220" y="263" font-family="'Courier New', monospace" font-size="14" font-weight="700"
    fill="${accentColor}" text-anchor="middle" letter-spacing="1">${label}</text>
  <text x="40" y="263" font-family="'Courier New', monospace" font-size="9"
    fill="#555" text-anchor="start">${sub}</text>
</svg>`
}

const MINERS = [
  // Bitmain air — already have real JPEGs, but generate for any gaps
  { file: 'antminer-s19j-pro-plus.png', label: 'S19j PRO+', sub: 'BITMAIN ANTMINER', accentColor: '#e08810', fanColor: '#363636', chipColor: '#0f1c0f', ledColor: '#e08810' },
  { file: 'antminer-s19-pro.png',       label: 'S19 PRO',   sub: 'BITMAIN ANTMINER', accentColor: '#c87810', fanColor: '#363636', chipColor: '#0f1a0f', ledColor: '#c87810' },
  // Bitmain hydro — blue palette
  { file: 'antminer-s21-xp-hydro.png',        label: 'S21 XP HYDRO',     sub: 'BITMAIN ANTMINER', accentColor: '#60a5fa', fanColor: '#1a2a3a', chipColor: '#0a1220', ledColor: '#60a5fa', badge: 'HYDRO', badgeColor: '#3b82f6' },
  { file: 'antminer-s21-pro-hydro.png',       label: 'S21 PRO HYDRO',    sub: 'BITMAIN ANTMINER', accentColor: '#38bdf8', fanColor: '#1a2535', chipColor: '#0a1018', ledColor: '#38bdf8', badge: 'HYDRO', badgeColor: '#0ea5e9' },
  { file: 'antminer-s21-hydro.png',           label: 'S21 HYDRO',        sub: 'BITMAIN ANTMINER', accentColor: '#7dd3fc', fanColor: '#1a2a3a', chipColor: '#0a1418', ledColor: '#7dd3fc', badge: 'HYDRO', badgeColor: '#38bdf8' },
  { file: 'antminer-s19-xp-hydro.png',        label: 'S19 XP HYDRO',     sub: 'BITMAIN ANTMINER', accentColor: '#93c5fd', fanColor: '#1e2a38', chipColor: '#0a1220', ledColor: '#93c5fd', badge: 'HYDRO', badgeColor: '#60a5fa' },
  { file: 'antminer-s19-pro-plus-hydro.png',  label: 'S19 PRO+ HYDRO',   sub: 'BITMAIN ANTMINER', accentColor: '#bfdbfe', fanColor: '#1a2a40', chipColor: '#080f1a', ledColor: '#bfdbfe', badge: 'HYDRO', badgeColor: '#93c5fd' },
  // Bitmain immersion — purple palette
  { file: 'antminer-s19-xp-immersion.png',    label: 'S19 XP IMMERSION', sub: 'BITMAIN ANTMINER', accentColor: '#a855f7', fanColor: '#2a1a3a', chipColor: '#120a1e', ledColor: '#a855f7', badge: 'IMMERSION', badgeColor: '#a855f7' },
  { file: 'antminer-s21-pro-immersion.png',   label: 'S21 PRO IMMERSION',sub: 'BITMAIN ANTMINER', accentColor: '#c084fc', fanColor: '#2e1a40', chipColor: '#140a22', ledColor: '#c084fc', badge: 'IMMERSION', badgeColor: '#c084fc' },
  // MicroBT
  { file: 'whatsminer-m53s-real.png',         label: 'M53S',             sub: 'MICROBT WHATSMINER', accentColor: '#00d4aa', fanColor: '#2a3a3a', chipColor: '#0a1a18', ledColor: '#00d4aa' },
  { file: 'whatsminer-m63s-hydro.png',        label: 'M63S HYDRO',       sub: 'MICROBT WHATSMINER', accentColor: '#38bdf8', fanColor: '#1a2a3a', chipColor: '#0a1220', ledColor: '#38bdf8', badge: 'HYDRO', badgeColor: '#38bdf8' },
  { file: 'whatsminer-m50s-pp-immersion.png', label: 'M50S++ IMMERSION', sub: 'MICROBT WHATSMINER', accentColor: '#c084fc', fanColor: '#2a1a3a', chipColor: '#120a1e', ledColor: '#c084fc', badge: 'IMMERSION', badgeColor: '#c084fc' },
  // Canaan — distinct purple/silver palette per model
  { file: 'canaan-avalon-a1566.png', label: 'AVALON A1566', sub: 'CANAAN', accentColor: '#f472b6', fanColor: '#2a1a2a', chipColor: '#1a0a18', ledColor: '#f472b6' },
  { file: 'canaan-avalon-a1466.png', label: 'AVALON A1466', sub: 'CANAAN', accentColor: '#e879f9', fanColor: '#281a2a', chipColor: '#180a1a', ledColor: '#e879f9' },
  { file: 'canaan-avalon-a1366.png', label: 'AVALON A1366', sub: 'CANAAN', accentColor: '#d946ef', fanColor: '#2a1a28', chipColor: '#160a16', ledColor: '#d946ef' },
]

async function generate() {
  for (const m of MINERS) {
    const out = path.join(OUT, m.file)
    if (fs.existsSync(out)) {
      console.log(`skip ${m.file} (already exists)`)
      continue
    }
    const svg = Buffer.from(minerSVG(m))
    await sharp(svg).png({ compressionLevel: 9 }).toFile(out)
    const size = fs.statSync(out).size
    console.log(`✓ ${m.file} (${(size / 1024).toFixed(1)} KB)`)
  }
  console.log('\nDone.')
}

generate().catch(console.error)
