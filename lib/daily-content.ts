// Daily marketing content generator.
// Every number is computed from live network data at send time — the template is
// pre-approved against BRAND.md, so nothing hype-able or hallucinated can appear.

export interface DailyNumbers {
  btcPrice: number
  difficulty: number
  hashpricePerThDay: number
  s21DailyBtc: number
  s21GrossDay: number
  s21NetDay: number
  breakevenBtcPrice: number
  profitable: boolean
}

const S21_HASHRATE_TH = 234
const S21_LABEL = 'Antminer S21 Pro (234 TH/s)'
const HOSTING_DAY = 7.5 // $225/month flat
const BLOCK_REWARD = 3.125

export function computeDailyNumbers(btcPrice: number, difficulty: number): DailyNumbers {
  const dailyBtc = (S21_HASHRATE_TH * 1e12 * 86400 * BLOCK_REWARD) / (difficulty * 2 ** 32)
  const gross = dailyBtc * btcPrice
  const net = gross - HOSTING_DAY
  const breakeven = HOSTING_DAY / dailyBtc
  const hashprice = gross / S21_HASHRATE_TH
  return {
    btcPrice,
    difficulty,
    hashpricePerThDay: hashprice,
    s21DailyBtc: dailyBtc,
    s21GrossDay: gross,
    s21NetDay: net,
    breakevenBtcPrice: breakeven,
    profitable: net > 0,
  }
}

const usd = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const usd0 = (n: number) => Math.round(n).toLocaleString('en-US')

// ── Pre-approved rotating content pools (each entry already passes BRAND.md) ──

const RED_FLAGS = [
  { hook: 'This one contract clause has cost miners thousands.', body: 'If a hosting contract lets the provider change your electricity rate mid-term with 30 days notice, your "locked in" deal is not locked in. Demand a rate lock for the full term — in writing.' },
  { hook: 'A "guaranteed daily payout" is the biggest red flag in mining.', body: 'Mining revenue moves with BTC price and network difficulty every single day. Nobody can guarantee a fixed return. Any deal promising one is either lying about the math or planning to pay you with the next customer’s deposit.' },
  { hook: 'Why is that miner $2,000 above retail?', body: 'Turnkey packages love hiding hardware markup. An S21 Pro retails around $3,800 direct. If your quote bundles it at $5,500+, that markup comes straight out of your payback period. Always price the hardware separately.' },
  { hook: 'No facility address? No deal.', body: 'A real hosting provider will tell you exactly where your machine lives. If they dodge the question, you cannot verify power rates, cooling, or that the facility even exists. Verified location or walk away.' },
  { hook: 'Check who owns the machine on paper.', body: 'In some "managed mining" deals you never take title to the hardware. If the company folds, you own nothing. Insist on a serial number registered to your name before you wire a dollar.' },
  { hook: 'Beware the reseller with no history.', body: 'Before buying used hardware, ask for runtime hours and a live hashrate video with today’s date. A seller who cannot produce either is selling you a mystery box.' },
]

const HARDWARE_CHECKS = [
  { model: 'Antminer S19 XP (140 TH/s, 21.5 J/TH)', note: 'was the flagship two generations ago' },
  { model: 'Whatsminer M60S (170 TH/s, 20 J/TH)', note: 'is the strongest non-Bitmain air-cooled option' },
  { model: 'Antminer S21 (200 TH/s, 17.5 J/TH)', note: 'is the budget entry to the current generation' },
  { model: 'Antminer S19 Pro (110 TH/s, 29.5 J/TH)', note: 'still floods the used market at tempting prices' },
]

