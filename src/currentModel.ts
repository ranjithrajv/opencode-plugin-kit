// Resolves the model a session is actually using from its last assistant
// message. Both the usage-quota tracker and model recommender need this;
// the defensive walk is delegated to the kit's shared walker.
import { walkMessages } from "./messages.ts"
import type { KitContext } from "./host.ts"

export interface CurrentModel {
  providerID: string
  modelID: string
}

/**
 * Resolve the current model from a session's most recent assistant message.
 * Returns undefined when the session has no assistant messages or the
 * shape is unreadable — callers fall back to the workspace default.
 */
export function resolveCurrentModel(context: KitContext, sessionID?: string): CurrentModel | undefined {
  let found: CurrentModel | undefined
  walkMessages(
    context,
    sessionID,
    (m) => {
      if (found) return
      const providerID = String(m?.model?.providerID ?? m?.providerID ?? "")
      const modelID = String(m?.model?.id ?? m?.modelID ?? m?.id ?? "")
      if (providerID && modelID) found = { providerID, modelID }
    },
    {},
    undefined,
  )
  return found
}
