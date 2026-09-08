import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // solid-js must resolve to the client build, or createResource throws
    // "getNextContextId cannot be used under non-hydrating context".
    alias: [{ find: /^solid-js$/, replacement: "solid-js/dist/solid.js" }],
    conditions: ["browser", "development"],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    typecheck: {
      include: ["tests/**/*.test-d.ts"],
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/testkit.ts", "src/index.ts", "src/host.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
})
