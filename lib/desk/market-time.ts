// MARKET-TIME RULES — the one place that decides which bars a signal may see (TypeScript side;
// desk-loop/market_time.py is the Python twin and the two must agree).
//
// System rule: a signal evaluated at decision time T may use only bars that COMPLETED before T.
// Bar timestamps are UTC epoch milliseconds of the bar's OPEN; a bar of length L is complete once
// t + L <= T. Joins between series are by timestamp, never by array index.

export const DAY_MS = 86_400_000

export class LookAheadError extends Error {
  constructor(message: string) { super(message); this.name = 'LookAheadError' }
}

export interface Bar { t: number }

/** Bars whose close time is <= asOf (default now). Never mutates the input. */
export function completedBars<B extends Bar>(bars: B[], asOf: number = Date.now(), barMs = DAY_MS): B[] {
  return bars.filter((b) => b.t + barMs <= asOf)
}

/** Index of the last bar completed at asOf, or -1. */
export function lastCompletedIndex(bars: Bar[], asOf: number, barMs = DAY_MS): number {
  for (let k = bars.length - 1; k >= 0; k--) if (bars[k].t + barMs <= asOf) return k
  return -1
}

/** Index in `series` of the bar opening at or before t — a timestamp join. Throws if asOf is given and
 *  that bar had not completed by then. Returns -1 when nothing precedes t. */
export function alignIndex(series: Bar[], t: number, opts: { asOf?: number; barMs?: number } = {}): number {
  const barMs = opts.barMs ?? DAY_MS
  for (let k = series.length - 1; k >= 0; k--) {
    if (series[k].t <= t) {
      if (opts.asOf != null && series[k].t + barMs > opts.asOf) throw new LookAheadError(`bar t=${series[k].t} not complete at asOf=${opts.asOf}`)
      return k
    }
  }
  return -1
}

/** Guard for the decision point: the bar a signal fires on must have closed before the decision. */
export function assertCompleted<B extends Bar>(bar: B, asOf: number, barMs = DAY_MS): B {
  if (bar.t + barMs > asOf) throw new LookAheadError(`signal bar t=${bar.t} closes after decision time ${asOf}`)
  return bar
}

/** CoinGecko-style daily series ([ts, value] or [ts, value, vol]) end with today's partial point.
 *  Drop every point whose day has not closed in UTC. */
export function completedDailyPoints<P extends [number, ...number[]]>(points: P[], asOf: number = Date.now()): P[] {
  return points.filter((p) => Math.floor(p[0] / DAY_MS) * DAY_MS + DAY_MS <= asOf)
}

/** Monday 00:00 America/Denver as an ISO instant, DST-aware. Replaces the fixed -6h offset that was
 *  wrong for the seven MDT months of the year. */
export function denverWeekStartIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'))
  const localMidnightUtc = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')))
  // Denver wall clock minus UTC at this instant gives the current offset.
  const wallMs = localMidnightUtc + (Number(get('hour')) * 60 + Number(get('minute'))) * 60e3
  const offsetMs = wallMs - Math.floor(now.getTime() / 60e3) * 60e3
  return new Date(localMidnightUtc - dow * DAY_MS - offsetMs).toISOString()
}
