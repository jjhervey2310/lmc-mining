# Deploying a desk-loop change

The loop runs on the droplet (`root@209.97.150.226:/root/lmc-desk`), reachable **only over SSH from the Mac**.
A Claude Code web/cloud session can write and test the code and open the PR, but it cannot reach the box —
outbound SSH is blocked there. The scp step is always yours.

## 1. Deploy (Mac, ~30 seconds)

```bash
cd ~/Desktop/lmc-mining && git pull
scp desk-loop/*.py desk-loop/*.sh desk-loop/*.md desk-loop/universe.json root@209.97.150.226:/root/lmc-desk/
scp desk-loop/systemd/* root@209.97.150.226:/etc/systemd/system/     # only when a timer changed
ssh root@209.97.150.226 'cd /root/lmc-desk && systemctl daemon-reload && python3 -m py_compile *.py && python3 trail.py && python3 price_check.py'
```

The two scripts at the end are the smoke test. Expect a line like `3 positions, nothing due` from `trail.py`
and `checked N triggers, 0 fired` from `price_check.py`. A traceback means **do not walk away** — the timers
will run that same broken file every 15 minutes.

## 2. Prove the timers are alive

```bash
ssh root@209.97.150.226 'systemctl list-timers "lmc-*" --no-pager; systemctl --failed --no-pager'
ssh root@209.97.150.226 'journalctl -u lmc-price-check -u lmc-trail --since "1 hour ago" --no-pager | tail -40'
ssh root@209.97.150.226 'ls -l /root/lmc-desk/state/last_price_check /root/lmc-desk/state/last_trail'
```

`state/last_price_check` is written **only on a clean run**. If its mtime is older than 15 minutes, the sweep is
crashing — that is the tell that caught the 2026-09-10 incident. Same for `state/last_trail`.

## 3. Prove it in the data (works from anywhere, no SSH)

`cron.job_run_details` and a "succeeded" systemd exit both lie about outcomes. **Check the target table.**

```sql
-- A11: no nostop alerts for the anchors; non-anchors still able to alert
select at, symbol, kind, note from desk_alert_log
where kind = 'nostop' and at > now() - interval '6 hours' order by at desc;

-- the 15-minute sweep is actually reaching every row
select max(at) as last_price_check_alert from desk_alert_log
where kind in ('stop','bid','rung','deep_rung','trail_high','target','breakout');

-- what the loop has been saying
select at, symbol, kind, level, price, note from desk_alert_log order by at desc limit 20;
select topic, updated_at, left(fact, 400) from pa_memory where source = 'desk-loop' order by updated_at desc;
```

## 4. Rollback

Every change ships as one commit on a `claude/*` branch with a PR. To undo:

```bash
git revert <sha> && git push
```

then re-run step 1. There is no build step and no migration — the droplet runs whatever `.py` files are sitting
in `/root/lmc-desk`, so a revert plus one scp is a complete rollback.

## Never

- Never schedule desk-loop work in `vercel.json`. The website's jobs are **Supabase `pg_cron`**; the desk loop is
  **systemd timers on the droplet**. Two different machines.
- Never edit `.py` files directly on the box. The repo is the source of truth; an edit made only on the droplet is
  silently overwritten by the next scp.
- Never put a secret in the repo. They live in `/root/lmc-desk/.env` (chmod 600), typed on the box, never echoed.
- Never change a value in `desk_config` by editing `.env` instead. `.env` holds fallbacks for a Supabase outage;
  the config table is what the loop obeys.
