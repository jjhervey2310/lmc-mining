# LMC desk loop — Stage 1 (alert-only)

**Operating reference: [`docs/`](docs/)** — [rule → code map](docs/RULES-TO-CODE.md) · [deploy runbook](docs/DEPLOY.md) · [changelog](docs/CHANGELOG.md) · [incidents](docs/INCIDENTS.md)

Runs on a DigitalOcean Ubuntu 24.04 droplet under `/root/lmc-desk`. systemd timers (all Denver time):
- `lmc-price-check` every 15 min — live prices vs `desk_triggers`, logs to `desk_alert_log`, pushes via ntfy (free)
- `lmc-trail` :05/:20/:35/:50 — `trail.py` v3: constitution v4/v4.1 trail + ratchet + third + rotation + reclaim + flush flags (free)
- `lmc-wake` hourly at :07 — `triage.py`, pure code; escalates to `lmc-wake-deep` only on something mechanical (free)
- `lmc-wake-deep` 07:07 + on escalation — headless Claude Code reasoning wake (one web search), writes `pa_memory.loop-briefs` (paid, budget-gated)
- `lmc-breakout` 06:45 — 20d-high + volume + RS breakout scan over `universe.json`, `pa_memory.breakout-signals` (free)
- `lmc-flow` 07:20 — `flow_scan.py` (build request #8): DefiLlama fees / revenue / DEX volume / TVL / stablecoin flows per RH name → `public.flow_radar`, `pa_memory.flow-radar`; PRE-EARLY names pushed + added to `desk_theses` as VERIFYING. Daily = held + POLE/WATCH/VERIFYING; Sunday (or `--full`) = whole universe (free)
- `lmc-news` 07:40 — universe news sweep, top-10 daily / top-40 Sunday (paid, budget-gated)
- `lmc-heartbeat` 08:00 — flushes the overnight digest (quiet hours 23:00–08:00), heartbeat push, `pa_memory.loop-heartbeat`
- `lmc-stage-study` 08:20 — does yesterday's radar label predict today's move (free)

`universe.json` = Robinhood-tradable names from `get_currency_pairs` (87 as of 2026-09-06; PUMP delisted, POL untradable, stables/gold excluded). The box cannot call the Robinhood connector — refresh it from a chat session weekly (topic `rh-universe`).

Hard caps in code: monthly API spend budget — `desk_config.loop_budget_usd` (currently $10) is the single source, read by both `common.budget_status()` (the wake gate: `min(budget, max(wake_min_usd, wake_budget_pct% of book))`) and `common.add_spend()` (the halt file + one page). `LOOP_BUDGET_USD`/`MONTHLY_CAP_USD` in `.env` are Supabase-outage fallbacks only; kill switch `desk_config.loop_enabled`
(one-tap toggle on the terminal's ROBINHOOD tab); 5% intraday drawdown vs last banked snapshot → no new-entry briefs + urgent page.
**Nothing in Stage 1 places, cancels, or modifies orders.**

## Install (Jacob, ~5 minutes)
1. Create the droplet with your SSH key (`~/.ssh/id_ed25519.pub` on the Mac) so no root password is ever typed anywhere.
2. `ssh root@<IP>` → `mkdir -p /root/lmc-desk` → copy this directory in: from the Mac, `scp -r desk-loop/* root@<IP>:/root/lmc-desk/`
3. On the box: `cd /root/lmc-desk && cp .env.example .env && nano .env` — paste the Supabase service key and Anthropic API key **here, in your own terminal**. Save.
4. `bash install.sh` — installs deps + Claude Code, enables timers, runs a smoke test.
5. Watch the first hour: `journalctl -u lmc-wake -f`, and the ROBINHOOD tab's watcher feed.

Secrets live only in `/root/lmc-desk/.env` (chmod 600). They are never committed, echoed, or pasted into chat.

## Deploying a code change to the box (from the Mac, key auth)
```
scp desk-loop/*.py desk-loop/*.sh desk-loop/*.md desk-loop/universe.json root@209.97.150.226:/root/lmc-desk/
scp desk-loop/systemd/* root@209.97.150.226:/etc/systemd/system/
ssh root@209.97.150.226 'cd /root/lmc-desk && systemctl daemon-reload && for t in systemd/*.timer; do systemctl enable --now $(basename $t); done && python3 -m py_compile *.py && python3 trail.py && python3 flow_scan.py && systemctl list-timers "lmc-*" --no-pager'
```
`flow_scan.py --full` forces a whole-universe scan on any day.

## A9 in the loop (2026-09-06, build request #9)
`trail.py` v4: anchor = 30% catastrophe trail from the highest completed close (no x0.90 ratchet); sleeve 18% → 25% past +50%; no take-profit flag below +50%. `common.sleeve_breaker()` replaces the whole-book 5% halt: the deep wake stops proposing entries only when the SLEEVE mark/cost ratio is 20% under its high-water mark (state/sleeve_breaker.json; delete to clear). `breakout_scan.py` prints the REGIME (BTC vs 50d/200d from state/cb/BTC.json, or `desk_config.regime`) and applies the chase bars only outside BULL (+15% day = HALF size in BULL). `backtest_a9.py` writes the A9 grid to `pa_memory.backtest-results-a9`.

## A11 in the loop (2026-09-10)
`trail.py` stop-presence screen is narrowed, not deleted: `common.resting_stop_required()` is the one place that
knows the anchor list (`ANCHOR_SYMS`) and the A11 §3 threshold (`ANCHOR_STANDING_TRAIL_USD = $5,000`). BTC and SOL
carry no resting stop by design while the book is under $5,000 (protection is condition-triggered — the
`derisk_watch` rows in `desk_triggers`; primary trigger: a weekly close below the 20-week MA). Every non-anchor
position still alerts `kind='nostop'` when it has no stop row, and the anchor starts alerting again the moment the
book reaches $5,000. If the book cannot be valued the screen fails loud and requires a stop everywhere.
NOT IMPLEMENTED IN CODE: the 20-week-MA condition itself (A11 §5's monitoring obligation) — it is still a
session/desk check, not a loop check.
