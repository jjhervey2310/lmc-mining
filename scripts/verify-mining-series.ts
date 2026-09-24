// Sanity-checks the derived mining series against known-good reference points.
// Run: npx ts-node --project tsconfig.scripts.json scripts/verify-mining-series.ts

import { getMiningSeries, blockSubsidy, hashrateFromDifficulty, hashprice } from '../lib/chart/mining'

function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  // ── Unit checks on the pure math ──────────────────────────────────────
  check('subsidy at genesis', blockSubsidy(0) === 50, `${blockSubsidy(0)} BTC`)
  check('subsidy at 2024 halving', blockSubsidy(840_000) === 3.125, `${blockSubsidy(840_000)} BTC`)
  check('subsidy pre-2024 halving', blockSubsidy(839_999) === 6.25, `${blockSubsidy(839_999)} BTC`)
  check('subsidy at 2028 halving', blockSubsidy(1_050_000) === 1.5625, `${blockSubsidy(1_050_000)} BTC`)

  // ~127.5T difficulty should imply ~900 EH/s, which is where the network sits.
  const eh = hashrateFromDifficulty(127_479_855_693_691) / 1e18
  check('hashrate from difficulty', eh > 700 && eh < 1200, `${eh.toFixed(0)} EH/s`)

  // Cross-check against the site's existing subsidy-only formula.
  const legacy = (2.7e20 * 63_000) / (127_479_855_693_691 * 4294967296)
  const derivedNoFees = hashprice(127_479_855_693_691, 63_000, 961_632, 0)
  check(
    'matches legacy formula when fees are excluded',
    Math.abs(legacy - derivedNoFees) / legacy < 0.001,
    `legacy $${legacy.toFixed(2)} vs derived $${derivedNoFees.toFixed(2)}`,
  )

  const withFees = hashprice(127_479_855_693_691, 63_000, 961_632, 0.022)
  check('fees raise hashprice slightly', withFees > derivedNoFees, `$${withFees.toFixed(2)} vs $${derivedNoFees.toFixed(2)}`)

  // ── Live end-to-end ───────────────────────────────────────────────────
  const series = await getMiningSeries()
  const { hashprice: hp, difficulty, hashrate } = series

  check('hashprice series populated', hp.length > 300, `${hp.length} daily points`)
  check('all three series aligned', hp.length === difficulty.length && hp.length === hashrate.length,
    `hp=${hp.length} diff=${difficulty.length} hr=${hashrate.length}`)

  const sorted = hp.every((p, i) => i === 0 || p.time > hp[i - 1].time)
  check('strictly ascending, no duplicate days', sorted, '')

  const first = hp[0]
  const last = hp[hp.length - 1]
  const span = (last.time - first.time) / 86400
  check('covers a meaningful window', span > 300, `${span.toFixed(0)} days`)

  const values = hp.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  check('hashprice in a plausible range', min > 5 && max < 500, `$${min.toFixed(2)}–$${max.toFixed(2)}/PH/day`)

  console.log('\nRange:', new Date(first.time * 1000).toISOString().slice(0, 10), '->', new Date(last.time * 1000).toISOString().slice(0, 10))
  console.log('Latest hashprice: $' + last.value.toFixed(2) + '/PH/day')
  console.log('Latest difficulty:', difficulty[difficulty.length - 1].value.toFixed(2) + 'T')
  console.log('Latest hashrate:', hashrate[hashrate.length - 1].value.toFixed(0) + ' EH/s')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
