// Liverpool FC data for the terminal's LFC page.
//
// Everything here is free and keyless: TheSportsDB's open tier for fixtures,
// results and the table; public RSS for news. Nothing to rotate, nothing to bill.

const TEAM_ID = '133602' // Liverpool FC
const SDB = 'https://www.thesportsdb.com/api/v1/json/3'
const LEAGUE_ID = '4328' // English Premier League

export interface Fixture {
  id: string
  event: string
  opponent: string
  home: boolean
  date: string | null
  timestamp: string | null
  venue: string | null
  homeScore: number | null
  awayScore: number | null
  league: string | null
}

export interface TableRow {
  rank: number
  team: string
  played: number
  win: number
  draw: number
  loss: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  badge: string | null
  isLiverpool: boolean
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  link: string
  published: string | null
  source: string
  /** transfer-flavoured headlines get pinned to the top of the column */
  transfer: boolean
  /** 1 = national/tier-1 desk, 2 = dedicated LFC desk, 3 = aggregator/rumour mill.
   *  Transfer news lives or dies on who is reporting it, so this is shown. */
  tier: 1 | 2 | 3
  /** the story cites Fabrizio Romano — the closest thing to a confirmation */
  romano: boolean
}

const j = async (url: string, revalidate = 300) => {
  const res = await fetch(url, { next: { revalidate }, headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

interface SdbEvent {
  idEvent: string; strEvent: string; strHomeTeam: string; strAwayTeam: string
  dateEvent: string | null; strTimestamp: string | null; strVenue: string | null
  intHomeScore: string | null; intAwayScore: string | null; strLeague: string | null
}

function toFixture(e: SdbEvent): Fixture {
  const home = e.strHomeTeam === 'Liverpool'
  return {
    id: e.idEvent,
    event: e.strEvent,
    opponent: home ? e.strAwayTeam : e.strHomeTeam,
    home,
    date: e.dateEvent,
    timestamp: e.strTimestamp,
    venue: e.strVenue,
    homeScore: e.intHomeScore != null ? Number(e.intHomeScore) : null,
    awayScore: e.intAwayScore != null ? Number(e.intAwayScore) : null,
    league: e.strLeague,
  }
}

export async function getFixtures(): Promise<{ next: Fixture[]; last: Fixture[] }> {
  const [n, l] = await Promise.all([
    j(`${SDB}/eventsnext.php?id=${TEAM_ID}`).catch(() => null),
    j(`${SDB}/eventslast.php?id=${TEAM_ID}`).catch(() => null),
  ])
  return {
    next: ((n?.events ?? []) as SdbEvent[]).map(toFixture),
    last: ((l?.results ?? []) as SdbEvent[]).map(toFixture),
  }
}

export async function getTable(season = '2026-2027'): Promise<TableRow[]> {
  const d = await j(`${SDB}/lookuptable.php?l=${LEAGUE_ID}&s=${season}`, 900).catch(() => null)
  const rows = (d?.table ?? []) as Record<string, string>[]
  return rows.map((r) => ({
    rank: Number(r.intRank),
    team: r.strTeam,
    played: Number(r.intPlayed),
    win: Number(r.intWin),
    draw: Number(r.intDraw),
    loss: Number(r.intLoss),
    goalsFor: Number(r.intGoalsFor),
    goalsAgainst: Number(r.intGoalsAgainst),
    goalDiff: Number(r.intGoalDifference),
    points: Number(r.intPoints),
    badge: r.strBadge || null,
    isLiverpool: r.strTeam === 'Liverpool',
  }))
}

// ── news ──

// `club: false` feeds cover every club, so they are filtered to Liverpool below.
const FEEDS: { url: string; source: string; tier: 1 | 2 | 3; club: boolean }[] = [
  { url: 'https://www.theguardian.com/football/liverpool/rss', source: 'The Guardian', tier: 1, club: true },
  { url: 'https://www.skysports.com/rss/11669', source: 'Sky Sports', tier: 1, club: true },
  { url: 'https://www.bbc.co.uk/sport/football/gossip/rss.xml', source: 'BBC Gossip', tier: 1, club: false },
  { url: 'https://www.liverpoolecho.co.uk/all-about/liverpool-fc/?service=rss', source: 'Liverpool Echo', tier: 2, club: true },
  { url: 'https://www.thisisanfield.com/feed/', source: 'This Is Anfield', tier: 2, club: true },
  { url: 'https://www.caughtoffside.com/feed/', source: 'CaughtOffside', tier: 3, club: false },
]

/** Fabrizio Romano is the market's de-facto confirmation — badge any story citing him. */
const ROMANO_RE = /fabrizio romano|romano|here we go/i
/** Used to keep only Liverpool items out of the all-club feeds. */
const LFC_RE = /liverpool|anfield|\bLFC\b|klopp|slot|salah|van dijk|alisson|szoboszlai|mac allister|gakpo|konate|alexander-arnold|jota|nunez|elliott|gravenberch|kelleher|quansah|bradley|endo|chiesa|kop\b/i

const TRANSFER_WORDS = /transfer|signing|sign(s|ed|ing)?\b|bid|fee|deal|medical|move|linked|target|swoop|exit|loan|contract|release clause|agent|talks|£\d|€\d/i

/** Strip tags and unescape the handful of entities RSS actually uses. */
function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&(apos|#39);/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const pick = (block: string, tag: string): string => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? clean(m[1]) : ''
}

async function readFeed(url: string, source: string, tier: 1 | 2 | 3, clubOnly: boolean): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 600 }, headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
    return items.slice(0, 15).map((block, i) => {
      const title = pick(block, 'title')
      const summary = pick(block, 'description').slice(0, 400)
      const hay = `${title} ${summary}`
      return {
        id: `${source}-${i}-${title.slice(0, 40)}`,
        title,
        summary,
        link: pick(block, 'link') || (block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? ''),
        published: pick(block, 'pubDate') || null,
        source,
        transfer: TRANSFER_WORDS.test(hay),
        tier,
        romano: ROMANO_RE.test(hay),
      }
    })
    // An all-club feed is only useful here when the item is actually about us.
    .filter((n) => n.title && n.link && (clubOnly || LFC_RE.test(`${n.title} ${n.summary}`)))
  } catch {
    return []
  }
}

