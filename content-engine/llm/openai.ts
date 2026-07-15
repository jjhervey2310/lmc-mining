import OpenAI from 'openai'
import { OPENAI_API_KEY, REVIEWER_MODEL } from '../config'

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  if (!OPENAI_API_KEY) return null
  if (!client) client = new OpenAI({ apiKey: OPENAI_API_KEY })
  return client
}

export function openaiReady(): boolean {
  return !!OPENAI_API_KEY
}

/** Reviewer (GPT). Returns JSON string. Throws if no key. */
export async function reviewJSON(system: string, user: string): Promise<string> {
  const c = getClient()
  if (!c) throw new Error('OPENAI_API_KEY not set')
  const res = await c.chat.completions.create({
    model: REVIEWER_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  })
  return res.choices[0]?.message?.content || '{}'
}
