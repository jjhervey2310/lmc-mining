# University Internal-Link Graph (Before / After)

Internal-linking pass across all University articles in `lib/articles.ts`.

## Goal (per article)

- **≥ 2** in-body links to **other** University articles (`/university/<slug>`), never to itself.
- **≥ 1** in-body link to a money / conversion page, where **at least one** money link is specifically to `/audit` **or** `/hosting` (the priority money pages). `/deal-analyzer`, `/calculator`, `/review` count as money pages but do **not** satisfy the priority requirement on their own.

## True article count

**32 article objects** in the `ARTICLES` array (the context brief's "12 articles" was inaccurate). Every one is covered below.

## How the counts were computed

`app/university/[slug]/page.tsx` runs `addInternalLinks(content)` at render time. It auto-injects a link for the **first** occurrence of each phrase in a fixed phrase→href map (e.g. `"profitability audit"→/audit`, `"network difficulty"→/university/what-is-network-difficulty`, `"hosting provider"→/hosting`), but only if that phrase literally appears and the target href isn't already linked in the content.

So the counts below are **effective / rendered** links = explicit `<a href>` already in the content **plus** whatever the auto-linker injects. Columns:

- **explicit** = cross-article `/university/` links hard-coded in the `content` string (excluding self).
- **effective cross** = cross-article links after the auto-linker runs (excluding self).
- **priority money** = at least one rendered link to `/audit` or `/hosting` (Y/N).

A self-link column note: the auto-linker injects a link to an article's **own** slug whenever the article contains its own topic phrase (e.g. "immersion cooling" inside `air-vs-hydro-vs-immersion-cooling`). Those self-links are a pre-existing behavior of `page.tsx` (not owned by this pass) and are excluded from all cross-article counts. No link *added by this pass* is a self-link.

## BEFORE

| slug | explicit cross | effective cross | priority money (/audit or /hosting) | pass? |
|---|---|---|---|---|
| is-bitcoin-mining-profitable-2026 | 4 | 7 | Y | PASS |
| air-vs-hydro-vs-immersion-cooling | 1 | 3 | Y | PASS |
| how-to-calculate-bitcoin-mining-profitability | 3 | 4 | Y | PASS |
| best-bitcoin-miners-2026 | 2 | 7 | Y | PASS |
| bitcoin-mining-hosting-guide | 1 | 2 | Y | PASS |
| bitcoin-mining-taxes | 0 | 1 | Y | **FAIL** (cross < 2) |
| bitcoin-halving-effect-on-mining | 1 | 3 | Y | PASS |
| what-is-network-difficulty | 1 | 3 | Y | PASS |
| mining-financing-options | 1 | 1 | Y | **FAIL** (cross < 2) |
| antminer-s21-pro-review | 3 | 5 | Y | PASS |
| mining-pool-comparison | 1 | 2 | Y | PASS |
| hosted-vs-home-mining | 0 | 0 | Y | **FAIL** (cross < 2) |
| mining-contract-red-flags | 0 | 1 | Y | **FAIL** (cross < 2) |
| what-is-hashprice | 1 | 3 | Y | PASS |
| bitcoin-mining-for-beginners | 5 | 9 | Y | PASS |
| antminer-vs-whatsminer | 1 | 3 | Y | PASS |
| mining-at-scale | 3 | 7 | Y | PASS |
| future-of-bitcoin-mining | 2 | 5 | Y | PASS |
| mining-breakeven-calculator | 1 | 5 | Y | PASS |
| bitcoin-mining-insurance | 1 | 3 | Y | PASS |
| what-is-bitcoin-mining | 1 | 3 | Y | PASS |
| is-bitcoin-mining-profitable | 0 | 2 | Y | PASS |
| hosted-bitcoin-mining-explained | 1 | 4 | Y | PASS |
| how-to-calculate-bitcoin-mining-roi | 0 | 3 | N | **FAIL** (no priority money) |
| bitcoin-mining-electricity-costs | 0 | 2 | Y | PASS |
| best-bitcoin-miners-for-beginners | 0 | 4 | Y | PASS |
| bitcoin-mining-hosting-red-flags | 0 | 3 | Y | PASS |
| asic-miner-efficiency-explained | 0 | 2 | N | **FAIL** (no priority money) |
| mining-pool-fees-explained | 0 | 1 | Y | **FAIL** (cross < 2) |
| home-mining-vs-hosted-mining | 0 | 1 | Y | **FAIL** (cross < 2) |
| bitcoin-mining-tax-basics | 0 | 1 | Y | **FAIL** (cross < 2) |
| how-to-avoid-bad-mining-deals | 1 | 2 | Y | PASS |

**9 articles failed** and needed edits: bitcoin-mining-taxes, mining-financing-options, hosted-vs-home-mining, mining-contract-red-flags, how-to-calculate-bitcoin-mining-roi, asic-miner-efficiency-explained, mining-pool-fees-explained, home-mining-vs-hosted-mining, bitcoin-mining-tax-basics.

## AFTER

| slug | effective cross | priority money (/audit or /hosting) | pass? |
|---|---|---|---|
| is-bitcoin-mining-profitable-2026 | 7 | Y | PASS |
| air-vs-hydro-vs-immersion-cooling | 3 | Y | PASS |
| how-to-calculate-bitcoin-mining-profitability | 4 | Y | PASS |
| best-bitcoin-miners-2026 | 7 | Y | PASS |
| bitcoin-mining-hosting-guide | 2 | Y | PASS |
| bitcoin-mining-taxes | 2 | Y | PASS |
| bitcoin-halving-effect-on-mining | 3 | Y | PASS |
| what-is-network-difficulty | 3 | Y | PASS |
| mining-financing-options | 2 | Y | PASS |
| antminer-s21-pro-review | 5 | Y | PASS |
| mining-pool-comparison | 2 | Y | PASS |
| hosted-vs-home-mining | 2 | Y | PASS |
| mining-contract-red-flags | 2 | Y | PASS |
| what-is-hashprice | 3 | Y | PASS |
| bitcoin-mining-for-beginners | 9 | Y | PASS |
| antminer-vs-whatsminer | 3 | Y | PASS |
| mining-at-scale | 7 | Y | PASS |
| future-of-bitcoin-mining | 5 | Y | PASS |
| mining-breakeven-calculator | 5 | Y | PASS |
| bitcoin-mining-insurance | 3 | Y | PASS |
| what-is-bitcoin-mining | 3 | Y | PASS |
| is-bitcoin-mining-profitable | 2 | Y | PASS |
| hosted-bitcoin-mining-explained | 4 | Y | PASS |
| how-to-calculate-bitcoin-mining-roi | 3 | Y | PASS |
| bitcoin-mining-electricity-costs | 2 | Y | PASS |
| best-bitcoin-miners-for-beginners | 4 | Y | PASS |
| bitcoin-mining-hosting-red-flags | 3 | Y | PASS |
| asic-miner-efficiency-explained | 2 | Y | PASS |
| mining-pool-fees-explained | 2 | Y | PASS |
| home-mining-vs-hosted-mining | 2 | Y | PASS |
| bitcoin-mining-tax-basics | 2 | Y | PASS |
| how-to-avoid-bad-mining-deals | 2 | Y | PASS |

**All 32 articles now meet ≥ 2 cross-article links AND ≥ 1 priority money link (/audit or /hosting).** No broken internal links (every target slug exists in `ARTICLES`); no self-links introduced by this pass.

## Edits made (per article)

Anchor style used everywhere: existing content-string link convention (`<a href="...">natural anchor</a>`; the render layer applies the `text-[#00d4aa] hover:underline` class to auto-links, and these editorial links inherit the article-content link color).

1. **how-to-calculate-bitcoin-mining-roi** — had 3 cross-article links but no priority money link. Added an `/audit` link ("our profitability audit delivers a written analysis within 48 hours") to the closing "Hardware ROI vs Operating ROI" paragraph.
2. **asic-miner-efficiency-explained** — had 2 cross-article links but no priority money link. Added an `/audit` link ("book a profitability audit") to the closing calculator paragraph.
3. **mining-pool-fees-explained** — had 1 cross-article link. Added a cross-link on "hardware efficiency" → `/university/asic-miner-efficiency-explained` in the "How Pool Fees Work" section.
4. **home-mining-vs-hosted-mining** — had 1 cross-article link. Added a cross-link "Bitcoin mining electricity costs" → `/university/bitcoin-mining-electricity-costs` in the closing paragraph.
5. **bitcoin-mining-tax-basics** — had 1 cross-article link. Added a cross-link on "mining at home" → `/university/hosted-vs-home-mining` in the deductible-electricity bullet.
6. **bitcoin-mining-taxes** — had 1 cross-article link. Added a cross-link on "electricity costs" → `/university/bitcoin-mining-electricity-costs` in the "Hosting Fees and Electricity" section.
7. **mining-financing-options** — had 1 cross-article link. Added a cross-link on "ROI and payback period calculations" → `/university/how-to-calculate-bitcoin-mining-roi` in the "Common Mistakes in Mining Financing" list.
8. **hosted-vs-home-mining** — had 0 cross-article links. Added two: "Bitcoin mining electricity costs" → `/university/bitcoin-mining-electricity-costs` in "The Core Economics: Electricity", and "mining ROI guide" → `/university/how-to-calculate-bitcoin-mining-roi` in "The Bottom Line".
9. **mining-contract-red-flags** — had 1 cross-article link. Added a cross-link on "FPPS" → `/university/mining-pool-fees-explained` in "Red Flag #3: No Pool Flexibility".

## Verification

Reproduced by a script that imports `ARTICLES`, replicates `addInternalLinks` exactly, and for each article extracts all rendered `href` values, then checks: effective cross-article count ≥ 2, at least one `/audit`-or-`/hosting` link, no self-link among added links, and every `/university/<slug>` target exists in `ARTICLES`. All 32 pass.
