import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY, GENERATOR_MODEL } from '../config'

let client: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  return client
}

export function anthropicReady(): boolean {
  return !!ANTHROPIC_API_KEY
}

/** Generator (Claude). Returns raw text (expected to be JSON). Throws if no key. */
export async function generateJSON(system: string, user: string): Promise<string> {
  const c = getClient()
  if (!c) throw new Error('ANTHROPIC_API_KEY not set')
  const msg = await c.messages.create({
    model: GENERATOR_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const block = msg.content.find((b) => b.type === 'text')
  return block && 'text' in block ? block.text : ''
}
