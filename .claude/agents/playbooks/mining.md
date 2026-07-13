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
- 2026-07-13 — Verified S21 XP air-cooled specs (270 TH/s, 13.5 J/TH, 3645W),
  current BTC price (~$62-64K), difficulty (127.17T post 2026-07-11 adjustment),
  and hashprice (~$29/PH/day ≈ $0.029/TH/day) for the "18x S21 XP / $72K / Immanuel
  hosting" deployment-plan review. Ran the full payback model: at $0.07/kWh
  payback ≈6.4yr, at $0.08/kWh ≈13.2yr (thin/fragile margin, not just "slow"); at
  $0.06/kWh ≈4.25yr, not quite the "3-4yr" claimed — the actual 3-4yr band is
  closer to $0.045-0.058/kWh. Static model (no difficulty growth, no pool fee, no
  uptime loss assumed) — flagged as missing disclosure.

## Lessons learned (mistakes → rule) (append newest on top)
- 2026-07-13 — A payback-window claim ("under $0.06/kWh = 3-4yr payback") was
  close but imprecise when checked against the full model — the true 3-4yr band
  sat closer to $0.045-0.058/kWh, and $0.06/kWh itself computed to ~4.25yr. Rule:
  always run the actual day/night breakeven math at the stated power-price
  boundary (not just spot-check the endpoints) before accepting a rounded
  "under $X = Y years" claim — payback curves are non-linear in power price and
  a single round-number breakpoint can be off by a meaningful fraction of a year.
