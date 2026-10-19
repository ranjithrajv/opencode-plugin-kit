// Build opencode-plugin-kit's TSX into plain JS using the SAME Solid
// transform OpenCode applies to plugins at runtime, so the output stays
// reactive when it is consumed from node_modules (where OpenTUI's transform
// plugin never touches .tsx files — its source filter excludes node_modules).
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const result = await Bun.build({
  entrypoints: ["./src/collapsible.tsx"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  plugins: [createSolidTransformPlugin()],
  external: ["solid-js", "solid-js/*", "@opentui/solid", "@opentui/solid/*", "@opencode/plugin", "@opencode/plugin/*"],
  naming: "[name].js",
})

console.log(
  "success:",
  result.success,
  "outputs:",
  [...result.outputs].map((o) => o.path),
)
if (!result.success) {
  console.log(result.logs)
  process.exit(1)
}
// Bun writes the output under dist/ (entry name flattened by `naming`).
