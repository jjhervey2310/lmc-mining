#!/usr/bin/env node
/**
 * Ping IndexNow with every URL in the sitemap.
 *
 * IndexNow is a push protocol: Bing, Yandex, Seznam and Naver accept a URL list
 * and crawl it rather than waiting to discover the site. Google does not
 * participate, so this covers Bing-derived surfaces only — which includes
 * ChatGPT search. Google still needs Search Console.
 *
 * The key file must be live at HOST/KEY.txt before the endpoint will accept a
 * submission, so this only works against deployed production.
 *
 *   node scripts/indexnow.js            # submit
 *   node scripts/indexnow.js --dry-run  # list URLs, submit nothing
 */

const HOST = 'www.lightningmines.com'
const KEY = '2e570f0dbad65ab2d7c2e4e2f8dd5797'
const SITEMAP = `https://${HOST}/sitemap.xml`
const ENDPOINT = 'https://api.indexnow.org/IndexNow'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const keyUrl = `https://${HOST}/${KEY}.txt`
  const keyRes = await fetch(keyUrl)
  if (!keyRes.ok) {
    console.error(`Key file not reachable at ${keyUrl} (HTTP ${keyRes.status}).`)
    console.error('Deploy first — IndexNow rejects submissions until the key is live.')
    process.exit(1)
  }

  const xml = await (await fetch(SITEMAP)).text()
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
  if (!urlList.length) {
    console.error('No <loc> entries found in the sitemap.')
    process.exit(1)
  }

  console.log(`${urlList.length} URLs from ${SITEMAP}`)
  if (dryRun) {
    urlList.forEach(u => console.log('  ' + u))
    console.log('\nDry run — nothing submitted.')
    return
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: keyUrl, urlList }),
  })

  // 200 accepted, 202 accepted-pending-key-validation. Both are successes.
  if (res.ok) {
    console.log(`Submitted ${urlList.length} URLs — HTTP ${res.status}.`)
  } else {
    console.error(`IndexNow rejected the submission — HTTP ${res.status}`)
    console.error(await res.text())
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
