# LMC desk loop — Stage 1 (alert-only)

Runs on a DigitalOcean Ubuntu 24.04 droplet under `/root/lmc-desk`. Three systemd timers:
- `lmc-price-check` every 15 min — live prices vs `desk_triggers`, logs to `desk_alert_log`, pushes via ntfy
- `lmc-wake` hourly at :07 — headless Claude Code reasoning wake (one web search), writes `pa_memory.loop-briefs`, pushes ORDER SPEC / situation
- `lmc-heartbeat` 08:00 Denver — flushes the overnight digest (quiet hours 23:00–08:00), heartbeat push, `pa_memory.loop-heartbeat`

Hard caps in code: monthly API spend cap (`MONTHLY_CAP_USD`, default $30 — halts wakes, pages once); kill switch `desk_config.loop_enabled`
(one-tap toggle on the terminal's ROBINHOOD tab); 5% intraday drawdown vs last banked snapshot → no new-entry briefs + urgent page.
**Nothing in Stage 1 places, cancels, or modifies orders.**

## Install (Jacob, ~5 minutes)
1. Create the droplet with your SSH key (`~/.ssh/id_ed25519.pub` on the Mac) so no root password is ever typed anywhere.
2. `ssh root@<IP>` → `mkdir -p /root/lmc-desk` → copy this directory in: from the Mac, `scp -r desk-loop/* root@<IP>:/root/lmc-desk/`
3. On the box: `cd /root/lmc-desk && cp .env.example .env && nano .env` — paste the Supabase service key and Anthropic API key **here, in your own terminal**. Save.
4. `bash install.sh` — installs deps + Claude Code, enables timers, runs a smoke test.
5. Watch the first hour: `journalctl -u lmc-wake -f`, and the ROBINHOOD tab's watcher feed.

Secrets live only in `/root/lmc-desk/.env` (chmod 600). They are never committed, echoed, or pasted into chat.
