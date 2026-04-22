// scripts/migrate.ts
import { config as dotenvConfig } from "dotenv";
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Next.js convention: .env.local overrides .env. Load both.
dotenvConfig({ path: ".env.local" });
dotenvConfig();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const sql = postgres(url, { max: 1 });

  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   TEXT PRIMARY KEY,
      ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const dir = path.resolve("db/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const [{ exists } = { exists: false }] = await sql`
      SELECT EXISTS (SELECT 1 FROM _migrations WHERE id = ${file}) AS exists
    `;
    if (exists) {
      console.log(`[skip] ${file}`);
      continue;
    }
    const body = readFileSync(path.join(dir, file), "utf8");
    console.log(`[run]  ${file}`);
    // Safe: migrations read from local fs, not user input.
    await sql.unsafe(body);
    await sql`INSERT INTO _migrations (id) VALUES (${file})`;
  }

  await sql.end();
  console.log("migrations complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
