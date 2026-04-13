import { Client } from "@elastic/elasticsearch";

let client: Client | null = null;

// Allowlist of index patterns the LLM is permitted to query
const ALLOWED_INDEX_PATTERNS = [
  "properties-r123-*",
  "properties-ipropsg",
  "listings-r123-*",
  "listings-ipropsg",
  "users",
  "users-ipropsg",
  "organizations",
  "organizations-ipropsg",
  "enquiries",
  "suggestions-r123-*",
  "suggestions-ipropsg",
  "locations",
  "locations-ipropsg",
  "user-activities",
  "user-seen-listings-*",
  "homepage-advertisements",
  "area-specialists",
  "mail_lead",
  "adcredit-prod_adcredit_accounts",
  "adcredit-prod_adcredit_balances",
  "adcredit-prod_adcredit_transactions",
  "adcredit-prod_adcredit_nudge_events",
  "adcredit-prod_adcredit_nudge_custom_user_groups",
  "adcredit-prod_adcredit_nudge_custom_user_members",
  "adcredit-prod_adcredit_gorp_migrations",
  "listing_business_apps-analytics-*",
  "listing_business_apps-developer_insight-*",
];

const MAX_QUERY_SIZE = 100;

function isIndexAllowed(index: string): boolean {
  return ALLOWED_INDEX_PATTERNS.some((pattern) => {
    if (pattern.endsWith("*")) {
      return index.startsWith(pattern.slice(0, -1));
    }
    return index === pattern;
  });
}

function sanitizeQuery(query: Record<string, unknown>): Record<string, unknown> {
  // Cap size to prevent expensive queries
  if (typeof query.size === "number" && query.size > MAX_QUERY_SIZE) {
    query.size = MAX_QUERY_SIZE;
  } else if (query.size === undefined && !query.aggs) {
    query.size = 20;
  }

  // Strip dangerous fields
  const dangerous = ["script", "script_fields", "runtime_mappings"];
  for (const key of dangerous) {
    if (key in query) {
      delete query[key];
    }
  }

  return query;
}

export function getESClient(): Client {
  if (client) return client;

  client = new Client({
    node: process.env.ES_HOST || "http://localhost:9200",
    auth: {
      username: process.env.ES_USERNAME || "",
      password: process.env.ES_PASSWORD || "",
    },
    ssl: {
      rejectUnauthorized: process.env.ES_VERIFY_CERTS !== "false",
    },
  });

  return client;
}

export async function executeESQuery(
  index: string,
  query: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Validate index against allowlist
  if (!isIndexAllowed(index)) {
    throw new Error(`Index not permitted: ${index}`);
  }

  const sanitized = sanitizeQuery({ ...query });
  const es = getESClient();

  const response = await es.search({
    index,
    body: sanitized,
  });

  return response.body as Record<string, unknown>;
}
