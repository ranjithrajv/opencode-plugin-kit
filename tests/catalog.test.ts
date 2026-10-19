import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, test, vi } from "vitest"
import { findAgentsMd, listSkillCatalog, readSkillCatalog, syncSkillCatalog } from "../src/catalog.ts"

const tmp = mkdtempSync(join(tmpdir(), "kit-catalog-"))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe("listSkillCatalog", () => {
  test("lists defensively from a location or the resolved location", () => {
    const list = vi.fn(() => [{ id: "a" }, null, "nope"])
    const ctx = { data: { location: { skill: { list } } } } as never
    expect(listSkillCatalog(ctx, { directory: "/x" })).toEqual([{ id: "a" }])
    expect(list).toHaveBeenCalledWith({ directory: "/x" })

    const resolved = { data: { location: { default: () => ({ directory: "/y" }), skill: { list } } } } as never
    listSkillCatalog(resolved)
    expect(list).toHaveBeenCalledWith({ directory: "/y" })
  })

  test("accepts a wrapped { data } payload and returns [] when unreadable", () => {
    const wrapped = {
      data: {
        location: {
          default: () => ({ directory: "/y" }),
          skill: { list: () => ({ data: [{ id: "b" }] }) },
        },
      },
    } as never
    expect(listSkillCatalog(wrapped)).toEqual([{ id: "b" }])

    const nonArray = { data: { location: { skill: { list: () => ({ data: "nope" }) } } } } as never
    expect(listSkillCatalog(nonArray, { directory: "/x" })).toEqual([])

    const throwing = {
      data: {
        location: {
          skill: {
            list: () => {
              throw new Error("down")
            },
          },
        },
      },
    } as never
    expect(listSkillCatalog(throwing, { directory: "/x" })).toEqual([])
  })

  test("returns [] with no resolvable location", () => {
    expect(listSkillCatalog({} as never)).toEqual([])
  })
})

describe("syncSkillCatalog", () => {
  test("awaits the host sync when present", async () => {
    const sync = vi.fn(async () => {})
    const ctx = { data: { location: { skill: { sync } } } } as never
    await syncSkillCatalog(ctx, { directory: "/x" })
    expect(sync).toHaveBeenCalledWith({ directory: "/x" })
  })

  test("no-ops without a sync, a location, or on failure", async () => {
    await expect(
      syncSkillCatalog({ data: { location: { skill: {} } } } as never, { directory: "/x" }),
    ).resolves.toBeUndefined()
    await expect(syncSkillCatalog({} as never)).resolves.toBeUndefined()
    const failing = {
      data: {
        location: {
          skill: {
            sync: async () => {
              throw new Error("down")
            },
          },
        },
      },
    } as never
    await expect(syncSkillCatalog(failing, { directory: "/x" })).resolves.toBeUndefined()
  })
})

describe("readSkillCatalog", () => {
  test("syncs then lists", async () => {
    const order: string[] = []
    const ctx = {
      data: {
        location: {
          skill: {
            sync: async () => {
              order.push("sync")
            },
            list: () => {
              order.push("list")
              return [{ id: "a" }]
            },
          },
        },
      },
    } as never
    expect(await readSkillCatalog(ctx, { directory: "/x" })).toEqual([{ id: "a" }])
    expect(order).toEqual(["sync", "list"])
  })
})

describe("findAgentsMd", () => {
  test("finds AGENTS.md in the start directory", async () => {
    const dir = join(tmp, "direct")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "AGENTS.md"), "# agents")
    expect(await findAgentsMd(dir)).toEqual({ path: join(dir, "AGENTS.md"), content: "# agents" })
  })

  test("walks up to a parent and honors the fallback names", async () => {
    const root = join(tmp, "parent")
    mkdirSync(join(root, "a", "b"), { recursive: true })
    writeFileSync(join(root, "CLAUDE.md"), "claude")
    expect(await findAgentsMd(join(root, "a", "b"))).toEqual({ path: join(root, "CLAUDE.md"), content: "claude" })

    const lower = join(tmp, "lower")
    mkdirSync(lower, { recursive: true })
    writeFileSync(join(lower, "agents.md"), "lower")
    expect(await findAgentsMd(lower)).toEqual({ path: join(lower, "agents.md"), content: "lower" })
  })

  test("returns undefined when none exists", async () => {
    const dir = join(tmp, "empty")
    mkdirSync(dir, { recursive: true })
    expect(await findAgentsMd(dir)).toBeUndefined()
  })
})
