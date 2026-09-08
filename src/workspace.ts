// Workspace location resolution shared by the TUI plugins.
//
// The client may expose the workspace location directly (`context.location`)
// or behind `data.location.default()`, and the directory may live on
// `.directory` or be the location value itself. The plugin-manager and the
// skill lister each hand-rolled this dance.

/**
 * Resolve the workspace location object for a plugin context. Returns
 * whatever the client exposes — callers that need a path should prefer
 * `workspaceDirectory`.
 */
export function resolveLocation(context: any): any {
  return context.location ?? context.data.location.default()
}

/** Resolve the workspace directory as a string ("." when nothing resolves). */
export function workspaceDirectory(context: any): string {
  const location = resolveLocation(context)
  return String(location?.directory ?? location ?? ".")
}
