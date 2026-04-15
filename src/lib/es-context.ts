import fs from "fs";
import path from "path";

const contextDir = path.join(process.cwd(), "context");

// --- Caches ---
let cachedSlimContext: string | null = null;
let cachedFullContext: string | null = null;
const schemaCache = new Map<string, string>();

// --- Schema file identifiers (auto-discovered) ---
let schemaIds: string[] | null = null;

function getSchemaIds(): string[] {
  if (schemaIds) return schemaIds;
  try {
    schemaIds = fs
      .readdirSync(contextDir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_overview") && f !== "business-context.md")
      .map((f) => f.replace(".md", ""))
      .sort();
  } catch {
    schemaIds = [];
  }
  return schemaIds;
}

/**
 * Slim context for the system prompt: overview + business context only.
 * ~8-10K tokens instead of ~60K.
 */
export function getSlimContext(): string {
  if (cachedSlimContext && process.env.NODE_ENV !== "development") {
    return cachedSlimContext;
  }

  const files = ["_overview-slim.md", "business-context.md"];
  const parts: string[] = [];

  for (const file of files) {
    const filePath = path.join(contextDir, file);
    try {
      parts.push(fs.readFileSync(filePath, "utf-8"));
    } catch {
      console.warn(`[es-context] Missing: ${file}`);
    }
  }

  cachedSlimContext = parts.join("\n\n---\n\n");
  return cachedSlimContext;
}

/**
 * Load specific schema files by identifier.
 * e.g. getSchemaFiles(["enquiries", "users"]) loads enquiries.md + users.md
 */
const MAX_SCHEMAS = 5;

export function getSchemaFiles(identifiers: string[]): string {
  const validIds = getSchemaIds();
  const requested = identifiers.slice(0, MAX_SCHEMAS);
  const parts: string[] = [];

  for (const id of requested) {
    if (!validIds.includes(id)) {
      parts.push(`[Unknown schema: "${id}". Valid identifiers: ${validIds.join(", ")}]`);
      continue;
    }

    if (!schemaCache.has(id) || process.env.NODE_ENV === "development") {
      const content = fs.readFileSync(path.join(contextDir, `${id}.md`), "utf-8");
      schemaCache.set(id, content);
    }

    parts.push(schemaCache.get(id)!);
  }

  if (identifiers.length > MAX_SCHEMAS) {
    parts.push(`[Note: Only first ${MAX_SCHEMAS} schemas loaded. Request fewer schemas at a time.]`);
  }

  return parts.join("\n\n---\n\n");
}

/**
 * List all valid schema identifiers.
 */
export function getSchemaFileList(): string[] {
  return getSchemaIds();
}

/**
 * Full context (all files). Kept for backward compatibility.
 */
export function getESContext(): string {
  if (cachedFullContext && process.env.NODE_ENV !== "development") {
    return cachedFullContext;
  }

  let files: string[];
  try {
    files = fs.readdirSync(contextDir).filter((f) => f.endsWith(".md"));
  } catch {
    console.error(`[es-context] Context directory not found: ${contextDir}.`);
    return "No Elasticsearch schema documentation available.";
  }

  if (files.length === 0) {
    return "No Elasticsearch schema documentation available.";
  }

  const priority = ["_overview.md", "business-context.md"];
  const sorted = [
    ...priority.filter((f) => files.includes(f)),
    ...files.filter((f) => !priority.includes(f)).sort(),
  ];

  const parts = sorted.map((file) => {
    return fs.readFileSync(path.join(contextDir, file), "utf-8");
  });

  cachedFullContext = parts.join("\n\n---\n\n");
  return cachedFullContext;
}
