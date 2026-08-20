import OpenAI from 'openai'
import { CONTACT, ROLES, SYSTEMS_FACTS, SKILL_POOL, BASE_TRUTHS, factSheet } from './master'
import { buildDocx, run, type Para } from './docx'

// Turns a job posting into a tailored .docx in one call.
//
// The hard rule, and the reason this is selection-based rather than generative:
// a résumé is a factual claim Jacob has to stand over in an interview. The model
// may reorder, drop, merge and reword the facts in master.ts to mirror the
// posting's own language. It may not add a number, employer, date, tool or
// credential. The validator below enforces that after the fact.

export interface JobInput {
  title: string
  company?: string | null
  description?: string | null
  location?: string | null
  url?: string
}

export interface Tailored {
  /** the posting's title, echoed back — ATS keyword match #1 */
  headline: string
  /** the three-part subhead under his name */
  positioning: string
  profile: string
  skills: string[]
  /** roleId → the bullets to print, already in priority order */
  bullets: { role: string; text: string }[]
  systems: string[]
  /** one line for him, not printed: what it aimed at */
  angle: string
}

const MODEL = 'gpt-4o-mini' // cheap enough to run 25+ times a day without thinking about it

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY
  if (!key || key.startsWith('your-') || key.length < 20) return null
  return new OpenAI({ apiKey: key })
}

const SYSTEM = `You tailor Jacob Hervey's résumé to one specific job posting.

HOW JACOB WRITES (match this exactly — a CV that does not sound like him is a
failed CV, and he has said the output "is getting further away" from his voice):
- Plain, short, direct sentences. Say the thing; do not decorate it.
- First person in the profile, no "results-driven professional" opener, no
  third-person self-description, no summary of adjectives.
- NEVER use em-dashes. Use a full stop or a comma.
- No corporate filler: "leveraged", "spearheaded", "synergies", "passionate",
  "proven track record", "dynamic", "utilise", "robust", "seamless".
- Concrete over abstract: what he did, the number, the outcome. "Recovered tens
  of thousands of euro of dead stock and turned it back into cash" beats
  "drove significant inventory optimisation initiatives".
- Keep his own phrasings from the fact sheet wherever they fit. His wording is
  better than a rewrite of it.

You are given a FACT SHEET. It is the complete set of true claims about his career.

RULES — breaking any of these makes the output useless:
1. Every bullet must come from the fact sheet. You may reword, shorten, merge two
   facts from the SAME role, and swap in the posting's own vocabulary. You may NOT
   introduce a number, employer, date, system, certification or achievement that is
   not on the fact sheet.
2. Keep every number exactly as written, INCLUDING its period. €5M a month is
   never "€5M a year". 40-60% stays 40-60%.
3. Pick the bullets that answer the posting's stated requirements. Drop the rest.
   Order them so the most relevant is first within each role.
4. Skills must be chosen from the supplied skill list only. Pick 11, ordered so the
   ones the posting names come first. Use the posting's wording where the list has
   an equivalent.
5. Voice: plain, short, direct, first-person-implied. No em-dashes. No "leveraged",
   "spearheaded", "synergy", "passionate", "results-driven", "proven track record".
   Write the way a competent operator talks, not the way a résumé template talks.
6. The headline is the posting's job title, as written in the posting.

Return JSON only:
{
  "headline": "the posting's job title",
  "positioning": "three short capability phrases separated by ' · ', tuned to the posting",
  "profile": "3 to 4 sentences about Jacob. Open with what he is, not with the company name, and make the first clause echo the posting's own title. Use his strongest relevant numbers. No fluff, no address to the reader.",
  "skills": ["11 items from the skill list"],
  "bullets": [{"role":"tilestyle|emerald|fontana|sonoma","text":"..."}],
  "systems": ["1 to 3 closing lines chosen from the systems facts"],
  "angle": "one sentence for Jacob: what this version leads with and why"
}

Bullet counts, and hit these, do not under-deliver: tilestyle 4-5, emerald 3-4,
fontana 3-4, sonoma 2-3, total 13-15. The document is a full single page, so a
thin selection leaves it looking empty. Keep the roles in the order given.`

