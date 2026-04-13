# LBA Analytics SRP Ranks Index Schema

> **Index**: `listing_business_apps-analytics-srp_ranks`
>
> **Purpose**: Search Result Page (SRP) ranking data for listings — tracks where each listing appears in search results over time
>
> **Primary Use Cases**: Listing rank tracking, SRP position monitoring, rank history analysis
>
> **Document Count**: ~8.9M+
>
> **Source**: PostgreSQL table `analytics.srp_ranks` (synced via CDC/ETL — no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `ads_type` | text/keyword | Property type code | `"ho"`, `"la"`, `"ap"` |
| `ads_id` | text/keyword | Listing ID | Exact match via `.keyword` |
| `rank_summary` | text/keyword | Current rank summary JSON | Contains latest rank data |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `ads_type` | text/keyword | Property type short code (see enum below) |
| `ads_id` | text/keyword | Listing ID (maps to listing origin_id) |
| `rank_history` | text/keyword | JSON array of historical rank snapshots (see structure below) |
| `rank_summary` | text/keyword | JSON object with current rank summary (see structure below) |
| `created_at` | text/keyword | Record creation timestamp |
| `created_by` | text/keyword | Creator (typically `"system"`) |
| `updated_at` | text/keyword | Last update timestamp |
| `updated_by` | text/keyword | Updater (typically `"system"`) |
| `deleted_at` | text/keyword | Soft-delete timestamp (null if not deleted) |
| `deleted_by` | text/keyword | Deleter (null if not deleted) |

> **Primary Key**: Composite `(ads_type, ads_id)`
>
> **Go Model**: `internal/pkg/model/listing_performance/srp_rank.go`

---

## Enum Reference

### Property Type Code (`ads_type`)

| Value | Count | Description |
|-------|-------|-------------|
| `ho` | ~5.5M | House (Rumah) |
| `la` | ~1.1M | Land (Tanah) |
| `ap` | ~847K | Apartment (Apartemen) |
| `sh` | ~717K | Shophouse (Ruko) |
| `wa` | ~395K | Warehouse (Gudang) |
| `cs` | ~125K | Commercial Space (Ruang Usaha) |
| `vl` | ~92K | Villa |
| `of` | ~86K | Office (Kantor) |
| `ks` | ~67K | Kost / Boarding House |
| `fa` | ~42K | Factory (Pabrik) |

> **Source**: See `_overview.md` > Property Type Code (Short Code) for full reference

---

## Nested JSON Structures

### `rank_history` (JSON array of snapshots)

Each element in the array is a snapshot of the listing's rank at a point in time. Keys are the rank level (e.g. `"district"`).

```json
[
  {
    "district": {
      "rank": 13,
      "rank_type": 1,
      "page_number": 1,
      "district_name": "papandayan",
      "last_update_at": "2024-08-29T21:00:26Z"
    }
  }
]
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `district.rank` | int | Listing rank position in the district |
| `district.rank_type` | int | Rank type identifier (`1` observed in production) |
| `district.page_number` | int | SRP page number the listing appears on |
| `district.district_name` | string | District name where ranking was calculated |
| `district.last_update_at` | string | Timestamp of this rank snapshot |

### `rank_summary` (JSON object)

Current/latest rank summary. Supports both `district` and `city` level rankings.

**District-level example:**
```json
{
  "district": {
    "rank": 17,
    "rank_type": 1,
    "page_number": 2,
    "district_name": "papandayan",
    "last_update_at": "2026-02-06T05:22:38+07:00"
  }
}
```

**City-level fields** (from Go code `pkg/model/elasticsearch/origin_data.go`):

| Nested Field | Type | Description |
|-------------|------|-------------|
| `city.rank` | int | Listing rank position in the city |
| `city.rank_type` | int | Rank type identifier |
| `city.page_number` | int | SRP page number |
| `city.city_name` | string | City name |
| `city.last_updated_at` | string | Timestamp of rank calculation |
| `city.twenty_four_hour_leap_page` | int | Page jump in the last 24 hours |

> **Note**: Both `rank_history` and `rank_summary` are stored as text/keyword in ES (dynamic mapping). The JSON is stored as a string — you cannot query nested fields directly without scripting.

---

## Query Examples

### Get ranking for a specific listing
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "ads_type.keyword": "ho" }},
        { "term": { "ads_id.keyword": "39835548" }}
      ]
    }
  }
}
```

### All rankings for houses
```json
{
  "query": {
    "term": { "ads_type.keyword": "ho" }
  }
}
```

### Rankings by property type breakdown
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

### Recently updated rankings
```json
{
  "query": {
    "range": { "updated_at.keyword": { "gte": "2026-02-01" }}
  },
  "sort": [{ "updated_at.keyword": "desc" }]
}
```

### Non-deleted rankings only
```json
{
  "query": {
    "bool": {
      "must_not": [
        { "exists": { "field": "deleted_at" }}
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
│  srp_ranks                               │
│  (ads_type + ads_id = listing identity)  │
└────────────┬─────────────────────────────┘
             │ shares ads_type + ads_id
             ▼
┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  listing_performances                    │
│  (ads_type + ads_id = listing identity)  │
│  Daily performance metrics per listing   │
└──────────────────────────────────────────┘
```

- **`ads_type` + `ads_id`** maps to the same listing in `listing_business_apps-analytics-listing_performances`
- **`ads_type`** maps to Property Type Code (Short Code) — see `_overview.md`
- **`ads_id`** corresponds to listing `origin_id` in the `listings-r123-*` and `properties-r123-*` indices
