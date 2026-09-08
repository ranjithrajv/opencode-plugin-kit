import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const AUTH_PATH = "/tmp/opencode/fakehome/.local/share/opencode/auth.json"

vi.mock("node:os", () => ({ homedir: () => "/tmp/opencode/fakehome" }))

const fsState: { content: string; throws: boolean } = { content: "{}", throws: false }

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return {
    ...actual,
    readFileSync: (path: unknown) => {
      if (path === AUTH_PATH) {
        if (fsState.throws) throw new Error("boom")
        return fsState.content
      }
      throw new Error(`unexpected read: ${String(path)}`)
    },
  }
})

type Providers = typeof import("../src/providers.ts")

async function fresh(): Promise<Providers> {
  vi.resetModules()
  return import("../src/providers.ts")
}

beforeEach(() => {
  fsState.content = "{}"
  fsState.throws = false
  delete process.env.HF_TOKEN
})

afterEach(() => {
  vi.restoreAllMocks()
})

const authJson = (obj: unknown) => JSON.stringify(obj)

describe("provider labels", () => {
  test("providerLabel maps known ids", async () => {
    const p = await fresh()
    expect(p.providerLabel("opencode")).toBe("zen")
    expect(p.providerLabel("opencode-go")).toBe("go")
    expect(p.providerLabel("google")).toBe("google")
    expect(p.providerLabel("zai-coding-plan")).toBe("zai")
    expect(p.providerLabel("huggingface")).toBe("hf")
    expect(p.providerLabel("unknown-prov")).toBe("unknown-prov")
  })

  test("providerTitle maps known ids", async () => {
    const p = await fresh()
    expect(p.providerTitle("opencode")).toBe("Zen")
    expect(p.providerTitle("opencode-go")).toBe("Go")
    expect(p.providerTitle("google")).toBe("Google")
    expect(p.providerTitle("zai-coding-plan")).toBe("Z.AI")
    expect(p.providerTitle("huggingface")).toBe("Hugging Face")
    expect(p.providerTitle("other")).toBe("other")
  })

  test("constants expose the vocabulary", async () => {
    const p = await fresh()
    expect(p.ZEN_PROVIDER).toBe("opencode")
    expect(p.GO_PROVIDER).toBe("opencode-go")
    expect(p.DEFAULT_PROVIDERS).toEqual(["opencode", "opencode-go"])
  })
})

describe("message shape helpers", () => {
  test("unwrap opens the info envelope and tolerates bare messages", async () => {
    const p = await fresh()
    const inner = { type: "assistant", id: "m1" }
    expect(p.unwrap({ info: inner })).toBe(inner)
    const bare = { type: "user" }
    expect(p.unwrap(bare)).toBe(bare)
    expect(p.unwrap(undefined as never)).toBeUndefined()
  })

  test("isAssistant tolerates type and role discrimination", async () => {
    const p = await fresh()
    expect(p.isAssistant({ type: "assistant" })).toBe(true)
    expect(p.isAssistant({ role: "assistant" })).toBe(true)
    expect(p.isAssistant({ type: "user" })).toBe(false)
    expect(p.isAssistant({})).toBe(false)
    expect(p.isAssistant(undefined as never)).toBe(false)
  })

  test("asArray normalizes wrapped and bare responses", async () => {
    const p = await fresh()
    expect(p.asArray([1, 2])).toEqual([1, 2])
    expect(p.asArray({ data: ["a"] })).toEqual(["a"])
    expect(p.asArray(undefined as never)).toEqual([])
    expect(p.asArray({})).toEqual([])
  })

  test("modelId reads every fallback in order", async () => {
    const p = await fresh()
    expect(p.modelId({ model: { modelID: "a" } })).toBe("a")
    expect(p.modelId({ modelID: "b" })).toBe("b")
    expect(p.modelId({ model: { id: "c" } })).toBe("c")
    expect(p.modelId({ id: "d" })).toBe("d")
    expect(p.modelId({})).toBe("")
    expect(p.modelId(undefined as never)).toBe("")
  })

  test("providerId reads the model-first then top-level shape", async () => {
    const p = await fresh()
    expect(p.providerId({ model: { providerID: "x" } })).toBe("x")
    expect(p.providerId({ providerID: "y" })).toBe("y")
    expect(p.providerId({})).toBe("")
    expect(p.providerId(undefined as never)).toBe("")
  })

  test("modelName falls back to the model id", async () => {
    const p = await fresh()
    expect(p.modelName({ name: "Nice Name", id: "id" })).toBe("Nice Name")
    expect(p.modelName({ id: "just-id" })).toBe("just-id")
  })
})

describe("auth.json readers", () => {
  test("readAuth extracts trimmed string keys", async () => {
    fsState.content = authJson({
      opencode: { key: "  zen-key  " },
      "opencode-go": { key: "go-key" },
      broken: { key: 42 },
      empty: { key: "" },
      blank: { key: "   " },
      nokey: {},
    })
    const p = await fresh()
    expect(p.readAuth()).toEqual({ opencode: "zen-key", "opencode-go": "go-key" })
  })

  test("readAuth swallows unreadable files", async () => {
    fsState.throws = true
    const p = await fresh()
    expect(p.readAuth()).toEqual({})
  })

  test("authKey and hasKey reflect stored keys", async () => {
    fsState.content = authJson({ opencode: { key: "zen-key" } })
    const p = await fresh()
    expect(p.authKey("opencode")).toBe("zen-key")
    expect(p.authKey("opencode-go")).toBe("")
    expect(p.hasKey("opencode")).toBe(true)
    expect(p.hasKey("opencode-go")).toBe(false)
  })

  test("authKeys prefers keys in order and filters blanks", async () => {
    fsState.content = authJson({ "opencode-go": { key: "go" }, other: { key: "x" } })
    const p = await fresh()
    expect(p.authKeys(["opencode", "opencode-go"])).toEqual(["go"])
    expect(p.authKeys(["missing"])).toEqual([])
  })

  test("authKeys falls back to the fallback list when preferred is empty", async () => {
    fsState.content = authJson({ "opencode-go": { key: "go" } })
    const p = await fresh()
    expect(p.authKeys(["opencode"], "opencode-go")).toEqual(["go"])
    expect(p.authKeys(["missing"], "missing2")).toEqual([])
  })
})

describe("availableProviders", () => {
  test("returns the auth.json provider ids", async () => {
    fsState.content = authJson({ opencode: { key: "k" }, google: { key: "g" } })
    const p = await fresh()
    expect(p.availableProviders()).toEqual(["opencode", "google"])
  })

  test("appends huggingface when HF_TOKEN is set", async () => {
    fsState.content = authJson({ opencode: { key: "k" } })
    process.env.HF_TOKEN = "hf"
    const p = await fresh()
    expect(p.availableProviders()).toEqual(["opencode", "huggingface"])
  })

  test("does not duplicate huggingface when it is already in auth.json", async () => {
    fsState.content = authJson({ huggingface: { key: "k" } })
    process.env.HF_TOKEN = "hf"
    const p = await fresh()
    expect(p.availableProviders()).toEqual(["huggingface"])
  })

  test("falls back to Zen + Go when auth.json is unreadable", async () => {
    fsState.throws = true
    const p = await fresh()
    expect(p.availableProviders()).toEqual(["opencode", "opencode-go"])
  })

  test("memoizes across calls", async () => {
    fsState.content = authJson({ opencode: { key: "k" } })
    const p = await fresh()
    const first = p.availableProviders()
    fsState.content = authJson({ google: { key: "g" } })
    expect(p.availableProviders()).toBe(first)
  })
})
