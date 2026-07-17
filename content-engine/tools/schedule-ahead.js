// Schedule one day's evergreen content in Postiz at per-platform optimal times.
// Usage: node schedule-ahead.js <pipeline.json> <video.mp4> <YYYY-MM-DD>
// Times (ET): X 9am, YouTube 2pm, Instagram 6pm, TikTok 8pm.
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '/Users/jacobslaptop/Desktop/lmc-mining/.env.local' })

const KEY = process.env.POSTIZ_API_KEY
const URL = process.env.POSTIZ_API_URL || 'https://api.postiz.com/public/v1'
const H = { Authorization: KEY }

// ET offsets in UTC for July (EDT = UTC-4). TikTok 8pm ET lands next day 00:00Z.
const TIMES_UTC = { x: 'T13:00:00.000Z', youtube: 'T18:00:00.000Z', instagram: 'T22:00:00.000Z', tiktok: '+1T00:00:00.000Z' }
const PROVIDER = { youtube_shorts: 'youtube', instagram_reels: 'instagram', tiktok: 'tiktok', x: 'x' }
const SETTINGS = {
  youtube_shorts: (s) => ({ title: (s.title && s.title.length <= 100) ? s.title : s.hook.slice(0, 95).replace(/\s+\S*$/, ''), type: 'public' }),
  instagram_reels: () => ({ post_type: 'post' }),
  tiktok: () => ({ privacy_level: 'PUBLIC_TO_EVERYONE', duet: false, stitch: false, comment: true, autoAddMusic: 'no', brand_content_toggle: false, brand_organic_toggle: false, content_posting_method: 'DIRECT_POST' }),
  x: () => ({ who_can_reply_post: 'everyone' }),
}
const caption = (s) => [s.caption, s.hashtags.join(' '), s.disclosures.join(' ')].filter(Boolean).join('\n\n')
const xText = (s) => [s.hook, s.body, s.hashtags.join(' ')].filter(Boolean).join('\n\n')

function dateFor(day, provider) {
  const t = TIMES_UTC[provider]
  if (t.startsWith('+1')) {
    const d = new Date(day + 'T00:00:00.000Z'); d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10) + t.slice(2)
  }
  return day + t
}

;(async () => {
  const [jsonFile, videoFile, day] = process.argv.slice(2)
  const result = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  const ints = await (await fetch(URL + '/integrations', { headers: H })).json()

  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(videoFile)], { type: 'video/mp4' }), path.basename(videoFile))
  const up = await fetch(URL + '/upload', { method: 'POST', headers: H, body: form })
  const media = await up.json()
  if (!media.id) throw new Error('upload failed: ' + JSON.stringify(media))

  for (const r of result.reviewed) {
    if (!r.passedAll) { console.log('skip (gates):', r.script.platform); continue }
    const prov = PROVIDER[r.script.platform]
    const integ = ints.find((i) => i.identifier?.includes(prov) && !i.disabled)
    if (!integ) { console.log('skip (no channel):', prov); continue }
    const when = dateFor(day, prov)
    const body = {
      type: 'date', date: when, shortLink: false, tags: [],
      posts: [{ integration: { id: integ.id }, value: [{ content: r.script.platform === 'x' ? xText(r.script) : caption(r.script), image: [{ id: media.id, path: media.path }] }], settings: SETTINGS[r.script.platform](r.script) }],
    }
    const res = await fetch(URL + '/posts', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    console.log(prov, when, res.status, res.ok ? 'SCHEDULED' : (await res.text()).slice(0, 120))
  }
})().catch((e) => { console.error(e); process.exit(1) })
