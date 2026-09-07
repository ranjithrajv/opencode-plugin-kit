// Zod schemas for the untrusted shapes crossing the OpenCode boundary.
//
// These are the shapes that silently change under us: the service's
// integration list (connected-provider gating) and the usage endpoint's
// quota windows. Parse, degrade to last-known-good on failure — never cast.
// See docs/opencode2-api.md for where each shape comes from.
import { z } from "zod"

/** One window of plan quota: server-reported percent + reset time. */
export const windowSchema = z.object({
  status: z.string().optional(),
  percent: z.number().optional(),
  resetsAt: z.string().optional(),
})
export type Window = z.infer<typeof windowSchema>

/** The usage endpoint (`https://opencode.ai/zen/go/v1/usage`): workspace
 * plan quota over rolling 5h / weekly / monthly windows. */
export const usageResponseSchema = z.object({
  usage: z
    .object({
      rolling: windowSchema.optional(),
      weekly: windowSchema.optional(),
      monthly: windowSchema.optional(),
    })
    .optional(),
})
export type UsageResponse = z.infer<typeof usageResponseSchema>

/** One credential added via /connect (key or OAuth). */
export const connectionSchema = z.object({
  type: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})

/** An entry of `GET /api/integration` (same source /connect reads). An
 * entry is "connected" iff its `connections` array is non-empty. */
export const integrationSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  connections: z.array(connectionSchema).optional(),
})
export type Integration = z.infer<typeof integrationSchema>

/** Parse a usage-endpoint payload. Returns null instead of throwing when
 * the shape is unrecognized — callers fall back to their cache. */
export function parseUsage(raw: unknown): UsageResponse | null {
  const result = usageResponseSchema.safeParse(raw)
  return result.success ? result.data : null
}

/** Parse the integration list. Accepts both the wrapped `{ data: [...] }`
 * and bare-array responses. */
export function parseIntegrationList(raw: unknown): Integration[] | null {
  const result = z.union([z.object({ data: z.array(integrationSchema) }), z.array(integrationSchema)]).safeParse(raw)
  if (!result.success) return null
  return "data" in result.data ? result.data.data : result.data
}

/** Provider ids with at least one added connection — the eligibility set
 * for provider-gated views. */
export function connectedProviderIds(raw: unknown): Set<string> {
  const list = parseIntegrationList(raw)
  const ids = new Set<string>()
  for (const item of list ?? []) {
    if ((item.connections?.length ?? 0) > 0 && item.id) ids.add(item.id)
  }
  return ids
}
