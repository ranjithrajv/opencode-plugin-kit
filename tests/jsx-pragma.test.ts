import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { describe, expect, test } from "vitest"
import { fileURLToPath } from "node:url"

// TUI packages ship raw .tsx that OpenCode transpiles at runtime with Bun.
// Bun ignores tsconfig.json inside node_modules, so the only reliable way to
// get the @opentui/solid JSX runtime is a file-level pragma. Without it Bun
// falls back to React's runtime and the plugin fails with
// "Cannot find package 'react'" (see tui-plugins.md in the opencode repo).

const srcDir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src")

const tsxFiles = readdirSync(srcDir).filter((f) => f.endsWith(".tsx"))

describe("tsx JSX pragma", () => {
  test("every src .tsx starts with /** @jsxImportSource @opentui/solid */", () => {
    expect(tsxFiles.length).toBeGreaterThan(0)
    for (const file of tsxFiles) {
      const source = readFileSync(join(srcDir, file), "utf8")
      expect(source, `${file} is missing the @jsxImportSource pragma`).toMatch(
        /^\s*\/\*\*\s*@jsxImportSource\s+@opentui\/solid\s*\*\//,
      )
    }
  })

  test("Bun runtime (as used by the TUI plugin loader) can import every src .tsx", () => {
    let bun: string
    try {
      bun = execFileSync("which", ["bun"], { encoding: "utf8" }).trim()
    } catch {
      console.warn("bun not installed; skipping runtime import check")
      return
    }
    for (const file of tsxFiles) {
      const script = `import('./${join("src", file).replaceAll("\\", "/")}').then(() => console.log('ok')).catch((e) => { console.error(e.message); process.exit(1) })`
      expect(() =>
        execFileSync(bun, ["-e", script], {
          cwd: join(srcDir, ".."),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }),
      ).not.toThrow()
    }
  })
})
