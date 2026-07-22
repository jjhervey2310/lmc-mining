# Mining & Technical SME — Playbook

Living memory for the Mining & Technical SME seat. **Read before every review;
append after research and after confirmed outcomes.** Accuracy is the brand, so
this seat's figures must be the most current on the panel. Never delete history —
supersede an old note with a newer dated one.

## Current network reference (keep fresh) — last updated 2026-07-13
- BTC price: ~$62,000–$64,300 (bear-market low; $64,340.78 on 7/10/26, $61,934.50
  on 7/6/26) — 2026-07-13 — Fortune/Yahoo Finance BTC-USD history
- Network difficulty: 127.17T as of the 14th 2026 epoch adjustment, block
  957,600, ~5% drop on 2026-07-11 (down from 133.87T) — 2026-07-13 — The Block /
  CoinWarz difficulty chart
- Hashprice: ~$29/PH/s/day = ~$0.029/TH/day (bear-market low, comparable to the
  2020 post-COVID crash trough of ~$70/PH/day) — 2026-07-13 — Hashrate Index /
  startmining.io
- Note: hashprice quoted in $/PH/s/day by most indices now, not $/TH/day —
  convert (÷1000) before using in per-unit math, and confirm whether the quoted
  figure is gross (pre-pool-fee) or net.

## Hardware reference (efficiency in J/TH, hashrate in TH/s)
<!-- model — J/TH — TH/s — source -->
- Antminer S21 XP (air-cooled) — 13.5 J/TH — 270 TH/s — 3,645W at the wall —
  confirmed 2026-07-13 — Bitmain support docs / d-central / hashrate.farm
- Antminer S21 XP Hyd (liquid-cooled) — 12 J/TH — 473 TH/s — 5,676W — confirmed
  2026-07-13 — Bitmain support docs / cryptominerbros / miningnow
- S21 XP street price: reported range ~$3,800–$5,500/unit in Q1–Q2 2026, most
  commonly cited $4,200–$5,500; bulk deals sometimes $4,000–$4,500 — 2026-07-13
  — asicminershopforall / endlessmining / mineshop.eu. A $4,000/unit deployment
  price is at the low end of this range — plausible for a bulk/relationship
  price but should be confirmed against the actual invoice, not assumed.

## Research log (append newest on top)
- 2026-07-13 — Re-verified for "LMC Phase 1 Deployment Plan v2" (18x S21 XP,
  $72K, fleet math + payback table): BTC ~$64,020 live (Yahoo Finance, matches
  doc's $64,000 exactly); confirmed BM1370 (5nm) is the correct ASIC chip for
  S21 XP/S21 Pro/S21+ (Zeus Mining, d-central, network-hardware-parts — doc's
  claim is accurate, not S19-era BM1366 or S21-standard-only BM1368). Ran full
  fleet model: 18×270=4,860 TH/s, 18×3,645W=65.61kW, 1,574.64 kWh/day — all
  exact matches to the doc. Power-cost table ($78.73/$94.48/$110.22/$125.97 at
  $0.05-0.08) exact to the penny. Revenue $8.05/day/unit computed two ways:
  hashprice-index method (270 TH/s × $0.029/TH/day) = $7.83/day; from-scratch
  difficulty+BTC-price method (using 127.17T, $64K, 3.125 BTC reward) = $8.54/
  day. Doc's $8.05 sits inside that $7.83-$8.54 band (~3-6% off either
  endpoint) — acceptable given real-time hashprice/difficulty noise, and the
  doc doesn't cite an exact source for the figure. Payback table recomputed
  from the doc's own net/day figures: $0.05→3.0yr (exact), $0.06→3.91yr (doc
  says 4.0, +0.09yr), $0.07→5.69yr (doc says 5.8, +0.1yr), $0.08→10.42yr (doc
  says 10.6, +0.2yr) — all within ~2-5%, doesn't flip any verdict. Critically,
  this FIXES the prior lesson: the $0.06 row now lands at 3.9-4.0yr, right at
  the edge of the doc's own "under $0.06 = 3-4yr" bottom line, whereas the v1
  doc's $0.06 computed to 4.25yr (outside the claimed band). Verdict language
  is now internally consistent with its own table.
- 2026-07-13 — Verified S21 XP air-cooled specs (270 TH/s, 13.5 J/TH, 3645W),
  current BTC price (~$62-64K), difficulty (127.17T post 2026-07-11 adjustment),
  and hashprice (~$29/PH/day ≈ $0.029/TH/day) for the "18x S21 XP / $72K / Immanuel
  hosting" deployment-plan review. Ran the full payback model: at $0.07/kWh
  payback ≈6.4yr, at $0.08/kWh ≈13.2yr (thin/fragile margin, not just "slow"); at
  $0.06/kWh ≈4.25yr, not quite the "3-4yr" claimed — the actual 3-4yr band is
  closer to $0.045-0.058/kWh. Static model (no difficulty growth, no pool fee, no
  uptime loss assumed) — flagged as missing disclosure.

## Lessons learned (mistakes → rule) (append newest on top)
- 2026-07-13 — Two legitimate methods for estimating gross mining revenue
  (published hashprice index vs. from-scratch difficulty+BTC-price calc)
  diverged ~9% ($7.83 vs $8.54/day for one S21 XP) even starting from the same
  underlying difficulty/BTC inputs — this is normal noise, not an error by
  either method. Rule: when an asset states a gross revenue/day figure without
  citing its exact source, treat anything within ~5-10% of either method as
  passable, but flag the missing source citation as a disclosure gap, not a
  math error — don't veto over noise within that band.
- 2026-07-13 — A payback-window claim ("under $0.06/kWh = 3-4yr payback") was
  close but imprecise when checked against the full model — the true 3-4yr band
  sat closer to $0.045-0.058/kWh, and $0.06/kWh itself computed to ~4.25yr. Rule:
  always run the actual day/night breakeven math at the stated power-price
  boundary (not just spot-check the endpoints) before accepting a rounded
  "under $X = Y years" claim — payback curves are non-linear in power price and
  a single round-number breakpoint can be off by a meaningful fraction of a year.