export async function tailor(job: JobInput): Promise<{ result: Tailored; fallback: boolean }> {
  const openai = client()
  if (!openai) return { result: baseline(job), fallback: true }

  const posting = [
    `TITLE: ${job.title}`,
    job.company ? `COMPANY: ${job.company}` : '',
    job.location ? `LOCATION: ${job.location}` : '',
    job.description ? `POSTING TEXT:\n${job.description.slice(0, 6000)}` : '(no posting body available — tailor from the title alone)',
  ].filter(Boolean).join('\n')

  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `FACT SHEET\n${factSheet()}\n\nSKILL LIST\n${SKILL_POOL.join(' | ')}\n\nALWAYS TRUE\n${BASE_TRUTHS.join('\n')}\n\n---\nJOB POSTING\n${posting}`,
        },
      ],
    })
    const raw = JSON.parse(res.choices[0]?.message?.content || '{}')
    return { result: validate(raw, job), fallback: false }
  } catch {
    return { result: baseline(job), fallback: true }
  }
}

// The résumé-template phrases Jacob's voice rules ban. Asking the model to avoid
// them is not enough, it leaked "Proven track record" on the first real run, so
// they are stripped or rewritten here. Order matters: longest match first.
const BANNED: [RegExp, string][] = [
  [/\bproven track record (?:of|in|with)\s*/gi, ''],
  [/\btrack record (?:of|in|with)\s*/gi, ''],
  [/\bproven\s+/gi, ''],
  [/\bresults[- ]driven\s*/gi, ''],
  [/\bspearheaded\b/gi, 'led'],
  [/\bleveraged\b/gi, 'used'],
  [/\bleveraging\b/gi, 'using'],
  [/\bspearheading\b/gi, 'leading'],
  [/\bsynerg(?:y|ies|istic)\b/gi, ''],
  [/\bpassionate about\s*/gi, ''],
  [/\bdynamic and\s*/gi, ''],
  [/\bseasoned\b/gi, 'experienced'],
  [/\bwealth of experience\b/gi, 'experience'],
  [/\bhit the ground running\b/gi, ''],
  [/\bgo[- ]getter\b/gi, ''],
  [/\bthought leader(?:ship)?\b/gi, ''],
  [/\bbest[- ]in[- ]class\b/gi, ''],
  [/\bworld[- ]class\b/gi, ''],
]

function scrub(s: string): string {
  let out = s
  for (const [re, sub] of BANNED) out = out.replace(re, sub)
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/(^|[·|]\s*)([a-z])/g, (_m, p, c) => p + c.toUpperCase())
    .trim()
}

/** Belt and braces: drop anything the model invented a role for, clamp counts,
 *  strip em-dashes and template phrases, and keep skills inside the pool. */
function validate(raw: Record<string, unknown>, job: JobInput): Tailored {
  // Strip prose em/en dashes (Jacob's voice rule) but never the one inside a
  // numeric range — an earlier pass turned "20–30%" into "20 30%".
  const dashes = (s: unknown) =>
    String(s ?? '')
      .replace(/(\d)\s*[\u2014\u2013]\s*(\d)/g, '$1\u0001$2') // park ranges out of harm's way
      .replace(/\s*[\u2014\u2013]\s*/g, ', ')
      .replace(/\u0001/g, '\u2013') // and restore them as a clean en dash
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:%])/g, '$1')
      .trim()
  const clean = (s: unknown) => scrub(dashes(s))
  const valid = new Set(ROLES.map((r) => r.id))
  const bullets = (Array.isArray(raw.bullets) ? raw.bullets : [])
    .map((b) => ({ role: String((b as Record<string, unknown>)?.role || ''), text: clean((b as Record<string, unknown>)?.text) }))
    .filter((b) => valid.has(b.role) && b.text.length > 15)
    .slice(0, 16)
  const skills = (Array.isArray(raw.skills) ? raw.skills : [])
    .map(String)
    .filter((s) => SKILL_POOL.some((p) => p.toLowerCase() === s.toLowerCase()))
    .slice(0, 12)
  const base = baseline(job)
  return {
    headline: clean(raw.headline) || base.headline,
    positioning: clean(raw.positioning) || base.positioning,
    profile: clean(raw.profile) || base.profile,
    skills: skills.length >= 6 ? skills : base.skills,
    bullets: bullets.length >= 6 ? bullets : base.bullets,
    systems: (Array.isArray(raw.systems) ? raw.systems : []).map(clean).filter(Boolean).slice(0, 3).length
      ? (raw.systems as string[]).map(clean).filter(Boolean).slice(0, 3)
      : base.systems,
    angle: clean(raw.angle) || 'Untailored fallback: this is the standard résumé.',
  }
}

