import fs from "fs";
import path from "path";

let cachedContext: string | null = null;

export function getESContext(): string {
  if (cachedContext && process.env.NODE_ENV !== "development") {
    return cachedContext;
  }

  const contextDir = path.join(process.cwd(), "context");

  let files: string[];
  try {
    files = fs.readdirSync(contextDir).filter((f) => f.endsWith(".md"));
  } catch {
    console.error(
      `[es-context] Context directory not found: ${contextDir}. Create it with .md schema files.`
    );
    return "No Elasticsearch schema documentation available. Ask the user to clarify which index and fields to query.";
  }

  if (files.length === 0) {
    console.warn("[es-context] No .md files found in context directory.");
    return "No Elasticsearch schema documentation available.";
  }

  // Load _overview.md and business-context.md first, then the rest
  const priority = ["_overview.md", "business-context.md"];
  const sorted = [
    ...priority.filter((f) => files.includes(f)),
    ...files.filter((f) => !priority.includes(f)).sort(),
  ];

  const parts = sorted.map((file) => {
    return fs.readFileSync(path.join(contextDir, file), "utf-8");
  });

  cachedContext = parts.join("\n\n---\n\n");
  return cachedContext;
}
