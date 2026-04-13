# Suggestions Index Schema

> **Indices**: `suggestions-r123-*`, `suggestions-ipropsg`
>
> **Purpose**: Search autocomplete and suggestion data
>
> **Primary Use Cases**: Search bar autocomplete, location suggestions, keyword suggestions
>
> **Document Count**: ~8M (R123), ~33K (iProp)

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `name` | text | Suggestion text | Text search |
| `type` | keyword | Suggestion type | |
| `status` | keyword | Active status | `status: 1` |
| `portal_id` | integer | Portal identifier | |

---

## Status ✅

**Field**: `status` (keyword/integer)

| Value | Name | Description |
|-------|------|-------------|
| 0 | Inactive | Suggestion disabled |
| 1 | Active | Suggestion enabled |

---

## Suggestion Types ✅

**Field**: `kind` (keyword) - Also referred to as `type`

| Value | Description |
|-------|-------------|
| `location` | Location-based suggestions (cities, districts, areas) |
| `property` | Property/listing suggestions |
| `developer` | Developer name suggestions |
| `apartment_venue` | Apartment venue/complex suggestions |
| `venue` | Venue suggestions |
| `poi` | Point of Interest suggestions |
| `villa` | Villa property suggestions |
| `commercial` | Commercial property suggestions |
| `agent` | Agent name suggestions |
| `organization` | Organization/agency suggestions |

> **Source**: Verified from `pkg/model/elasticsearch/suggestion.go`

---

## Core Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | keyword | Unique identifier |
| `origin_id` | keyword | Legacy ID |
| `name` | text | Display text |
| `text` | text | Search text (has `.edgengram` analyzer) |
| `text.edgengram` | text | Edge n-gram for autocomplete |
| `title` | text | Full title |
| `name_en` | text | English display text |
| `slug` | keyword | URL-friendly identifier |
| `url` | text | Target URL |
| `portal_id` | integer | Portal (1=R123, 2=iProp) |
| `weight` | integer | Ranking weight |
| `is_removed` | boolean | Soft delete flag |

---

## Location Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `location.uuid` | keyword | Location UUID |
| `location.name` | text | Location name |
| `location.type.value` | keyword | Location type ID |
| `location.cities` | object[] | City hierarchy |
| `location.districts` | object[] | District hierarchy |
| `location.provinces` | object[] | Province hierarchy |

---

## Property Type Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `property_type` | keyword/object | Associated property type |
| `price_type` | keyword/object | Sale or rent |

> **Note**: Uses same property_type/price_type values as listings index

---

## Property Counts ✅

**Field**: `property_counts` (map) - Listing counts by property type and price type

Structure: `property_counts[property_type][price_type] = count`

| Property Type Key | Description |
|-------------------|-------------|
| `house` | Houses |
| `apartment` | Apartments |
| `land` | Land |
| `shop_house` | Ruko |
| `villa` | Villas |
| `commercial_space` | Commercial |
| `office_space` | Offices |
| `warehouse` | Warehouses |
| `factory` | Factories |
| `hotel` | Hotels |
| `residential` | Aggregate residential |
| `summary` | Total summary |

| Price Type Key | Description |
|----------------|-------------|
| `sale` | For sale |
| `rent` | For rent |

---

## Statistics ✅

| Field | Type | Description |
|-------|------|-------------|
| `listing_count` | long | Number of listings |
| `popularity_score` | float | Search popularity |
| `venue_counts` | map | Venue counts by type |

> **Source**: Verified from `pkg/model/elasticsearch/suggestion.go`

---

## Query Examples

### Autocomplete search (use text.edgengram)
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": 1 }},
        { "term": { "portal_id": 1 }},
        { "term": { "is_removed": false }}
      ],
      "must": [{ "match": { "text.edgengram": "jakar" }}]
    }
  },
  "sort": [{ "weight": "desc" }]
}
```

### Suggestions by kind with property counts
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": 1 }},
        { "term": { "kind": "location" }},
        { "range": { "property_counts.summary.sale": { "gte": 1 }}}
      ]
    }
  }
}
```
