import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Single Vite config that doubles as the Vitest config (Vitest reads `test`).
// Aliases are shared by the dev server, the production build, and the tests so
// the framework-free engine/ and agentd-client/ directories resolve the same
// way everywhere.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": resolve(import.meta.dirname, "engine/index.ts"),
      "@agentd": resolve(import.meta.dirname, "agentd-client/index.ts"),
      "@orchestrator": resolve(import.meta.dirname, "orchestrator/index.ts"),
    },
  },
  test: {
    globals: true,
    // The engine and agentd-client are pure modules with no DOM dependency.
    environment: "node",
    include: ["engine/**/*.test.ts", "agentd-client/**/*.test.ts", "orchestrator/**/*.test.ts", "app/**/*.test.ts"],
  },
});
