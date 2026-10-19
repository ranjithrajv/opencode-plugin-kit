#!/usr/bin/env node
/**
 * Host compatibility checker.
 *
 * For each pinned `@opencode/plugin` version this installs that version into a
 * temp directory and runs two checks against it:
 *
 *   1. TYPE    — `tests/host.test-d.ts`, the type-tripwire.
 *   2. RUNTIME — `tests/runtime-smoke.test.ts`, which imports the real host
 *                runtime and executes every kit factory against a host-shaped
 *                context. Types cannot catch a missing dependency or a broken
 *                JSX pragma; this can.
 *
 * Usage:
 *   node scripts/check-host-compat.mjs [versions...]
 *   node scripts/check-host-compat.mjs --type-only
 *   node scripts/check-host-compat.mjs --runtime-only
 *   node scripts/check-host-compat.mjs --write-matrix   # refresh docs/COMPATIBILITY.md
 *
 * Environment variables:
 *   KIT_HOST_COMPAT_VERSIONS  — comma-separated list of versions to test
 *   KIT_HOST_COMPAT_SKIP      — comma-separated list of versions to skip
 *   KIT_HOST_COMPAT_KEEP      — "1" keeps temp directories for debugging
 *   KIT_HOST_COMPAT_WRITE     — "1" is the same as --write-matrix
 */
import { execSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const kitRoot = join(__dirname, "..")
const kitPkg = JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8"))
const devDeps = kitPkg.devDependencies ?? {}

// Default versions to test: the floor, a few intermediates, and the latest.
const DEFAULT_VERSIONS = ["2.0.3", "2.0.10", "2.0.15", "2.0.18"]

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith("--")))
const versionsArg = argv.filter((a) => !a.startsWith("--"))

if (flags.has("--help") || flags.has("-h")) {
  console.log(
    [
      "Usage: node scripts/check-host-compat.mjs [versions...] [flags]",
      "",
      "  --type-only       run only the type-tripwire",
      "  --runtime-only    run only the runtime smoke test",
      "  --write-matrix    refresh docs/COMPATIBILITY.md from the results",
      "  --help            show this help",
      "",
      `Default versions: ${DEFAULT_VERSIONS.join(", ")}`,
    ].join("\n"),
  )
  process.exit(0)
}

const runType = !flags.has("--runtime-only")
const runRuntime = !flags.has("--type-only")
const writeMatrix = flags.has("--write-matrix") || process.env.KIT_HOST_COMPAT_WRITE === "1"

const versions =
  versionsArg.length > 0
    ? versionsArg
    : process.env.KIT_HOST_COMPAT_VERSIONS
      ? process.env.KIT_HOST_COMPAT_VERSIONS.split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : DEFAULT_VERSIONS

const skip = new Set(
  (process.env.KIT_HOST_COMPAT_SKIP ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
)

const keepTemp = process.env.KIT_HOST_COMPAT_KEEP === "1"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message) {
  console.log(`[host-compat] ${message}`)
}

function run(command, options = {}) {
  try {
    return execSync(command, { stdio: "pipe", ...options })
  } catch (error) {
    const stderr = error.stderr?.toString() ?? ""
    const stdout = error.stdout?.toString() ?? ""
    throw new Error(`Command failed: ${command}\n${stdout}${stderr}`)
  }
}

function writeTempPackage(tempDir, version) {
  const pkg = {
    name: "kit-host-compat-test",
    private: true,
    type: "module",
    devDependencies: {
      "@opencode/plugin": version,
      "@opencode/client": version,
      "@opencode/theme": version,
      "@types/node": devDeps["@types/node"] ?? "^26.0.0",
      "solid-js": devDeps["solid-js"] ?? "1.9.15",
      typescript: devDeps.typescript ?? "^7.0.2",
      vitest: devDeps.vitest ?? "^5.0.0",
      zod: devDeps.zod ?? "^4.5.4",
    },
  }
  writeFileSync(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2))
}

function writeTempTsconfig(tempDir) {
  // Mirrors the repo tsconfig (nodenext resolution + node types) so the
  // tripwire resolves `@opencode/plugin` the same way the kit does.
  const tsconfig = {
    compilerOptions: {
      module: "nodenext",
      moduleResolution: "nodenext",
      target: "esnext",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      types: ["node"],
    },
    include: ["src/**/*.ts", "tests/**/*.ts"],
  }
  writeFileSync(join(tempDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2))
}

