# LBA Analytics User Best Repost Listings Index Schema

> **Index**: `listing_business_apps-analytics-user_best_repost_listings`
>
> **Purpose**: Tracks the best listing for each user to repost — based on predicted impression increase percentage
>
> **Primary Use Cases**: Repost recommendations, agent nudge targeting, listing optimization suggestions
>
> **Document Count**: ~10K+
>
> **Source**: PostgreSQL table `analytics.user_best_repost_listings` (synced via CDC/ETL — no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `user_id` | text/keyword | User's R123 ID | Exact match via `.keyword` |
| `ads_type` | text/keyword | Property type code | `"ho"`, `"la"`, `"ap"` |
| `ads_id` | text/keyword | Listing ID | Exact match via `.keyword` |
| `date_time` | text/keyword | Calculation date/time | Date range queries |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Record ID (auto-generated) |
| `date_time` | text/keyword | Calculation date/time (format: `YYYY-MM-DD HH:mm:ss.SSSSSS`) |
| `user_id` | text/keyword | User's Rumah123 ID (maps to `users.origin_id`) |
| `ads_type` | text/keyword | Property type short code (see enum below) |
| `ads_id` | text/keyword | Listing ID (maps to listing origin_id) |
| `impression_increase_percentage` | text/keyword | Predicted impression increase if listing is reposted (stored as string, e.g. `"0"`) |
| `last_updated_at` | text/keyword | Last update timestamp (format: `YYYY-MM-DD HH:mm:ss.SSSSSS`) |

> **Primary Key**: `date_time`

---

## Enum Reference

### Property Type Code (`ads_type`)

| Value | Description |
|-------|-------------|
| `ho` | House (Rumah) |
| `la` | Land (Tanah) |
| `ap` | Apartment (Apartemen) |
| `sh` | Shophouse (Ruko) |
| `wa` | Warehouse (Gudang) |
| `cs` | Commercial Space (Ruang Usaha) |
| `vl` | Villa |
| `of` | Office (Kantor) |
| `ks` | Kost / Boarding House |
| `fa` | Factory (Pabrik) |

> **Source**: See `_overview.md` > Property Type Code (Short Code) for full reference

---

## Sample Document

```json
{
  "id": "6928118",
  "date_time": "2026-01-21 17:04:09.552671",
  "user_id": "1112495",
  "ads_type": "ho",
  "ads_id": "39835548",
  "impression_increase_percentage": "0",
  "last_updated_at": "2026-01-28 17:04:08.446311"
}
```

---

## Query Examples

### Get best repost listing for a specific user
```json
{
  "query": {
    "term": { "user_id.keyword": "1112495" }
  },
  "sort": [{ "date_time.keyword": "desc" }],
  "size": 1
}
```

### All repost recommendations for houses
```json
{
  "query": {
    "term": { "ads_type.keyword": "ho" }
  }
}
```

### Recommendations calculated in a date range
```json
{
  "query": {
    "range": { "date_time.keyword": { "gte": "2026-01-01", "lte": "2026-01-31" }}
  }
}
```

### Breakdown by property type
```json
{
  "size": 0,
  "aggs": {
    "by_ads_type": {
      "terms": { "field": "ads_type.keyword", "size": 20 }
    }
  }
}
```

### Find recommendations with non-zero impression increase
```json
{
  "query": {
    "bool": {
      "must_not": [
        { "term": { "impression_increase_percentage.keyword": "0" }}
      ]
    }
  }
}
```

---

## Relationships

```
┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  user_best_repost_listings               │
│  (user_id = user identity)               │
│  (ads_type + ads_id = listing identity)  │
└────┬──────────────┬──────────────────────┘
     │              │
     │ user_id      │ ads_type + ads_id
     ▼              ▼
┌──────────┐   ┌──────────────────────────────────┐
│  users   │   │  listing_business_apps-analytics- │
│          │   │  listing_performances             │
│          │   │  (daily metrics for same listing) │
└──────────┘   └──────────────────────────────────┘
                    │
                    │ ads_type + ads_id
                    ▼
               ┌──────────────────────────────────┐
               │  listing_business_apps-analytics- │
               │  srp_ranks                        │
               │  (SRP ranking for same listing)   │
               └──────────────────────────────────┘
```

- **`user_id`** maps to `origin_id` in the `users` index
- **`ads_type` + `ads_id`** maps to the same listing in `listing_business_apps-analytics-listing_performances` and `listing_business_apps-analytics-srp_ranks`
- **`ads_type`** maps to Property Type Code (Short Code) — see `_overview.md`
- **`ads_id`** corresponds to listing `origin_id` in the `listings-r123-*` and `properties-r123-*` indices
- Repost actions consume ad credits tracked in `adcredit-prod_adcredit_transactions` (with `tags.bucket_type = "Regular"`)
