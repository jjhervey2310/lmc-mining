# desk-loop/docs — the desk loop's operating reference

Four files. Read them in this order the first time.

| File | What it answers |
|---|---|
| [`RULES-TO-CODE.md`](RULES-TO-CODE.md) | "The constitution says X — where is X actually enforced?" One row per rule, with the file, function and constant. Also lists what is **not** in code. |
| [`DEPLOY.md`](DEPLOY.md) | How a code change gets from this repo onto the droplet, and the exact queries that prove it worked. |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed in the loop, when, and why. Newest first. |
| [`INCIDENTS.md`](INCIDENTS.md) | Things that were silently broken in production, how they were found, and what stops a repeat. |

Three rules for this folder:

1. **The code is the law, this folder is the map.** If they disagree, the code is what runs — fix the map in the same commit.
2. **A rule that lives only in `pa_memory` is not enforced.** The desk reads memory; the loop runs code. `RULES-TO-CODE.md` marks that gap explicitly, per rule.
3. **`pg_cron` schedules the website's jobs; `systemd` timers schedule the desk loop.** They are different machines. Never put desk-loop scheduling in `vercel.json`.
