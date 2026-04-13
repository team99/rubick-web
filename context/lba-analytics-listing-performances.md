# LBA Analytics Listing Performances Index Schema

> **Index**: `listing_business_apps-analytics-listing_performances`
>
> **Purpose**: Daily performance metrics (impressions, views, enquiries, phone calls, WhatsApp, FB leadgen) for each listing
>
> **Primary Use Cases**: Listing performance dashboards, engagement analytics, agent reporting, impression tracking
>
> **Document Count**: ~12.6M+
>
> **Source**: PostgreSQL table `analytics.listing_performances` (synced via CDC/ETL — no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `ads_type` | text/keyword | Property type code | `"ho"`, `"la"`, `"ap"` |
| `ads_id` | text/keyword | Listing ID | Exact match via `.keyword` |
| `performance_summary_data` | text/keyword | Aggregated summary JSON | Contains totals for recent period |
| `updated_time` | text/keyword | Last update timestamp | Date range queries |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `ads_type` | text/keyword | Property type short code — `bpchar(2)` in PG (see enum below) |
| `ads_id` | text/keyword | Listing ID (maps to listing origin_id) |
| `performance_data` | text/keyword | JSON array of daily performance metrics (see structure below) |
| `performance_summary_data` | text/keyword | JSON object with aggregated summary for recent period (see structure below) |
| `updated_time` | text/keyword | Last update timestamp |

> **Primary Key**: Composite `(ads_type, ads_id)`

---

## Enum Reference

### Property Type Code (`ads_type`)

| Value | Count | Description |
|-------|-------|-------------|
| `ho` | ~8.1M | House (Rumah) |
| `la` | ~1.5M | Land (Tanah) |
| `ap` | ~1.1M | Apartment (Apartemen) |
| `sh` | ~915K | Shophouse (Ruko) |
| `wa` | ~460K | Warehouse (Gudang) |
| `cs` | ~190K | Commercial Space (Ruang Usaha) |
| `vl` | ~120K | Villa |
| `of` | ~110K | Office (Kantor) |
| `ks` | ~90K | Kost / Boarding House |
| `fa` | ~55K | Factory (Pabrik) |

> **Source**: See `_overview.md` > Property Type Code (Short Code) for full reference

---

## Nested JSON Structures

### `performance_data` (JSON array of daily metrics)

Each element represents one day of performance data for the listing.

```json
[
  {
    "date": "2023-08-23T00:00:00",
    "views": 1,
    "phones": 2,
    "enquiries": 2,
    "whatsapps": 0,
    "fb_leadgen": 0,
    "impressions": 1
  }
]
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `date` | string | Date of the metrics snapshot (ISO 8601) |
| `impressions` | int | Number of times listing appeared in search results |
| `views` | int | Number of listing detail page views |
| `enquiries` | int | Number of email/form enquiries received |
| `phones` | int | Number of phone call leads |
| `whatsapps` | int | Number of WhatsApp leads |
| `fb_leadgen` | int | Number of Facebook lead generation conversions |

### `performance_summary_data` (JSON object)

Aggregated totals for a recent date window.

```json
{
  "end_to": "2026-02-05",
  "start_from": "2026-01-30",
  "total_views": 0,
  "total_enquiries": 0,
  "total_impressions": 0
}
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `start_from` | string | Start date of the summary period (YYYY-MM-DD) |
| `end_to` | string | End date of the summary period (YYYY-MM-DD) |
| `total_impressions` | int | Total impressions in the period |
| `total_views` | int | Total detail page views in the period |
| `total_enquiries` | int | Total enquiries in the period |

> **Note**: Both `performance_data` and `performance_summary_data` are stored as text/keyword in ES (dynamic mapping). The JSON is stored as a string — you cannot query nested fields directly without scripting.

---

## Query Examples

### Get performance data for a specific listing
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

### All performance records for apartments
```json
{
  "query": {
    "term": { "ads_type.keyword": "ap" }
  }
}
```

### Performance records by property type breakdown
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

### Recently updated performance records
```json
{
  "query": {
    "range": { "updated_time.keyword": { "gte": "2026-02-01" }}
  },
  "sort": [{ "updated_time.keyword": "desc" }]
}
```

### Count listings per property type
```json
{
  "size": 0,
  "aggs": {
    "by_type": {
      "terms": { "field": "ads_type.keyword", "size": 20 },
      "aggs": {
        "total": { "value_count": { "field": "ads_id.keyword" }}
      }
    }
  }
}
```

---

## Relationships

```
┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  listing_performances                    │
│  (ads_type + ads_id = listing identity)  │
└────────────┬─────────────────────────────┘
             │ shares ads_type + ads_id
             ▼
┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  srp_ranks                               │
│  (ads_type + ads_id = listing identity)  │
│  SRP ranking data per listing            │
└──────────────────────────────────────────┘
```

- **`ads_type` + `ads_id`** maps to the same listing in `listing_business_apps-analytics-srp_ranks`
- **`ads_type`** maps to Property Type Code (Short Code) — see `_overview.md`
- **`ads_id`** corresponds to listing `origin_id` in the `listings-r123-*` and `properties-r123-*` indices
- Performance metrics (phones, enquiries, whatsapps) relate to leads tracked in the `enquiries` index