export async function getNews(): Promise<NewsItem[]> {
  const all = (await Promise.all(FEEDS.map((f) => readFeed(f.url, f.source, f.tier, f.club)))).flat()
  // Drop the same story arriving from two feeds.
  const seen = new Set<string>()
  const unique = all.filter((n) => {
    const k = n.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // Newest first, then Romano-cited above the rest, then transfers above general news.
  const ts = (n: NewsItem) => (n.published ? new Date(n.published).getTime() : 0)
  return unique
    .sort((a, b) => ts(b) - ts(a))
    .sort((a, b) => Number(b.romano) - Number(a.romano))
    .sort((a, b) => Number(b.transfer) - Number(a.transfer))
    .slice(0, 40)
}

// ── Fabrizio Romano's X feed ──
//
// Romano is the market's confirmation and Jacob asked for him specifically. X
// has no free API, so this reads his public posts through a Nitter mirror. That
// is best-effort by nature: mirrors get blocked, so every failure returns an
// empty list and the page simply carries on without him.

const NITTER_MIRRORS = [
  'https://nitter.net/FabrizioRomano/rss',
  'https://nitter.poast.org/FabrizioRomano/rss',
  'https://nitter.privacydev.net/FabrizioRomano/rss',
]

export interface RomanoPost {
  id: string
  text: string
  link: string
  published: string | null
  /** mentions Liverpool or one of ours */
  lfc: boolean
}

export async function getRomano(): Promise<RomanoPost[]> {
  for (const url of NITTER_MIRRORS) {
    try {
      const res = await fetch(url, { next: { revalidate: 600 }, headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) continue
      const xml = await res.text()
      const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
      const posts = items.slice(0, 30).map((block, i) => {
        const text = pick(block, 'title')
        return {
          id: `romano-${i}-${text.slice(0, 30)}`,
          text,
          // Point at X itself, not the mirror — mirrors die, x.com does not.
          link: (pick(block, 'link') || '').replace(/https?:\/\/[^/]+/, 'https://x.com'),
          published: pick(block, 'pubDate') || null,
          lfc: LFC_RE.test(text),
        }
      }).filter((p) => p.text)
      if (posts.length) return posts
    } catch {
      // try the next mirror
    }
  }
  return []
}
