// src/lib/__tests__/setup.ts
// Vitest setup: load .env.local (Next.js convention) before any test code runs,
// so eager imports like src/lib/db.ts can see DATABASE_URL.
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });
dotenvConfig();
