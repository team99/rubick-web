# LBA Developer Insight — Developer City Performances Index Schema

> **Index**: `listing_business_apps-developer_insight-developer_city_performances`
>
> **Purpose**: Daily performance metrics for developer listings aggregated by city — used in the Developer Insight dashboard for city-level analytics
>
> **Primary Use Cases**: City-level performance dashboards, geographic analytics, province-based filtering, developer insight reporting
>
> **Document Count**: ~439
>
> **Source**: PostgreSQL table `developer_insight.developer_city_performances` (synced via CDC/ETL — no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `city_id` | text/keyword | City ID (primary key) | Exact match via `.keyword` |
| `city_name` | text/keyword | City name | Full-text or `.keyword` match |
| `province_name` | text/keyword | Province name | `.keyword` for filtering by province |
| `performance_data` | nested/object | JSON array of daily performance metrics | Contains daily impressions/views/enquiries |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `city_id` | text/keyword | City ID — primary key |
| `city_name` | text/keyword | City name (e.g. `"Pidie Jaya"`) |
| `province_name` | text/keyword | Province name (e.g. `"Aceh"`) |
| `performance_data` | nested/object | JSON array of daily performance metrics (see structure below) |

> **Primary Key**: `city_id`

---

## SQL Schema

```sql
CREATE TABLE "developer_insight".developer_city_performances (
    city_id SERIAL PRIMARY KEY,
    city_name VARCHAR NOT NULL,
    province_name VARCHAR NOT NULL,
    performance_data JSONB NOT NULL
);
```

---

## Nested JSON Structures

### `performance_data` (JSON array of daily metrics)

Each element represents one day of aggregated performance data for all developer listings in the city.

```json
[
  {
    "date": "2025-02-10",
    "views": 0,
    "enquiries": 0,
    "impressions": 21
  }
]
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `date` | string | Date of the metrics snapshot (YYYY-MM-DD) |
| `impressions` | int | Number of times developer listings in this city appeared in search results |
| `views` | int | Number of listing detail page views for developer listings in this city |
| `enquiries` | int | Number of enquiries received for developer listings in this city |

> **Note**: `performance_data` is stored as text/keyword in ES (dynamic mapping). The JSON is stored as a string — you cannot query nested fields directly without scripting.

---

## Query Examples

### Get performance data for a specific city
```json
{
  "query": {
    "term": { "city_id.keyword": "101" }
  }
}
```

### Search cities by name
```json
{
  "query": {
    "match": { "city_name": "Pidie Jaya" }
  }
}
```

### Filter all cities in a specific province
```json
{
  "query": {
    "term": { "province_name.keyword": "Aceh" }
  }
}
```

### List all cities with performance data, sorted by city name
```json
{
  "query": {
    "match_all": {}
  },
  "size": 50,
  "sort": [{ "city_name.keyword": "asc" }]
}
```

### Count cities per province
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

### Get all cities in a province with their names
```json
{
  "query": {
    "term": { "province_name.keyword": "Jawa Barat" }
  },
  "_source": ["city_id", "city_name", "province_name"],
  "size": 100
}
```

---

## Relationships

```
┌──────────────────────────────────────────────────┐
│  developer_city_performances                     │
│  (city_id = primary key)                         │  ← this index
└──────┬───────────────────────────────────────────┘
       │ 1:N
       ▼
┌──────────────────────────────────────────────────┐
│  developer_district_performances                 │
│  (city_id → developer_city_performances.city_id) │
│  (district_id = primary key)                     │
└──────────────────────────────────────────────────┘
```

### Full Developer Insight Relationship Map

```
project
    ├── 1:1 → developer_project_inhouse_performances (project_id)
    ├── 1:1 → developer_project_all_agent_performances (project_id)
    ├── 1:1 → developer_project_total_listing_type (project_id)
    ├── 1:N → in_house_recommendations (project_id)
    └── 1:1 → total_agents_summaries (project_id)

developer_city_performances (city_id)              ← this index
    └── 1:N → developer_district_performances (city_id)
```

- **`city_id`** is the primary key and is referenced by `developer_district_performances` as a foreign key
- All four performance indices (inhouse, all-agent, city, district) share the same `performance_data` JSON structure (date, views, enquiries, impressions)
- For district-level breakdowns within a city, see `lba-devinsight-developer-district-performances.md`
- For project-level performance, see `lba-devinsight-developer-project-inhouse-performances.md` and `lba-devinsight-developer-project-all-agent-performances.md`
