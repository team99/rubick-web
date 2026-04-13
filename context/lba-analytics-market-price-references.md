# LBA Analytics Market Price References Index Schema

> **Index**: `listing_business_apps-analytics-market_price_references`
>
> **Purpose**: Market price reference data by location, property type, and size range -- provides median and price range estimates for pricing guidance
>
> **Primary Use Cases**: Price estimation, market benchmarking, listing price validation, pricing guidance for agents
>
> **Document Count**: 5,948
>
> **Source**: PostgreSQL table `analytics.market_price_references` (synced via CDC/ETL -- no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `city_id` | text/keyword | City ID | Exact match via `.keyword` |
| `district_id` | text/keyword | District ID | Exact match via `.keyword` |
| `ads_type` | text/keyword | Property type code | `"ho"` (house) |
| `ads_category` | text/keyword | Sale or Rent channel | `"s"` (sale), `"r"` (rent) |
| `median_price` | text/keyword | Median price in IDR | Range queries via `.keyword` |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Auto-increment ID (primary key from PostgreSQL) |
| `city_id` | text/keyword | City ID reference |
| `district_id` | text/keyword | District ID reference |
| `ads_type` | text/keyword | Property type code (see enum below) |
| `ads_category` | text/keyword | Channel: `"s"` (Sale) or `"r"` (Rent) (see enum below) |
| `land_size_low` | text/keyword | Land size range lower bound in sqm |
| `land_size_high` | text/keyword | Land size range upper bound in sqm |
| `building_size_low` | text/keyword | Building size range lower bound in sqm (default `"0"`) |
| `building_size_high` | text/keyword | Building size range upper bound in sqm (default `"0"`) |
| `median_price` | text/keyword | Median price estimate in IDR |
| `price_low` | text/keyword | Low estimate price in IDR |
| `price_high` | text/keyword | High estimate price in IDR |
| `created_at` | text/keyword | Creation timestamp |
| `created_by` | text/keyword | Creator (typically `"system"`) |
| `updated_at` | text/keyword | Last update timestamp |
| `updated_by` | text/keyword | Updater (typically `"system"`) |

---

## SQL Schema

```sql
CREATE TABLE IF NOT EXISTS market_price_references (
    id SERIAL PRIMARY KEY,
    city_id INTEGER NOT NULL,
    district_id INTEGER NOT NULL,
    ads_type varchar(255) NOT NULL,
    ads_category varchar(1) NOT NULL,
    land_size_low NUMERIC NOT NULL,
    land_size_high NUMERIC NOT NULL,
    building_size_low NUMERIC NOT NULL DEFAULT 0,
    building_size_high NUMERIC NOT NULL DEFAULT 0,
    median_price NUMERIC NOT NULL,
    price_low NUMERIC NOT NULL,
    price_high NUMERIC NOT NULL,
    created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    created_by varchar(255) NULL,
    updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by varchar(255) NULL,
    CONSTRAINT unique_city_district_ads UNIQUE (
        city_id, district_id, ads_type, ads_category,
        land_size_low, land_size_high,
        building_size_low, building_size_high
    )
);
```

> **Note**: All fields use dynamic mapping in ES (text with keyword sub-field). Numeric values (prices, sizes, IDs) from PostgreSQL are stored as strings in ES.

---

## Enum Reference

### Property Type Code (`ads_type`)
| Value | Description |
|-------|-------------|
| `ho` | House (Rumah) |

> **Production data**: All 5,948 documents are `"ho"` (House only). See `_overview.md` for the full Property Type Code reference.

### Ads Category / Channel (`ads_category`)
| Value | Count | Description |
|-------|-------|-------------|
| `s` | 4,750 | Sale (Dijual) |
| `r` | 1,198 | Rent (Disewa) |

---

## Sample Document

```json
{
  "id": "2026",
  "city_id": "1",
  "district_id": "3",
  "ads_type": "ho",
  "ads_category": "s",
  "land_size_low": "251",
  "land_size_high": "500",
  "building_size_low": "0",
  "building_size_high": "0",
  "median_price": "13000000000",
  "price_low": "12090000000",
  "price_high": "13910000000"
}
```

> **Note**: All values are strings in ES due to dynamic mapping, even though the source PostgreSQL columns are `NUMERIC` and `INTEGER`.

---

## Relationships

```
┌─────────────────────────────────────────────┐
│  listing_business_apps-analytics-            │
│  market_price_references                     │
│  (city_id, district_id, ads_type,            │
│   ads_category, size ranges)                 │
└─────────────────────────────────────────────┘
         │                    │
         │ city_id /          │ ads_type / ads_category
         │ district_id        │
         ▼                    ▼
┌─────────────────┐   ┌──────────────────────────┐
│  locations       │   │  listings-r123-*          │
│  (city/district  │   │  (property_type,          │
│   hierarchy)     │   │   price_type matching)    │
└─────────────────┘   └──────────────────────────┘
```

---

## Query Examples

### Get price references for a specific district (Sale)
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "district_id.keyword": "3" }},
        { "term": { "ads_category.keyword": "s" }}
      ]
    }
  }
}
```

### Get price references for a city and property type
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "city_id.keyword": "1" }},
        { "term": { "ads_type.keyword": "ho" }},
        { "term": { "ads_category.keyword": "s" }}
      ]
    }
  },
  "sort": [{ "land_size_low.keyword": "asc" }]
}
```

### Find price references for a specific land size range
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "city_id.keyword": "1" }},
        { "term": { "district_id.keyword": "3" }},
        { "term": { "land_size_low.keyword": "251" }},
        { "term": { "land_size_high.keyword": "500" }}
      ]
    }
  }
}
```

### Count documents by ads_category (Sale vs Rent breakdown)
```json
{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": { "field": "ads_category.keyword", "size": 10 }
    }
  }
}
```

### Count references per city
```json
{
  "size": 0,
  "aggs": {
    "by_city": {
      "terms": { "field": "city_id.keyword", "size": 100 }
    }
  }
}
```

### Get all rental price references for a district
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "district_id.keyword": "3" }},
        { "term": { "ads_category.keyword": "r" }}
      ]
    }
  },
  "sort": [{ "median_price.keyword": "asc" }]
}
```

---

## Notes

- All price values (`median_price`, `price_low`, `price_high`) are stored as strings in ES. When sorting by price, `.keyword` sorting will use lexicographic order, not numeric order. For accurate numeric sorting, application-level processing is recommended.
- The unique constraint in PostgreSQL ensures one price reference per combination of (city, district, property type, channel, size ranges).
- `building_size_low` and `building_size_high` default to `"0"` when not applicable, meaning the price reference is based on land size only.
- Currently, only House (`"ho"`) data is available. Other property types may be added in the future.
- This index is part of the `listing_business_apps` domain, sourced from the `rumah123-listing` repository.
- Related indices: [`lba-analytics-user-listing-leap.md`](./lba-analytics-user-listing-leap.md), [`lba-analytics-district-performances.md`](./lba-analytics-district-performances.md)
