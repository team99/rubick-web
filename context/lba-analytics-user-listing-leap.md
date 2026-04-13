# LBA Analytics User Listing Leap Index Schema

> **Index**: `listing_business_apps-analytics-user_listing_leap`
>
> **Purpose**: Tracks SRP ranking leaps (improvements/declines) for users' listings -- shows which listings had significant rank changes
>
> **Primary Use Cases**: Rank change monitoring, listing performance alerts, SRP position tracking
>
> **Document Count**: 10K+
>
> **Source**: PostgreSQL table `analytics.user_listing_leap` (synced via CDC/ETL -- no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `user_id` | text/keyword | User's R123 ID (primary key) | Exact match via `.keyword` |
| `last_updated_at` | text/keyword | Last calculation timestamp | Date range queries |
| `leaps` | text/keyword | JSON array of listing rank leap data | Full-text or raw JSON search |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | text/keyword | User's R123 ID (primary key from PostgreSQL) |
| `last_updated_at` | text/keyword | Timestamp of last rank calculation (format: ISO 8601 with timezone) |
| `leaps` | text/keyword | JSON array stored as string containing listing rank leap data (see structure below) |

---

## SQL Schema

```sql
CREATE TABLE IF NOT EXISTS "analytics".user_listing_leap (
    user_id int4 NOT NULL,
    last_updated_at timestamptz NOT NULL,
    leaps jsonb NOT NULL,
    CONSTRAINT user_listing_leap_pkey PRIMARY KEY (user_id)
);
```

> **Note**: All fields use dynamic mapping in ES (text with keyword sub-field). Numeric and timestamp values from PostgreSQL are stored as strings in ES.

---

## Nested JSON Structures

### `leaps` (stored as JSON string)

Contains an array of listing rank change records:
```json
[
  {"id": "hos15151985", "diff": -7, "page": 14},
  {"id": "hos16983353", "diff": -6, "page": 16},
  {"id": "hos16992423", "diff": -6, "page": 10}
]
```

| Sub-field | Type | Description |
|-----------|------|-------------|
| `id` | string | Listing ID in format `{ads_type_prefix}{ads_id}` |
| `diff` | integer | Rank change (negative = dropped, positive = improved) |
| `page` | integer | Current SRP page number where the listing appears |

### Listing ID Prefix Reference

The `id` field in the `leaps` array uses a 2-3 character prefix to denote property type:

| Prefix | Property Type | Indonesian |
|--------|--------------|------------|
| `hos` | House for Sale | Rumah Dijual |
| `aps` | Apartment for Sale | Apartemen Dijual |
| `las` | Land for Sale | Tanah Dijual |
| `shs` | Shop House for Sale | Ruko Dijual |

> **Note**: The prefix format is `{ads_type_prefix}{ads_id}`, where the prefix maps to the property type short code. See `_overview.md` for the full Property Type Code reference.

---

## Go Model Reference

```go
type UserListingLeaps struct {
    UserId       int
    AdsType      string
    AdsId        int
    LastRank     int
    CurrentRank  int
    Leap         int
    LastUpdateAt time.Time
}
```

> The Go model tracks more granular data (individual ranks) than what is stored in the ES document (aggregated leaps array per user).

---

## Relationships

```
┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  user_listing_leap                       │
│  (user_id = R123 user ID)               │
│  (leaps[].id = listing ID)              │
└──────────────────────────────────────────┘
         │                    │
         │ user_id            │ leaps[].id
         ▼                    ▼
┌─────────────────┐   ┌─────────────────────┐
│  users           │   │  listings-r123-*     │
│  (origin_id)     │   │  (origin_id)         │
└─────────────────┘   └─────────────────────┘
```

---

## Query Examples

### Get leap data for a specific user
```json
{
  "query": {
    "term": { "user_id.keyword": "1862709" }
  }
}
```

### Find users with recent rank updates
```json
{
  "query": {
    "range": {
      "last_updated_at.keyword": {
        "gte": "2026-02-01"
      }
    }
  },
  "sort": [{ "last_updated_at.keyword": "desc" }]
}
```

### Search for a specific listing ID within leaps (full-text search on JSON string)
```json
{
  "query": {
    "match": { "leaps": "hos15151985" }
  }
}
```

### Count total documents
```json
{
  "size": 0,
  "query": { "match_all": {} }
}
```

### Find users updated in the last 7 days with pagination
```json
{
  "query": {
    "range": {
      "last_updated_at.keyword": {
        "gte": "now-7d"
      }
    }
  },
  "size": 20,
  "from": 0,
  "sort": [{ "last_updated_at.keyword": "desc" }]
}
```

---

## Notes

- The `leaps` field is a JSON array stored as a string in ES due to dynamic mapping. To query individual listing IDs within the array, use full-text `match` queries on the `leaps` field (ES will tokenize the JSON string).
- For exact JSON value filtering, application-level parsing is required after retrieval.
- This index is part of the `listing_business_apps` domain, sourced from the `rumah123-listing` repository.
- Related indices: [`lba-analytics-district-performances.md`](./lba-analytics-district-performances.md), [`lba-analytics-market-price-references.md`](./lba-analytics-market-price-references.md)