function stageKit(tempDir) {
  run(`cp -r "${join(kitRoot, "src")}" "${join(tempDir, "src")}"`)
  run(`mkdir -p "${join(tempDir, "tests")}"`)
  run(`cp "${join(kitRoot, "tests", "host.test-d.ts")}" "${join(tempDir, "tests", "host.test-d.ts")}"`)
  run(`cp "${join(kitRoot, "tests", "runtime-smoke.test.ts")}" "${join(tempDir, "tests", "runtime-smoke.test.ts")}"`)
  run(`cp "${join(kitRoot, "vitest.config.ts")}" "${join(tempDir, "vitest.config.ts")}"`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

log(`Kit root: ${kitRoot}`)
log(`Pinned @opencode/plugin (dev): ${devDeps["@opencode/plugin"] ?? "unknown"}`)
log(`Checks: ${[runType && "type", runRuntime && "runtime"].filter(Boolean).join(" + ") || "none"}`)
log(`Testing ${versions.length} version(s): ${versions.join(", ")}`)
if (skip.size > 0) log(`Skipping: ${[...skip].join(", ")}`)

const results = []

for (const version of versions) {
  if (skip.has(version)) {
    log(`— ${version}: skipped`)
    results.push({ version, type: "skipped", runtime: "skipped" })
    continue
  }

  const tempDir = mkdtempSync(join(tmpdir(), "kit-host-compat-"))
  const result = { version, type: runType ? "pending" : "skipped", runtime: runRuntime ? "pending" : "skipped" }
  log(`— ${version}: testing in ${tempDir}`)

  try {
    writeTempPackage(tempDir, version)
    log(`— ${version}: installing...`)
    run("npm install --ignore-scripts --no-audit --no-fund", { cwd: tempDir })
    stageKit(tempDir)

    // Each check runs independently so a type failure still reports runtime.
    if (runType) {
      log(`— ${version}: typechecking...`)
      writeTempTsconfig(tempDir)
      try {
        run("npx tsc --noEmit -p tsconfig.json", { cwd: tempDir })
        result.type = "pass"
      } catch (error) {
        result.type = "fail"
        log(`  type: ${error.message.split("\n").slice(0, 6).join("\n  ")}`)
      }
    }

    if (runRuntime) {
      log(`— ${version}: runtime smoke...`)
      try {
        run("npx vitest run tests/runtime-smoke.test.ts", { cwd: tempDir })
        result.runtime = "pass"
      } catch (error) {
        result.runtime = "fail"
        log(`  runtime: ${error.message.split("\n").slice(0, 6).join("\n  ")}`)
      }
    }

    log(`— ${version}: ${summarize(result)}`)
  } catch (error) {
    // Install/stage failed — neither check could run.
    log(`— ${version}: setup FAILED`)
    log(`  ${error.message.split("\n").slice(0, 6).join("\n  ")}`)
    if (result.type === "pending") result.type = "fail"
    if (result.runtime === "pending") result.runtime = "fail"
  } finally {
    if (!keepTemp) {
      rmSync(tempDir, { recursive: true, force: true })
    } else {
      log(`— ${version}: kept temp dir ${tempDir}`)
    }
    results.push(result)
  }
}

function summarize(r) {
  const parts = []
  if (runType) parts.push(`type:${r.type}`)
  if (runRuntime) parts.push(`runtime:${r.runtime}`)
  return parts.join(" ")
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

log("")
log("=".repeat(64))
log("Host compatibility summary")
log("=".repeat(64))

let failures = 0
for (const r of results) {
  const bad = r.type === "fail" || r.runtime === "fail"
  if (bad) failures++
  log(`  ${bad ? "FAIL" : "ok  "}  ${r.version.padEnd(8)} ${summarize(r)}`)
}

log("")
log(`${results.length} version(s), ${failures} failing`)

if (writeMatrix) {
  writeCompatibilityDoc(results)
  log(`Wrote docs/COMPATIBILITY.md`)
}

if (failures > 0) {
  process.exit(1)
}

log("All versions passed.")

// ---------------------------------------------------------------------------
// Matrix doc
// ---------------------------------------------------------------------------

function cell(status) {
  return status === "pass" ? "✅" : status === "skipped" ? "—" : "❌"
}

function writeCompatibilityDoc(rows) {
  const table = [
    "| `@opencode/plugin` | Type | Runtime |",
    "| ------------------ | :--: | :-----: |",
    ...rows.map((r) => `| \`${r.version}\` | ${cell(r.type)} | ${cell(r.runtime)} |`),
  ].join("\n")

  const doc = `# Host compatibility

The kit supports \`@opencode/plugin\` **^${(kitPkg.peerDependencies?.["@opencode/plugin"] ?? "^2.0.3").replace(/^[\^~]/, "")}**.
Each row is a published host build the kit is verified against, by two
independent checks:

- **Type** — the contract tripwire (\`tests/host.test-d.ts\`): the host's published
  types still satisfy every shape the kit consumes. Drift fails with a diff.
- **Runtime** — the runtime smoke (\`tests/runtime-smoke.test.ts\`): the real host
  runtime imports, and every kit factory executes against a host-shaped context.
  This catches what types cannot — a missing dependency, a broken JSX pragma, a
  throw the type checker never sees.

${table}

- **Floor:** \`2.0.3\` — earlier 2.x ships no \`./tui\` subpath export.
- **Pinned for development:** \`${devDeps["@opencode/plugin"] ?? "unknown"}\`.
- Builds outside this table are untested; the \`^2.0.3\` peer range is the promise,
  this table is the evidence.
- Regenerate: \`npm run check:host-compat -- --write-matrix\`
- Runs in CI ([host-compat.yml](../.github/workflows/host-compat.yml)) on every
  change, and gates every release.

This file is generated and byte-stable on purpose: CI regenerates it and fails
on any diff, so it cannot silently drift from what the checks actually observed.
`
  writeFileSync(join(kitRoot, "docs", "COMPATIBILITY.md"), doc)
}
