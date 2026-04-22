import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // Load .env.local so DB-adjacent imports (src/lib/db.ts) find DATABASE_URL.
    // We use Vite's envDir+envPrefix route via a tiny setup file to also pick up
    // Next.js's .env.local convention (which isn't a Vite default).
    setupFiles: ["src/lib/__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
