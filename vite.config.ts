import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Single Vite config that doubles as the Vitest config (Vitest reads `test`).
// Aliases are shared by the dev server, the production build, and the tests so
// the framework-free engine/ and agentd-client/ directories resolve the same
// way everywhere.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": resolve(__dirname, "engine/index.ts"),
      "@agentd": resolve(__dirname, "agentd-client/index.ts"),
      "@orchestrator": resolve(__dirname, "orchestrator/index.ts"),
    },
  },
  test: {
    globals: true,
    // The engine and agentd-client are pure modules with no DOM dependency.
    environment: "node",
    include: ["engine/**/*.test.ts", "agentd-client/**/*.test.ts", "orchestrator/**/*.test.ts", "app/**/*.test.ts"],
  },
});
