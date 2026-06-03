import { logApiUsage } from '@/lib/supabase/queries/admin'

// Voyage AI embedding — model voyage-3 produces 1024-dim vectors matching the DB schema.
// input_type: "query" for search queries, "document" for content being stored.
export async function embed(text: string, inputType: 'query' | 'document' = 'document'): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3', input_type: inputType }),
  })

  if (!res.ok) {
    throw new Error(`Voyage embedding failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { data: { embedding: number[] }[]; usage?: { total_tokens: number } }
  const tokens = data.usage?.total_tokens ?? 0
  void logApiUsage({ service: 'voyage', endpoint: 'embeddings', tokens_in: tokens, estimated_cost: (tokens / 1_000_000) * 0.06 })

  return data.data[0].embedding
}
