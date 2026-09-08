// Resolves the model a session is actually using from its last assistant
// message. Duplicated across the usage-quota tracker and model recommender —
// both walk session messages backwards defensively to find the active provider
// and model IDs.
import { isAssistant } from "./providers.ts"
import type { KitContext, KitMessageShape } from "./host.ts"

export interface CurrentModel {
  providerID: string
  modelID: string
}

/**
 * Resolve the current model from a session's last assistant message.
 * Walks messages backwards so the first assistant hit is the active one.
 * Returns undefined when the session has no assistant messages or the
 * shape is unreadable — callers fall back to the workspace default.
 */
export function resolveCurrentModel(context: KitContext, sessionID?: string): CurrentModel | undefined {
  if (!sessionID) return undefined
  try {
    const messages = context.data.session.message.list(sessionID) ?? []
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = (messages[i] as KitMessageShape)?.info ?? (messages[i] as KitMessageShape)
      if (!isAssistant(m)) continue
      const providerID = String(m?.model?.providerID ?? m?.providerID ?? "")
      const modelID = String(m?.model?.id ?? m?.modelID ?? m?.id ?? "")
      if (providerID && modelID) return { providerID, modelID }
    }
  } catch {
    // Fall through.
  }
  return undefined
}

/**
 * Create a reactive current-model resolver. Re-reads whenever `sessionID`
 * changes (via the signal you pass), so the sidebar follows the active
 * session without manual refresh.
 */
export function createCurrentModelResolver(
  context: KitContext,
  sessionID: () => string | undefined,
): () => CurrentModel | undefined {
  return () => resolveCurrentModel(context, sessionID())
}
