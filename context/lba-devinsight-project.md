# LBA Developer Insight Project Index Schema

> **Index**: `listing_business_apps-developer_insight-project`
>
> **Purpose**: Developer project master data -- reference table linking projects to locations and property types
>
> **Primary Use Cases**: Project lookups, location-based project filtering, developer insight reference data
>
> **Document Count**: 2
>
> **Source**: PostgreSQL table `developer_insight.project` (synced via CDC/ETL -- no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `project_id` | text/keyword | Project ID (primary key) | Exact match via `.keyword` |
| `district_id` | text/keyword | District ID | Exact match via `.keyword` |
| `city_id` | text/keyword | City ID | Exact match via `.keyword` |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | text/keyword | Project ID (auto-increment primary key from PostgreSQL) |
| `district_id` | text/keyword | District ID reference |
| `city_id` | text/keyword | City ID reference |
| `property_types` | object | Array of property type codes (e.g. `["ho","ap"]`) -- stored as empty object `{}` in current ES data |

> **Note**: `project_name` exists in the PostgreSQL table but is NOT present in the ES index.

---

## SQL Schema

```sql
CREATE TABLE "developer_insight".project (
    project_id SERIAL PRIMARY KEY,
    project_name VARCHAR NOT NULL,
    district_id INT,
    city_id INT,
    property_types CHAR(2)[]
);
```

> **Note**: The PostgreSQL `CHAR(2)[]` array type for `property_types` is mapped as an `object` type in ES due to dynamic mapping. In current production data, this field appears as an empty object `{}`. The `project_name` column is excluded from the ES sync.

---

## Enum Reference

### Property Type Codes (`property_types`)

Expected values in the `property_types` array (when populated):

| Code | Type | Indonesian |
|------|------|------------|
| `ho` | House | Rumah |
| `ap` | Apartment | Apartemen |
| `la` | Land | Tanah |
| `sh` | Shop House | Ruko |
| `cs` | Commercial Space | Ruang Usaha |
| `fa` | Factory | Pabrik |
| `wa` | Warehouse | Gudang |
| `of` | Office | Kantor |
| `vl` | Villa | Villa |
| `ks` | Kost | Kost |
| `ht` | Hotel | Hotel |

> **Production data**: All 2 documents currently have `property_types: {}` (empty object). The array values above are the expected codes based on the PostgreSQL schema and the Property Type Code reference in `_overview.md`.

---

## Sample Document

```json
{
  "project_id": "3440",
  "district_id": "7587",
  "city_id": "86",
  "property_types": {}
}
```

---

## Relationships

```
┌──────────────────────────────────────────┐
│  listing_business_apps-developer_insight-│
│  project                                 │
│  (project_id, district_id, city_id)      │
└──────────────────────────────────────────┘
         │                    │
         │ district_id /      │ project_id
         │ city_id            │
         ▼                    ▼
┌─────────────────┐   ┌──────────────────────────┐
│  locations       │   │  Other developer_insight  │
│  (city/district  │   │  indices (reference)      │
│   hierarchy)     │   │                           │
└─────────────────┘   └──────────────────────────┘
```

> This is a reference/lookup table used by other `developer_insight` indices in the `listing_business_apps` domain.

---

## Query Examples

### Get project by ID
```json
{
  "query": {
    "term": { "project_id.keyword": "3440" }
  }
}
```

### Find projects in a specific city
```json
{
  "query": {
    "term": { "city_id.keyword": "86" }
  }
}
```

### Find projects in a specific district
```json
{
  "query": {
    "term": { "district_id.keyword": "7587" }
  }
}
```

### List all projects
```json
{
  "query": { "match_all": {} },
  "size": 100
}
```

### Count projects per city (aggregation)
```json
{
  "size": 0,
  "aggs": {
    "by_city": {
      "terms": { "field": "city_id.keyword", "size": 50 }
    }
  }
}
```

### Find projects in multiple cities
```json
{
  "query": {
    "terms": { "city_id.keyword": ["86", "1", "52"] }
  }
}
```

---

## Notes

- This is a very small index (only 2 documents) serving as a reference/lookup table for the developer insight feature.
- The `project_name` field is present in PostgreSQL but is NOT synced to ES. If you need project names, query the source PostgreSQL table directly.
- The `property_types` field is defined as `CHAR(2)[]` (PostgreSQL array) in the source table but appears as an empty object `{}` in current ES data. This may indicate the CDC/ETL pipeline does not properly serialize PostgreSQL arrays, or the source data has not been populated yet.
- This index is part of the `listing_business_apps` domain under the `developer_insight` schema, sourced from the `rumah123-listing` repository.
- Related indices: [`lba-analytics-user-listing-leap.md`](./lba-analytics-user-listing-leap.md), [`lba-analytics-district-performances.md`](./lba-analytics-district-performances.md), [`lba-analytics-market-price-references.md`](./lba-analytics-market-price-references.md)