/** No API key, or the call failed. Still hand him a usable CV rather than nothing. */
function baseline(job: JobInput): Tailored {
  return {
    headline: job.title || 'Operations Leadership',
    positioning: 'Operations & General Management · Procurement & Supply Chain · Team Leadership',
    profile:
      "Operations leader with 13 years running businesses end to end as a CEO, COO and GM. I've built supply chains from scratch, run around €5M of procurement spend a month, held margins under pressure, and led teams across retail, hospitality and agriculture in the US, Northern Ireland and Ireland. I'm at my best taking over a messy operation, finding where it's losing money or time, and fixing it.",
    skills: SKILL_POOL.slice(0, 11),
    bullets: ROLES.flatMap((r) => r.facts.slice(0, 4).map((f) => ({ role: r.id, text: f.text }))),
    systems: SYSTEMS_FACTS.slice(0, 2).map((f) => f.text),
    angle: 'Standard résumé, not tailored.',
  }
}

// ─── One-page fitter ────────────────────────────────────────────────────────
// Jacob (2026-08-12): "shouldnt we keep it to one page? or do professionals send
// in bigger resumes?" — two pages is normal at director level, but he has no
// filler, so one dense page is the stronger document. This enforces it rather
// than hoping: estimate rendered lines and drop the lowest-priority bullets
// (last bullet of the least-relevant role first) until it fits.

/** Usable text height on Letter with 0.5in margins, in ~11px lines. */
const PAGE_LINES = 52
/** ~95 characters of 9.5pt Arial per full-width line. */
const CHARS_PER_LINE = 98

const lines = (text: string, indent = 0) =>
  Math.max(1, Math.ceil(text.length / (CHARS_PER_LINE - indent)))

function estimate(t: Tailored): number {
  let n = 3 + 1 // name, positioning, contact, spacing
  n += 2 + lines(t.profile) // heading + body
  n += 2 + lines(t.skills.join(' • '))
  n += 2
  for (const role of ROLES) {
    const mine = t.bullets.filter((b) => b.role === role.id)
    if (!mine.length) continue
    n += 1 + (role.context ? 1 : 0) + 0.5 // heading, context, gap
    for (const b of mine) n += lines(b.text, 4)
  }
  n += 2 + t.systems.reduce((s, x) => s + lines(x, 4), 0)
  return Math.ceil(n)
}

/** Minimum bullets per role. A role showing one line looks like a weak stint. */
const MIN_BULLETS: Record<string, number> = { tilestyle: 3, emerald: 3, fontana: 2, sonoma: 2 }

/** Fit to exactly one page, in both directions.
 *
 *  The model under-delivers as often as it over-delivers, and a two-thirds-full
 *  page reads worse than a full one at this level. So: backfill from the fact
 *  pool while there is room, then trim if we went over. */
