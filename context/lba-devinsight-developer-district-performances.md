# LBA Developer Insight — Developer District Performances Index Schema

> **Index**: `listing_business_apps-developer_insight-developer_district_performances`
>
> **Purpose**: Daily performance metrics for developer listings aggregated by district — used in the Developer Insight dashboard for district-level analytics
>
> **Primary Use Cases**: District-level performance dashboards, geographic drill-down analytics, city/province filtering, developer insight reporting
>
> **Document Count**: ~5,844
>
> **Source**: PostgreSQL table `developer_insight.developer_district_performances` (synced via CDC/ETL — no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `district_id` | text/keyword | District ID (primary key) | Exact match via `.keyword` |
| `district_name` | text/keyword | District name | Full-text or `.keyword` match |
| `city_id` | text/keyword | City ID (FK to developer_city_performances) | Exact match via `.keyword` |
| `city_name` | text/keyword | City name | Full-text or `.keyword` match |
| `province_name` | text/keyword | Province name | `.keyword` for filtering by province |
| `performance_data` | nested/object | JSON array of daily performance metrics | Contains daily impressions/views/enquiries |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `district_id` | text/keyword | District ID — primary key |
| `district_name` | text/keyword | District name (e.g. `"Kota Juang"`) |
| `city_id` | text/keyword | City ID — foreign key to `developer_city_performances.city_id` |
| `city_name` | text/keyword | City name (e.g. `"Bireun"`) |
| `province_name` | text/keyword | Province name (e.g. `"Aceh"`) |
| `performance_data` | nested/object | JSON array of daily performance metrics (see structure below) |

> **Primary Key**: `district_id`
>
> **Foreign Key**: `city_id` references `developer_city_performances.city_id`

---

## SQL Schema

```sql
CREATE TABLE "developer_insight".developer_district_performances (
    district_id SERIAL PRIMARY KEY,
    district_name VARCHAR NOT NULL,
    city_id INT NOT NULL REFERENCES "developer_insight".developer_city_performances(city_id),
    city_name VARCHAR NOT NULL,
    province_name VARCHAR NOT NULL,
    performance_data JSONB NOT NULL
);
```

---

## Nested JSON Structures

### `performance_data` (JSON array of daily metrics)

Each element represents one day of aggregated performance data for all developer listings in the district.

```json
[
  {
    "date": "2025-06-02",
    "views": 0,
    "enquiries": 0,
    "impressions": 3
  }
]
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `date` | string | Date of the metrics snapshot (YYYY-MM-DD) |
| `impressions` | int | Number of times developer listings in this district appeared in search results |
| `views` | int | Number of listing detail page views for developer listings in this district |
| `enquiries` | int | Number of enquiries received for developer listings in this district |

> **Note**: `performance_data` is stored as text/keyword in ES (dynamic mapping). The JSON is stored as a string — you cannot query nested fields directly without scripting.

---

## Query Examples

### Get performance data for a specific district
```json
{
  "query": {
    "term": { "district_id.keyword": "501" }
  }
}
```

### Search districts by name
```json
{
  "query": {
    "match": { "district_name": "Kota Juang" }
  }
}
```

### Get all districts in a specific city
```json
{
  "query": {
    "term": { "city_id.keyword": "101" }
  },
  "sort": [{ "district_name.keyword": "asc" }]
}
```

### Filter all districts in a specific province
```json
{
  "query": {
    "term": { "province_name.keyword": "Aceh" }
  },
  "size": 100
}
```

### Filter districts by city and province
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "province_name.keyword": "Aceh" }},
        { "term": { "city_name.keyword": "Bireun" }}
      ]
    }
  }
}
```

### Count districts per city
```json
{
  "size": 0,
  "aggs": {
    "by_city": {
      "terms": { "field": "city_name.keyword", "size": 500 }
    }
  }
}
```

### Count districts per province
```json
{
  "size": 0,
  "aggs": {
    "by_province": {
      "terms": { "field": "province_name.keyword", "size": 50 },
      "aggs": {
        "district_count": {
          "value_count": { "field": "district_id.keyword" }
        }
      }
    }
  }
}
```

### Get district names and IDs for a specific city (lookup)
```json
{
  "query": {
    "term": { "city_id.keyword": "101" }
  },
  "_source": ["district_id", "district_name", "city_name", "province_name"],
  "size": 100
}
```

---

## Relationships

```
┌──────────────────────────────────────────────────┐
│  developer_city_performances                     │
│  (city_id = primary key)                         │
└──────┬───────────────────────────────────────────┘
       │ 1:N
       ▼
┌──────────────────────────────────────────────────┐
│  developer_district_performances                 │
│  (city_id → developer_city_performances.city_id) │  ← this index
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

developer_city_performances (city_id)
    └── 1:N → developer_district_performances (city_id)    ← this index
```

- **`district_id`** is the primary key for this index
- **`city_id`** is a foreign key referencing `developer_city_performances.city_id` — use it to join district data with city-level aggregations
- `city_name` and `province_name` are denormalized from the city table for convenience in querying
- All four performance indices (inhouse, all-agent, city, district) share the same `performance_data` JSON structure (date, views, enquiries, impressions)
- For city-level aggregations, see `lba-devinsight-developer-city-performances.md`
- For project-level performance, see `lba-devinsight-developer-project-inhouse-performances.md` and `lba-devinsight-developer-project-all-agent-performances.md`
