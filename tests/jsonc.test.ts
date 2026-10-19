import { describe, expect, test } from "vitest"
import {
  addPluginSpec,
  addPluginsKey,
  cleanJsonc,
  editPluginsText,
  removePluginSpec,
  tolerantParse,
} from "../src/jsonc.ts"

describe("cleanJsonc / tolerantParse", () => {
  test("plain JSON passes through", () => {
    expect(tolerantParse('{"a": 1}')).toEqual({ a: 1 })
  })

  test("line and block comments are stripped", () => {
    expect(tolerantParse(`{\n  // plugin list\n  "plugins": ["a"] // trailing\n}`)).toEqual({ plugins: ["a"] })
    expect(tolerantParse(`{\n  /* span\n     lines */\n  "plugins": ["a"]\n}`)).toEqual({ plugins: ["a"] })
  })

  test("trailing commas in objects and arrays are dropped", () => {
    expect(tolerantParse(`{"a": 1, "plugins": ["x",],}`)).toEqual({ a: 1, plugins: ["x"] })
    expect(tolerantParse(`{"a": [1, // c\n]}`)).toEqual({ a: [1] })
    expect(tolerantParse(`{"a": [1, /* c */ ]}`)).toEqual({ a: [1] })
    expect(tolerantParse(`{"a": 1, /* c */ }`)).toEqual({ a: 1 })
  })

  test("comment markers inside strings are preserved", () => {
    expect(tolerantParse(`{"url": "http://x/*y*/", "t": "a,//b"}`)).toEqual({ url: "http://x/*y*/", t: "a,//b" })
    expect(cleanJsonc(`{"url": "http://x"}`)).toBe(`{"url": "http://x"}`)
  })

  test("escaped quotes inside strings survive", () => {
    expect(tolerantParse(`{"t": "say \\"hi\\""}`)).toEqual({ t: 'say "hi"' })
  })

  test("unparseable input yields undefined", () => {
    expect(tolerantParse("{nope")).toBeUndefined()
    expect(tolerantParse("")).toBeUndefined()
  })
})

describe("addPluginSpec", () => {
  test("inserts into an empty inline and multiline array", () => {
    expect(addPluginSpec(`{"plugins":[]}`, "x")).toBe(`{"plugins":["x"]}`)
    expect(addPluginSpec(`{\n  "plugins": [\n  ]\n}`, "x")).toBe(`{\n  "plugins": [\n    "x"\n  ]\n}`)
  })

  test("appends with indentation and preserves comments", () => {
    const raw = `{\n  "plugins": [\n    "a",\n    "b"\n  ]\n}`
    const out = addPluginSpec(raw, "c")!
    expect(JSON.parse(out)).toEqual({ plugins: ["a", "b", "c"] })
    expect(out).toContain(`"a",\n    "b",`)

    const commented = `{\n  // list\n  "plugins": [\n    // installed\n    "a" /* keep */\n  ]\n}`
    const withComment = addPluginSpec(commented, "b")!
    expect(JSON.parse(cleanJsonc(withComment))).toEqual({ plugins: ["a", "b"] })
    expect(withComment).toContain("// installed")
    expect(withComment).toContain("/* keep */")
  })

  test("appends inline and after a trailing comma", () => {
    expect(addPluginSpec(`{"plugins":["a"]}`, "b")).toBe(`{"plugins":["a","b"]}`)
    expect(addPluginSpec(`{"plugins": ["a", "b"]}`, "c")).toBe(`{"plugins": ["a", "b","c"]}`)
    expect(JSON.parse(addPluginSpec(`{\n  "plugins": [\n    "a",\n  ]\n}`, "b")!)).toEqual({ plugins: ["a", "b"] })
  })

  test("a duplicate spec leaves the document untouched", () => {
    const raw = `{"plugins":["a"]}`
    expect(addPluginSpec(raw, "a")).toBe(raw)
  })

  test("returns null for a missing, non-array or malformed plugins value", () => {
    expect(addPluginSpec(`{"theme":"dark"}`, "x")).toBeNull()
    expect(addPluginSpec(`{"plugins":"nope"}`, "x")).toBeNull()
    expect(addPluginSpec(`{"plugins":[["a"]]}`, "x")).toBeNull()
    expect(addPluginSpec(`{"plugins": ["a"`, "x")).toBeNull()
  })

  test("ignores values named plugins and keys without a colon", () => {
    expect(addPluginSpec(`{"k": "plugins"}`, "x")).toBeNull()
    expect(addPluginSpec(`{"plugins" }`, "x")).toBeNull()
  })

  test("skips nested objects and arrays before the plugins key", () => {
    const raw = `{"mcp": {"x": [1, 2]}, "plugins": ["a"]}`
    expect(JSON.parse(addPluginSpec(raw, "b")!)).toEqual({ mcp: { x: [1, 2] }, plugins: ["a", "b"] })
  })
})

