# LBA Analytics User Listing Recommendation Index Schema

> **Index**: `listing_business_apps-analytics-user_listing_recommendation`
>
> **Purpose**: Personalized listing recommendations for each user — suggests which listings to boost or take action on
>
> **Primary Use Cases**: User recommendation engine, listing boost suggestions, agent engagement nudges
>
> **Document Count**: ~10K+
>
> **Source**: PostgreSQL table `analytics.user_listing_recommendation` (synced via CDC/ETL — no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `user_id` | text/keyword | User's R123 ID | Exact match via `.keyword` |
| `recommendations` | text/keyword | JSON object with v1 and v2 recommendation lists | Contains listing recommendations |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | text/keyword | User's Rumah123 ID (primary key, maps to `users.origin_id`) |
| `last_updated_at` | text/keyword | Last update timestamp |
| `recommendations` | text/keyword | JSON object containing v1 and v2 recommendation lists (see structure below) |

> **Primary Key**: `user_id`

---

## Nested JSON Structures

### `recommendations` (JSON object)

Contains two versions of recommendation lists: `v1` (flat list) and `v2` (grouped by type).

**Full structure example:**
```json
{
  "v1": [
    {"id": "hos39718509", "type": 6},
    {"id": "hos18262896", "type": 1}
  ],
  "v2": [
    {
      "type": 6,
      "listings": [
        {"id": "hos39718509", "actual_type": 6}
      ]
    },
    {
      "type": 1,
      "listings": [
        {"id": "hos18262896", "actual_type": 1}
      ]
    }
  ]
}
```

### v1 — Flat Recommendation List

| Nested Field | Type | Description |
|-------------|------|-------------|
| `id` | string | Listing identifier (format: `{ads_type_code}s{ads_id}`, e.g. `"hos39718509"`) |
| `type` | int | Recommendation type (see enum below) |

### v2 — Grouped Recommendation List

| Nested Field | Type | Description |
|-------------|------|-------------|
| `type` | int | Recommendation type (see enum below) |
| `listings` | array | Array of listing objects for this recommendation type |
| `listings[].id` | string | Listing identifier (same format as v1) |
| `listings[].actual_type` | int | The actual recommendation type for this listing |

> **Note**: `recommendations` is stored as text/keyword in ES (dynamic mapping). The JSON is stored as a string — you cannot query nested fields directly without scripting.
>
> **Go Model**: `ListingRecommendation` struct with `ID` (string) and `Type` (int)

---

## Enum Reference

### Recommendation Type (`type`)

| Value | Description |
|-------|-------------|
| `1` | Observed in production (specific meaning TBD) |
| `2` | Observed in production (specific meaning TBD) |
| `3` | Observed in production (specific meaning TBD) |
| `6` | Observed in production (specific meaning TBD) |
| `7` | Observed in production (specific meaning TBD) |

> **Note**: Exact recommendation type meanings require confirmation from the `rumah123-listing` team. Values 1, 2, 3, 6, 7 have been observed in production data.

### Listing ID Format

The `id` field in recommendations uses a composite format:

| Prefix | Property Type |
|--------|--------------|
| `hos` | House (ho + s) |
| `las` | Land (la + s) |
| `aps` | Apartment (ap + s) |
| `shs` | Shophouse (sh + s) |
| `was` | Warehouse (wa + s) |
| `css` | Commercial Space (cs + s) |
| `vls` | Villa (vl + s) |
| `ofs` | Office (of + s) |
| `kss` | Kost (ks + s) |
| `fas` | Factory (fa + s) |

> Format: `{ads_type}s{ads_id}` — the `s` likely stands for "sale" channel

---

## Query Examples

### Get recommendations for a specific user
```json
{
  "query": {
    "term": { "user_id.keyword": "1112495" }
  }
}
```

### All recommendation records updated recently
```json
{
  "query": {
    "range": { "last_updated_at.keyword": { "gte": "2026-02-01" }}
  },
  "sort": [{ "last_updated_at.keyword": "desc" }]
}
```

### Count total recommendation records
```json
{
  "query": { "match_all": {} },
  "track_total_hits": true,
  "size": 0
}
```

### Check if a user has recommendations
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "user_id.keyword": "1112495" }},
        { "exists": { "field": "recommendations" }}
      ]
    }
  },
  "_source": ["user_id", "last_updated_at"],
  "size": 1
}
```

---

## Relationships

```
┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  user_listing_recommendation             │
│  (user_id = user identity)               │
│  (recommendations contain listing IDs)   │
└────┬──────────────────────────────────────┘
     │
     │ user_id
     ▼
┌──────────────────────────────────────────┐
│  users                                   │
│  (origin_id = user_id)                   │
└──────────────────────────────────────────┘

Recommended listings (from recommendations JSON) link to:

┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  listing_performances                    │
│  (ads_type + ads_id from listing ID)     │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  srp_ranks                               │
│  (ads_type + ads_id from listing ID)     │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  user_best_repost_listings               │
│  (user_id + ads_type + ads_id)           │
│  Best repost suggestion for same user    │
└──────────────────────────────────────────┘
```

- **`user_id`** maps to `origin_id` in the `users` index
- Listing IDs within `recommendations` (e.g. `"hos39718509"`) can be decomposed to `ads_type=ho` + `ads_id=39718509` to look up the same listing in:
  - `listing_business_apps-analytics-listing_performances` (daily metrics)
  - `listing_business_apps-analytics-srp_ranks` (SRP ranking)
  - `listing_business_apps-analytics-user_best_repost_listings` (repost recommendations for same user)
- **`ads_type`** prefix maps to Property Type Code (Short Code) — see `_overview.md`
- **`ads_id`** suffix corresponds to listing `origin_id` in the `listings-r123-*` and `properties-r123-*` indices
