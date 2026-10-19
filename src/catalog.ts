// Skill catalog and AGENTS.md discovery.
//
// Two plugins hand-rolled the same dance: resolve the workspace location, sync
// the host's skill cache against it, then list defensively. `findAgentsMd` was
// duplicated a third time inside a CLI script. This is that shared code.
import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { KitContext } from "./host.ts"
import { resolveLocation } from "./workspace.ts"

function asArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  const data = (value as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? (data as T[]) : []
}

/** Resolve the catalog location, tolerating hosts with no location surface. */
function locate(context: KitContext, location?: unknown): unknown {
  if (location !== undefined) return location
  try {
    return resolveLocation(context)
  } catch {
    return undefined
  }
}

/**
 * List the host's cached skills for a location, defensively. Returns [] when
 * the location or the host's skill list is unavailable.
 */
export function listSkillCatalog(context: KitContext, location?: unknown): any[] {
  const loc = locate(context, location)
  if (!loc) return []
  try {
    const list = (context as any)?.data?.location?.skill?.list?.(loc)
    return asArray(list).filter((entry) => entry && typeof entry === "object")
  } catch {
    return []
  }
}

/** Refresh the host's skill cache for a location. No-op when unsupported. */
export async function syncSkillCatalog(context: KitContext, location?: unknown): Promise<void> {
  const loc = locate(context, location)
  const sync = (context as any)?.data?.location?.skill?.sync
  if (!loc || typeof sync !== "function") return
  try {
    await sync.call((context as any).data.location.skill, loc)
  } catch {
    // A stale cache is better than a failed widget; list() still returns it.
  }
}

/** Sync then list in one call — the pattern both skill plugins share. */
export async function readSkillCatalog(context: KitContext, location?: unknown): Promise<any[]> {
  const loc = locate(context, location)
  await syncSkillCatalog(context, loc)
  return listSkillCatalog(context, loc)
}

/**
 * Find the nearest AGENTS.md (or agents.md / CLAUDE.md) walking up from
 * `startDir`. Returns the path and content, or undefined when none is found
 * within 12 levels.
 */
export async function findAgentsMd(startDir: string): Promise<{ path: string; content: string } | undefined> {
  let current = path.resolve(startDir)
  for (let i = 0; i < 12; i++) {
    for (const name of ["AGENTS.md", "agents.md", "CLAUDE.md"]) {
      const full = path.join(current, name)
      try {
        const content = await fs.readFile(full, "utf8")
        return { path: full, content }
      } catch {
        // Try the next candidate.
      }
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return undefined
}