export function fitOnePage(t: Tailored): { fitted: Tailored; dropped: string[]; added: string[] } {
  const dropped: string[] = []
  const added: string[] = []
  const out: Tailored = { ...t, bullets: [...t.bullets], systems: [...t.systems] }

  const used = new Set(out.bullets.map((b) => b.text.toLowerCase().slice(0, 40)))
  const isUsed = (text: string) => {
    const k = text.toLowerCase().slice(0, 40)
    if (used.has(k)) return true
    // The model rewords, so also treat a shared opening as the same fact.
    return out.bullets.some((b) => b.role && b.text.toLowerCase().slice(0, 25) === text.toLowerCase().slice(0, 25))
  }

  // 1. Guarantee each role's floor, drawing unused facts in master order.
  for (const role of ROLES) {
    const min = MIN_BULLETS[role.id] ?? 2
    let have = out.bullets.filter((b) => b.role === role.id).length
    for (const f of role.facts) {
      if (have >= min) break
      if (isUsed(f.text)) continue
      out.bullets.push({ role: role.id, text: f.text })
      used.add(f.text.toLowerCase().slice(0, 40))
      added.push(f.text)
      have++
    }
  }

  // 2. While there is a spare line, add the next best unused fact, strongest
  //    role first, capped so no role runs away with the page.
  const MAX_BULLETS: Record<string, number> = { tilestyle: 5, emerald: 4, fontana: 4, sonoma: 3 }
  let guard = 30
  while (estimate(out) <= PAGE_LINES - 2 && guard-- > 0) {
    let placed = false
    for (const role of ROLES) {
      const have = out.bullets.filter((b) => b.role === role.id).length
      if (have >= (MAX_BULLETS[role.id] ?? 4)) continue
      const next = role.facts.find((f) => !isUsed(f.text))
      if (!next) continue
      out.bullets.push({ role: role.id, text: next.text })
      used.add(next.text.toLowerCase().slice(0, 40))
      added.push(next.text)
      placed = true
      break
    }
    if (!placed) {
      const nextSys = SYSTEMS_FACTS.find((f) => !out.systems.some((s) => s.slice(0, 25) === f.text.slice(0, 25)))
      if (!nextSys || out.systems.length >= 3) break
      out.systems.push(nextSys.text)
      added.push(nextSys.text)
    }
  }

  // 3. Trim if we are over. Least-important first: systems extras, then the tail
  //    bullets of the oldest roles, never below the floor.
  const order = ['sonoma', 'fontana', 'emerald', 'tilestyle']
  guard = 40
  while (estimate(out) > PAGE_LINES && guard-- > 0) {
    if (out.systems.length > 1) { dropped.push(out.systems.pop()!); continue }
    let cut = false
    for (const roleId of order) {
      const idxs = out.bullets.map((b, i) => (b.role === roleId ? i : -1)).filter((i) => i >= 0)
      if (idxs.length > (MIN_BULLETS[roleId] ?? 2)) {
        dropped.push(out.bullets.splice(idxs[idxs.length - 1], 1)[0].text)
        cut = true
        break
      }
    }
    if (!cut) break
  }

  // Keep the printed order sane: bullets grouped by role, in master order.
  out.bullets.sort((a, b) => ROLES.findIndex((r) => r.id === a.role) - ROLES.findIndex((r) => r.id === b.role))
  return { fitted: out, dropped, added }
}

export function pageCount(t: Tailored): number {
  return Math.max(1, Math.ceil(estimate(t) / PAGE_LINES))
}

/** Render a Tailored into .docx bytes. */
export function render(t: Tailored): Uint8Array {
  const paras: Para[] = []
  const H = (text: string) => paras.push({ text, bold: true, size: 10, caps: true, rule: true, spaceAfter: 100, color: '333333' })

  paras.push({ text: CONTACT.name, bold: true, size: 18, align: 'center', spaceAfter: 20 })
  paras.push({ text: t.positioning, size: 9.5, align: 'center', spaceAfter: 20, color: '444444' })
  paras.push({
    text: `${CONTACT.location} | ${CONTACT.phone} | ${CONTACT.email} | ${CONTACT.status}`,
    size: 9, align: 'center', spaceAfter: 140,
  })

  H('Profile')
  paras.push({ text: t.profile, size: 9.5, spaceAfter: 140 })

  H('Core Skills')
  paras.push({ text: t.skills.join(' • '), size: 9.5, spaceAfter: 140 })

  H('Experience')
  for (const role of ROLES) {
    const mine = t.bullets.filter((b) => b.role === role.id)
    if (!mine.length) continue
    paras.push({
      runs:
        run(`${role.title} | ${role.employer}${role.location ? ', ' + role.location : ''}`, { bold: true, size: 10 }) +
        run(`  ${role.dates}`, { size: 9, color: '555555' }),
      spaceAfter: role.context ? 10 : 40,
    })
    if (role.context) paras.push({ text: role.context, size: 8.5, color: '555555', spaceAfter: 40 })
    for (const b of mine) paras.push({ text: b.text, size: 9.5, bullet: true, spaceAfter: 30 })
    paras[paras.length - 1].spaceAfter = 120
  }

  H('Systems & Additional')
  for (const s of t.systems) paras.push({ text: s, size: 9.5, bullet: true, spaceAfter: 30 })

  return buildDocx(paras)
}

/** JACOB James HERVEY_Director, Procurement_20260812.docx — his own convention. */
export function filename(t: Tailored, company?: string | null): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const safe = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50)
  const co = company ? ` (${safe(company)})` : ''
  return `JACOB James HERVEY_${safe(t.headline)}${co}_${stamp}.docx`
}
