// src/lib/db.ts
import postgres from "postgres";

declare global {
  var __rubickSql: ReturnType<typeof postgres> | undefined;
}

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });
}

export const sql = global.__rubickSql ?? makeClient();
if (process.env.NODE_ENV !== "production") {
  global.__rubickSql = sql;
}
