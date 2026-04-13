# LBA Developer Insight Developer Leads Performance Index Schema

> **Index**: `listing_business_apps-developer_insight-developer_leads_performance`
>
> **Purpose**: Developer leads performance data sliced by multiple dimensions -- provides market analysis with price range distribution, views, enquiries, and impressions
>
> **Primary Use Cases**: Market analysis by city/district/property type, price range distribution reporting, lead performance dashboards
>
> **Document Count**: ~1
>
> **Source**: PostgreSQL table `developer_insight.developer_leads_performance` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `date` | text/keyword | Report date | Exact match via `.keyword` (e.g. `"2025-03-03"`) |
| `summary_all_data` | object | Overall summary data | Contains performance metrics |
| `by_city_data` | object | Data broken down by city | Keyed by city ID |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `date` | text/keyword | Report date (primary key, e.g. `"2025-03-03"`) |
| `summary_all_data` | object | Overall summary across all dimensions (see structure below) |
| `by_city_data` | object | Performance data broken down by city ID (see structure below) |
| `by_propertytype_data` | object | Performance data broken down by property type (see structure below) |
| `by_city_district_data` | object | Performance data by city\|district combo (see structure below) |
| `by_city_propertytype_data` | object | Performance data by city\|property type combo (see structure below) |
| `by_city_district_propertytype_data` | object | Performance data by city\|district\|property type combo (see structure below) |

> **Primary Key**: `date`
>
> **SQL Schema**: `developer_insight.developer_leads_performance`
>
> **Note**: This is a single-document index that holds aggregated market-wide performance data. All dimension breakdowns are stored as nested JSON objects within the same document.

---

## Nested JSON Structures

### Common Performance Data Structure

All dimension fields (`summary_all_data`, `by_city_data`, etc.) share the same inner structure:

```json
{
  "by_range": {
    "-400m": 1,
    "400m-800m": 0,
    "800m-1200m": 0,
    "1200m-1600m": 0,
    "1600m-2000m": 0,
    "2000m-2400m": 0,
    "2400m-2800m": 0,
    "2800m-3200m": 0,
    "3200m-3600m": 0,
    "3600m-4000m": 0,
    "4000m-": 0
  },
  "total_views": 0,
  "total_enquiries": 0,
  "total_impressions": 0
}
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `by_range` | object | Distribution of listings by price range |
| `by_range.-400m` | int | Count of listings under 400 million IDR |
| `by_range.400m-800m` | int | Count of listings 400M-800M IDR |
| `by_range.800m-1200m` | int | Count of listings 800M-1.2B IDR |
| `by_range.1200m-1600m` | int | Count of listings 1.2B-1.6B IDR |
| `by_range.1600m-2000m` | int | Count of listings 1.6B-2B IDR |
| `by_range.2000m-2400m` | int | Count of listings 2B-2.4B IDR |
| `by_range.2400m-2800m` | int | Count of listings 2.4B-2.8B IDR |
| `by_range.2800m-3200m` | int | Count of listings 2.8B-3.2B IDR |
| `by_range.3200m-3600m` | int | Count of listings 3.2B-3.6B IDR |
| `by_range.3600m-4000m` | int | Count of listings 3.6B-4B IDR |
| `by_range.4000m-` | int | Count of listings over 4 billion IDR |
| `total_views` | int | Total listing views |
| `total_enquiries` | int | Total enquiries received |
| `total_impressions` | int | Total search impressions |

> **Price ranges** are in millions IDR: `"-400m"` = under 400 million, `"4000m-"` = over 4 billion IDR.
>
> **Go code transformation** maps raw field names to display ranges:
> ```
> "price_400"     -> "-400m"
> "price_400_800" -> "400m-800m"
> "price_800_1200" -> "800m-1200m"
> ... etc up to
> "price_4000"    -> "4000m-"
> ```

### `summary_all_data`

Contains the overall performance data across all cities, districts, and property types.

```json
{
  "by_range": { "-400m": 1, "400m-800m": 0, ... },
  "total_views": 0,
  "total_enquiries": 0,
  "total_impressions": 0
}
```

### `by_city_data`

Keys are city IDs. Each value contains the common performance data structure.

```json
{
  "1": {
    "by_range": { "-400m": 1, "400m-800m": 0, ... },
    "total_views": 0,
    "total_enquiries": 0,
    "total_impressions": 0
  },
  "25": {
    "by_range": { "-400m": 0, "400m-800m": 1, ... },
    "total_views": 5,
    "total_enquiries": 2,
    "total_impressions": 100
  }
}
```

### `by_propertytype_data`

Keys are property type short codes (e.g. `"ho"`, `"la"`, `"ap"`).

```json
{
  "ho": {
    "by_range": { ... },
    "total_views": 0,
    "total_enquiries": 0,
    "total_impressions": 0
  },
  "la": {
    "by_range": { ... },
    "total_views": 0,
    "total_enquiries": 0,
    "total_impressions": 0
  }
}
```

### `by_city_district_data`

Keys use pipe separator: `"city_id|district_id"` (e.g. `"1|17"`).

```json
{
  "1|17": {
    "by_range": { ... },
    "total_views": 0,
    "total_enquiries": 0,
    "total_impressions": 0
  }
}
```

### `by_city_propertytype_data`

Keys use pipe separator: `"city_id|property_type"` (e.g. `"1|la"`).

```json
{
  "1|la": {
    "by_range": { ... },
    "total_views": 0,
    "total_enquiries": 0,
    "total_impressions": 0
  }
}
```

### `by_city_district_propertytype_data`

Keys use pipe separator: `"city_id|district_id|property_type"` (e.g. `"1|17|la"`).

```json
{
  "1|17|la": {
    "by_range": { ... },
    "total_views": 0,
    "total_enquiries": 0,
    "total_impressions": 0
  }
}
```

---

## Query Examples

### Get the full performance report
```json
{
  "query": { "match_all": {} }
}
```

### Get report for a specific date
```json
{
  "query": {
    "term": { "date.keyword": "2025-03-03" }
  }
}
```

### Get only summary and city-level data (limit returned fields)
```json
{
  "query": { "match_all": {} },
  "_source": ["date", "summary_all_data", "by_city_data"]
}
```

### Get only property-type breakdown
```json
{
  "query": { "match_all": {} },
  "_source": ["date", "by_propertytype_data"]
}
```

### Check if report exists for a given date
```json
{
  "query": {
    "term": { "date.keyword": "2025-03-03" }
  },
  "_source": ["date"],
  "size": 1
}
```

---

## Relationships

```
┌──────────────────────────────────────────────────┐
│  listing_business_apps-developer_insight-        │
│  developer_leads_performance                     │
│  (date = report date identity)                   │
│  Market-wide performance data with               │
│  city/district/propertytype breakdowns           │
└────────────┬─────────────────────────────────────┘
             │ property type codes map to
             ▼
┌──────────────────────────────────────────────────┐
│  Property Type Code (Short Code)                 │
│  See _overview.md for full reference             │
│  ho=House, la=Land, ap=Apartment, etc.           │
└──────────────────────────────────────────────────┘
```

- **`by_propertytype_data`** keys and **`by_city_propertytype_data`** / **`by_city_district_propertytype_data`** property type segments use Property Type Code (Short Code) -- see `_overview.md`
- **City IDs** and **District IDs** in the key formats map to the same location identifiers used in `locations-*` indices
- This index provides market-wide data, while `lba-devinsight-in-house-recommendations.md` and `lba-devinsight-developer-project-total-listing-type.md` provide per-project data
