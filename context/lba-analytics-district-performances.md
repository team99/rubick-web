# LBA Analytics District Performances Index Schema

> **Index**: `listing_business_apps-analytics-district_performances`
>
> **Purpose**: Repost activity performance data aggregated by district -- tracks how many listings are being reposted in each district
>
> **Primary Use Cases**: District-level repost analytics, regional activity monitoring, user repost behavior analysis
>
> **Document Count**: 4,163
>
> **Source**: PostgreSQL table `analytics.district_performances` (synced via CDC/ETL -- no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `district_id` | text/keyword | District ID (primary key) | Exact match via `.keyword` |
| `district_name` | text/keyword | District name | Text search or `.keyword` exact match |
| `city_name` | text/keyword | City name | Text search or `.keyword` exact match |
| `province_name` | text/keyword | Province name | Text search or `.keyword` exact match |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `district_id` | text/keyword | District ID (primary key from PostgreSQL) |
| `district_name` | text/keyword | District name (e.g. `"Bulu"`) |
| `city_name` | text/keyword | City name (e.g. `"Sukoharjo"`) |
| `province_name` | text/keyword | Province name (e.g. `"Jawa Tengah"`) |
| `performance_data` | text/keyword | JSON array of weekly repost performance data (see structure below) |
| `updated_time` | text/keyword | Last update timestamp (format: `YYYY-MM-DD HH:mm:ss`) |

---

## SQL Schema

```sql
CREATE TABLE IF NOT EXISTS "analytics".district_performances (
    district_id int4 NOT NULL,
    district_name varchar(64) NOT NULL,
    city_name varchar(64) NOT NULL,
    province_name varchar(64) NOT NULL,
    performance_data jsonb NOT NULL,
    updated_time timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT district_performances_pkey PRIMARY KEY (district_id)
);
```

> **Note**: All fields use dynamic mapping in ES (text with keyword sub-field). Numeric IDs and timestamps from PostgreSQL are stored as strings in ES.

---

## Nested JSON Structures

### `performance_data` (stored as JSON string)

Contains an array of weekly repost activity records:
```json
[
  {
    "date": "2024-03-11T00:00:00",
    "total_repost": 1,
    "3_latest_repost_user_ids": [1485967]
  }
]
```

| Sub-field | Type | Description |
|-----------|------|-------------|
| `date` | string (ISO 8601) | Start date of the weekly period |
| `total_repost` | integer | Total number of reposts in this district for the period |
| `3_latest_repost_user_ids` | integer array | Up to 3 most recent user IDs who reposted in this district |

> **Note**: The `3_latest_repost_user_ids` field provides a quick reference to the most active reposters in each district without needing a separate lookup.

---

## Relationships

```
┌──────────────────────────────────────────┐
│  listing_business_apps-analytics-        │
│  district_performances                   │
│  (district_id, district_name,            │
│   city_name, province_name)              │
└──────────────────────────────────────────┘
         │
         │ district_id / city_name / province_name
         ▼
┌─────────────────────────────────────┐
│  locations                           │
│  (location hierarchy reference)      │
│  district → city → province          │
└─────────────────────────────────────┘
```

---

## Query Examples

### Get performance data for a specific district
```json
{
  "query": {
    "term": { "district_id.keyword": "3171" }
  }
}
```

### Find districts by city name
```json
{
  "query": {
    "term": { "city_name.keyword": "Sukoharjo" }
  }
}
```

### Search districts by province
```json
{
  "query": {
    "term": { "province_name.keyword": "Jawa Tengah" }
  }
}
```

### Full-text search on district name
```json
{
  "query": {
    "match": { "district_name": "Bulu" }
  }
}
```

### Find all districts in a province with pagination
```json
{
  "query": {
    "term": { "province_name.keyword": "DKI Jakarta" }
  },
  "size": 50,
  "from": 0,
  "sort": [{ "district_name.keyword": "asc" }]
}
```

### Count districts per province (aggregation)
```json
{
  "size": 0,
  "aggs": {
    "by_province": {
      "terms": { "field": "province_name.keyword", "size": 50 }
    }
  }
}
```

### Count districts per city (aggregation)
```json
{
  "size": 0,
  "aggs": {
    "by_city": {
      "terms": { "field": "city_name.keyword", "size": 100 }
    }
  }
}
```

### Search for a specific user ID in performance data (full-text on JSON string)
```json
{
  "query": {
    "match": { "performance_data": "1485967" }
  }
}
```

---

## Notes

- The `performance_data` field is a JSON array stored as a string in ES due to dynamic mapping. To query specific dates or repost counts within the array, use full-text `match` queries (ES tokenizes the JSON string) or retrieve and parse at the application level.
- Each document represents one district with its full repost history in the `performance_data` array.
- District, city, and province names are denormalized (stored directly) rather than using ID references, making queries simpler but requiring updates if location names change.
- This index is part of the `listing_business_apps` domain, sourced from the `rumah123-listing` repository.
- Related indices: [`lba-analytics-user-listing-leap.md`](./lba-analytics-user-listing-leap.md), [`lba-analytics-market-price-references.md`](./lba-analytics-market-price-references.md)