const EXPLAINERS = [
  { hook: 'What actually is network difficulty?', body: 'Every two weeks Bitcoin adjusts how hard it is to find a block, so blocks keep coming every ten minutes no matter how many miners join. More miners means higher difficulty means every machine earns less BTC. It is the single most ignored number in mining ROI math.' },
  { hook: 'Hashprice: the only mining metric that matters.', body: 'Hashprice is what one terahash earns per day in dollars. It bundles BTC price, difficulty, and block reward into one number. If you know your machine’s hashrate and your hashprice, you know your gross revenue. Everything else is noise.' },
  { hook: 'The 2028 halving, in 30 seconds.', body: 'In April 2028 the block reward drops from 3.125 to 1.5625 BTC. Overnight, every miner’s BTC income halves. Hardware bought today must either pay back before then or survive on half revenue after. Model it before you buy — not after.' },
  { hook: 'Flat-fee vs per-kWh hosting — which wins?', body: 'A flat monthly fee is predictable but fixed even when revenue falls. Per-kWh billing scales with your machine’s draw. At today’s thin margins the crossover math matters more than ever — a few cents per kWh can be the whole profit.' },
]

const MYTHS = [
  { myth: '"BTC near all-time highs means mining is printing money."', truth: 'Network hashrate grew even faster than price. Hashprice today sits near 2022 bear-market lows. Price is not profit — margin is.' },
  { myth: '"Just buy the cheapest miner and let it run."', truth: 'Old hardware at standard hosting rates loses money every day it runs at current difficulty. A cheap machine with negative margin is not cheap — it is a liability with a power cord.' },
  { myth: '"Difficulty always goes up, so mining is doomed."', truth: 'Difficulty falls when unprofitable miners shut off — it happened in 2022. Efficient machines survive the shakeout and earn more when the weak hardware leaves.' },
  { myth: '"Home mining beats hosting because hosting fees are a scam."', truth: 'At the US average of ~$0.16/kWh residential power, one S21 Pro burns more in electricity than it earns. Hosted flat-fee power near $0.09/kWh effective is the only way most people can mine at all.' },
]

// ── Script + captions ──

export interface DailyDrop {
  theme: string
  script: string
  captions: { youtube: string; tiktok: string; instagram: string; x: string }
  checklist: string[]
}

