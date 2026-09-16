# Who teaches what — measured, not impressionistic

**Method:** mechanical pattern scan over every fetched transcript from the three presenter
playlists, normalised per video scanned. Measured 2026-09-16.

**Denominator, stated:** roughly half of each playlist is fetched so far. Doops 523 of 981
(53.3%), Sniper 514 of 909 (56.5%), Ran 512 of 1,124 (45.6%). The comparison is between
three similarly-sized, similarly-sampled halves, not between complete archives, and the
unfetched half could move these numbers. It will be re-run at full coverage.

**What a hit is:** a pattern matched at a timestamp — "somebody says something stop-shaped
41 minutes in". It is a pointer worth reading. It is *not* evidence that a rule was stated,
and none of the numbers below claim otherwise. What they measure is **how much of each
presenter's airtime is spent in each register**, which is a different and answerable
question.

## Share of scanned videos containing the language at all

| | Kyle Doops | Sheldon ("Sniper") | Ran |
|---|---|---|---|
| Stop / invalidation | **85.7%** | 72.2% | **17.2%** |

Doops raises a stop in roughly six of every seven episodes. Ran raises one in about one in
six. That is a 5x difference in how often the idea comes up at all, across ~1,550 videos.

## Hit rate per 1,000 videos scanned, by register

| Category | Sniper | Doops | Ran |
|---|---|---|---|
| leverage | 6,377 | 5,484 | 5,213 |
| **stop / invalidation** | **5,498** | 3,447 | **383** |
| **regime** | 1,969 | 3,168 | **5,227** |
| entry | **1,049** | 231 | 334 |
| **exit / target** | 621 | **809** | 141 |
| **position size** | **307** | 229 | **66** |
| **avoid trading** | 163 | **304** | 115 |
| **hedge / disclaimer** | 125 | 140 | **232** |

## What it says

**Sheldon is the risk engine.** Highest on stops, highest on position size, highest on
entries, lowest on hedging. Every `PRECISE_AND_TESTABLE` method extracted so far came from
him, and this says that was not sampling luck — it is where the mechanical content is.

**Doops is the exit and the no-trade.** Leads on exit/target and on reasons to stay out,
and raises a stop more often than anyone. Lowest on entries: he talks about what to do with
a position far more than about opening one.

**Ran is the regime.** Highest regime language by a wide margin, lowest stop, lowest size,
lowest exit. He is describing the weather, not the trade — which is a legitimate and
separable job, and it is the job the other two do least.

**Ran also hedges most** — roughly twice Sniper's rate of "not financial advice", "I could
be wrong", "just my opinion". The owner's steer that they joke around and should be taken
with salt is measurable, and it is *most* applicable to the presenter whose calls are least
accompanied by a stop.

## Consequence for building a strategy out of all three

The registers barely overlap, so they compose rather than compete:

- **Ran → regime filter.** Which environment are we in, and is it risk-on. Not a trade.
- **Sheldon → sizing and invalidation.** Leverage solved from stop distance, capital at
  risk capped, position as a small fraction of a dedicated bucket. All arithmetic, all
  testable against price history without reading a chart.
- **Doops → exit and abstention.** When to take it off, and when there is no trade.

The gap none of them closes in words is the **entry level itself**, which is drawn on a
chart in all three cases. That stays unresolved until frame reading is real, and no volume
of transcripts changes it.

## What would falsify this

- Re-running at full playlist coverage moves the stop percentages by more than a few points.
- Reading a sample of Ran's 17% shows his stops are *more* specific than Sniper's, just
  rarer — in which case frequency was the wrong measure.
- The `stop_invalidation` patterns are catching a Doops verbal tic rather than a rule. The
  85.7% figure is share-of-videos-with-any-hit, which one habitual phrase could dominate.
  Not yet checked, and it is the most likely way this table is wrong.
