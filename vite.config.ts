import solid from "vite-plugin-solid"
import { defineConfig } from "vite-plus"

export default defineConfig({
  plugins: [solid({ include: [/\.tsx$/] })],
  resolve: {
    alias: [
      { find: /^solid-js$/, replacement: "solid-js/dist/dev.js" },
      { find: /^solid-js\/web$/, replacement: "solid-js/web/dist/dev.js" },
    ],
    conditions: ["browser", "development"],
  },
  fmt: {
    // Generated, byte-stable: CI regenerates it and fails on any diff, so the
    // formatter must not rewrite it (cell padding would break that contract).
    ignorePatterns: ["docs/COMPATIBILITY.md"],
    semi: false,
    singleQuote: false,
    printWidth: 120,
    trailingComma: "all",
  },
  lint: {
    ignorePatterns: ["dist/**", "node_modules/**", "coverage/**"],
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    typecheck: {
      include: ["src/**/*.test-d.ts"],
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test*.ts", "src/testkit.ts", "src/index.ts", "src/host.ts"],
    },
  },
  staged: {
    "*": "vp check --fix",
  },
})