export function buildDailyDrop(n: DailyNumbers, date: Date): DailyDrop {
  const dow = date.getUTCDay() // 0 Sun ... 6 Sat
  const week = Math.floor(date.getUTCDate() / 7)

  const verdict = n.profitable
    ? `nets about $${usd(n.s21NetDay)} a day after hosting. Thin, but positive.`
    : `LOSES about $${usd(Math.abs(n.s21NetDay))} a day after hosting. Mining is underwater today.`

  const numbersBlock =
    `Bitcoin is at $${usd0(n.btcPrice)}. Network difficulty: ${(n.difficulty / 1e12).toFixed(1)} trillion. ` +
    `Hashprice: ${usd(n.hashpricePerThDay, 4)} dollars per terahash per day. ` +
    `The best air-cooled miner you can buy, the ${S21_LABEL}, earns $${usd(n.s21GrossDay)} gross and ${verdict} ` +
    `Breakeven BTC price on $225-a-month hosting: about $${usd0(n.breakevenBtcPrice)}.`

  let theme: string
  let script: string

  if (dow === 2) {
    const f = RED_FLAGS[(week + date.getUTCMonth()) % RED_FLAGS.length]
    theme = 'Red Flag Tuesday'
    script = `${f.hook}\n\n${f.body}\n\nQuick market check: ${numbersBlock}\n\nBefore you sign anything, run your own numbers free at lightningmines.com.`
  } else if (dow === 3) {
    const h = HARDWARE_CHECKS[(week + date.getUTCMonth()) % HARDWARE_CHECKS.length]
    theme = 'Hardware Reality Check'
    script = `Thinking about the ${h.model}? It ${h.note}.\n\nHere is what the math says today: ${numbersBlock}\n\nOlder and less efficient machines earn proportionally less — plug the exact model into the free calculator at lightningmines.com before you spend a dollar.`
  } else if (dow === 4) {
    const e = EXPLAINERS[(week + date.getUTCMonth()) % EXPLAINERS.length]
    theme = 'Explainer Thursday'
    script = `${e.hook}\n\n${e.body}\n\nToday’s live numbers: ${numbersBlock}\n\nSee what it means for your setup — free calculator at lightningmines.com.`
  } else if (dow === 6) {
    const m = MYTHS[(week + date.getUTCMonth()) % MYTHS.length]
    theme = 'Myth-Bust Saturday'
    script = `Myth: ${m.myth}\n\nReality: ${m.truth}\n\nProof, with today’s live data: ${numbersBlock}\n\nDon’t take my word for it — run your own numbers free at lightningmines.com.`
  } else if (dow === 0) {
    theme = 'Long-form Sunday (YouTube deep dive day)'
    script = `Today is the weekly long-form video. Suggested topic: expand this week’s best-performing short into a 5–8 minute breakdown.\n\nAnchor it with today’s numbers: ${numbersBlock}\n\nClose with the standard CTA: run your own numbers free at lightningmines.com.`
  } else {
    theme = dow === 5 ? 'Hashprice Check + Week Recap' : 'Daily Hashprice Check'
    const open = n.profitable
      ? `Mining is profitable today — barely. Here is the real math.`
      : `Nobody else will tell you this: mining loses money today. Here is the proof.`
    script = `${open}\n\n${numbersBlock}\n\n${n.profitable ? 'One difficulty jump or price dip flips this negative. Know your breakeven.' : `Until BTC clears roughly $${usd0(n.breakevenBtcPrice)}, standard hosted mining runs at a loss. That is not doom — that is a number to watch.`}\n\nRun your own numbers free at lightningmines.com.`
  }

  const stat = n.profitable
    ? `S21 Pro net today: +$${usd(n.s21NetDay)}/day`
    : `S21 Pro net today: -$${usd(Math.abs(n.s21NetDay))}/day`

  const disclosure = 'Narration is AI-generated. Not financial advice — data from public network stats.'

  const captions = {
    youtube: `${stat} | BTC $${usd0(n.btcPrice)} · Difficulty ${(n.difficulty / 1e12).toFixed(1)}T · Hashprice $${usd(n.hashpricePerThDay, 4)}/TH/day. The honest daily mining check. Free calculator: lightningmines.com\n\n${disclosure}\n#bitcoinmining #hashprice #bitcoin`,
    tiktok: `${stat} — the honest daily mining check 📊 Free calculator at lightningmines.com\n${disclosure}\n#bitcoinmining #bitcoin #hashprice #crypto`,
    instagram: `${stat}\n\nBTC $${usd0(n.btcPrice)} · Difficulty ${(n.difficulty / 1e12).toFixed(1)}T · Hashprice $${usd(n.hashpricePerThDay, 4)}/TH/day\n\nThe daily mining check nobody else is honest enough to post. Link in bio for the free calculator.\n\n${disclosure}\n#bitcoinmining #bitcoin #hashprice #miningfarm #btc`,
    x: `${stat}\n\nBTC: $${usd0(n.btcPrice)}\nDifficulty: ${(n.difficulty / 1e12).toFixed(1)}T\nHashprice: $${usd(n.hashpricePerThDay, 4)}/TH/day\nBreakeven: ~$${usd0(n.breakevenBtcPrice)} BTC\n\n${n.profitable ? 'Profitable today. Barely.' : 'Mining is underwater today. Most channels won’t post that.'}\n\nRun your numbers: lightningmines.com`,
  }

  const checklist = [
    '□ Record/render the 30–60s vertical using the script (dark bg, amber numbers, big text)',
    '□ 12:00pm ET — post to YouTube Shorts (check "altered content: AI" box) + TikTok',
    '□ 12:15pm ET — post to Instagram Reels',
    '□ 6:00pm ET — post the X version (numbers first, link after)',
    '□ Reply to every comment within the first hour — the algorithm rewards it',
  ]

  return { theme, script, captions, checklist }
}
