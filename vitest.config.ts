import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      // solid-js must resolve to the client build, or createResource throws
      // "getNextContextId cannot be used under non-hydrating context".
      { find: /^solid-js$/, replacement: "solid-js/dist/solid.js" },
      // The example plugin imports the package by name, like a real consumer;
      // point that at source so the example test exercises the local build.
      {
        find: /^opencode-plugin-kit$/,
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
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
      exclude: ["tests/**", "src/index.ts", "src/host.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
})