describe("addPluginsKey", () => {
  test("inserts into an empty object and after members", () => {
    expect(addPluginsKey(`{}`, "x")).toBe(`{\n  "plugins": ["x"]\n}`)
    expect(JSON.parse(addPluginsKey(`{\n  "theme": "dark"\n}`, "x")!)).toEqual({ theme: "dark", plugins: ["x"] })
  })

  test("preserves comments", () => {
    const out = addPluginsKey(`{\n  // my theme\n  "theme": "dark"\n}`, "x")!
    expect(out).toContain("// my theme")
    expect(JSON.parse(cleanJsonc(out))).toEqual({ theme: "dark", plugins: ["x"] })
  })

  test("returns null without an object closing brace", () => {
    expect(addPluginsKey(`"just a string"`, "x")).toBeNull()
  })
})

describe("removePluginSpec", () => {
  test("removes middle, first and last items", () => {
    expect(removePluginSpec(`{"plugins": ["a", "b", "c"]}`, (s) => s === "b")).toEqual({
      text: `{"plugins": ["a", "c"]}`,
      removed: true,
    })
    expect(removePluginSpec(`{"plugins": ["a", "b"]}`, (s) => s === "a")!.text).toBe(`{"plugins": [ "b"]}`)
    const last = removePluginSpec(`{\n  "plugins": [\n    "a",\n    "b"\n  ]\n}`, (s) => s === "b")!
    expect(JSON.parse(cleanJsonc(last.text))).toEqual({ plugins: ["a"] })
  })

  test("removes the only item and reports a miss", () => {
    expect(JSON.parse(cleanJsonc(removePluginSpec(`{"plugins": ["a"]}`, (s) => s === "a")!.text))).toEqual({
      plugins: [],
    })
    expect(removePluginSpec(`{"plugins": ["a"]}`, (s) => s === "z")).toEqual({
      text: `{"plugins": ["a"]}`,
      removed: false,
    })
  })

  test("tolerates escaped quotes and a missing separator comma", () => {
    const raw = `{"note": "say \\"hi\\"", "plugins": ["a"]}`
    const out = removePluginSpec(raw, (s) => s === "a")!
    expect(JSON.parse(out.text).note).toBe('say "hi"')
    expect(removePluginSpec(`{"plugins": ["a" "b"]}`, (s) => s === "b")!.removed).toBe(true)
  })

  test("returns null for a missing or malformed plugins array", () => {
    expect(removePluginSpec(`{"theme":"dark"}`, () => true)).toBeNull()
    expect(removePluginSpec(`{"plugins":[["a"]]}`, () => true)).toBeNull()
    expect(removePluginSpec(`{"plugins": ["a"`, () => true)).toBeNull()
  })
})

describe("editPluginsText", () => {
  test("splices an add textually", () => {
    expect(editPluginsText(`{"plugins": ["a"]}`, { add: "b" }, { plugins: ["a"] }, ["a", "b"])).toBe(
      `{"plugins": ["a","b"]}`,
    )
  })

  test("falls back to adding the plugins key", () => {
    const out = editPluginsText(`{\n  "theme": "dark"\n}`, { add: "b" }, { theme: "dark" }, ["b"])
    expect(JSON.parse(cleanJsonc(out))).toEqual({ theme: "dark", plugins: ["b"] })
  })

  test("rewrites the document when the shape defeats a textual add", () => {
    expect(JSON.parse(editPluginsText(`[1, 2]`, { add: "b" }, [1, 2], ["b"])).plugins).toEqual(["b"])
    expect(JSON.parse(editPluginsText(`42`, { add: "b" }, 42, ["b"])).plugins).toEqual(["b"])
  })

  test("splices a remove textually and rewrites on failure", () => {
    expect(
      editPluginsText(`{"plugins": ["a", "b"]}`, { remove: (s) => s === "b" }, { plugins: ["a", "b"] }, ["a"]),
    ).toBe(`{"plugins": ["a"]}`)
    expect(
      JSON.parse(editPluginsText(`{"plugins": [["a"]]}`, { remove: () => true }, { plugins: [["a"]] }, [])).plugins,
    ).toEqual([])
  })
})
