import fs from 'fs'
import path from 'path'
import { runPipeline } from './pipeline'
import { buildDigest } from './digest'
import { anthropicReady } from './llm/anthropic'
import { openaiReady } from './llm/openai'

async function main() {
  const args = process.argv.slice(2)
  const forceDry = args.includes('--dry')
  const pillar = args.find((a) => a.startsWith('--pillar='))?.split('=')[1]

  // Live only when the generator key exists and dry isn't forced.
  const mode: 'dry' | 'live' = !forceDry && anthropicReady() ? 'live' : 'dry'

  console.log(`\n⚙  Lightning Mines content-engine — mode: ${mode.toUpperCase()}`)
  console.log(`   generator (Claude): ${anthropicReady() ? 'ready' : 'no key'}   ·   reviewer (GPT): ${openaiReady() ? 'ready' : 'no key'}`)
  if (pillar) console.log(`   pillar override: ${pillar}`)
  console.log('')

  const result = await runPipeline(mode, { pillar })
  const md = buildDigest(result)

  const outDir = path.resolve(process.cwd(), 'content-engine/out')
  fs.mkdirSync(outDir, { recursive: true })
  const file = path.join(outDir, `${result.brief.date}-${result.brief.pillar}.md`)
  fs.writeFileSync(file, md)
  // Machine-readable result for the render/post steps (content:render reads this).
  fs.writeFileSync(path.join(outDir, `${result.brief.date}-${result.brief.pillar}.json`), JSON.stringify(result, null, 2))

  console.log(md)
  console.log(`\n📄 Digest written to ${path.relative(process.cwd(), file)}`)

  const anyBlocked = result.reviewed.some((r) => !r.passedAll)
  console.log(
    anyBlocked
      ? '\n⛔ Some scripts have gate issues — this batch would NOT be sent for approval as-is.'
      : '\n✅ All scripts passed the gates — ready for your one-tap approval.\n'
  )
}

main().catch((e) => {
  console.error('content-engine failed:', e)
  process.exit(1)
})
