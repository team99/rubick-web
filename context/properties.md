# Properties Index Schema

> **Indices**: `properties-r123-*`, `properties-ipropsg`
>
> **Purpose**: **Primary search and filtering index** - optimized for fast filtering and ranking
>
> **Primary Use Cases**: SRP (Search Results Page) filtering, sorting, function scoring

---

## How This Index Is Used ✅

The `properties` index is the **primary search index** in the two-phase search pattern:

1. **Phase 1 (This Index)**: Execute filters, sorting, and function scoring
   - Returns only `uuid` and minimal fields for performance
   - Uses `rank` and `gts` fields for scoring
2. **Phase 2 (Listings Index)**: Enrich results with full document data

**Fields fetched from this index:**
```
uuid, origin_id, property_type, price_type, portal_id,
agents.uuid, organizations.uuid, location, gts
```

> **Source**: Verified from `pkg/repository/impl/elasticsearch/r123/property_search_repository_impl.go`

---

## Key Differences from Listings

1. Uses direct integer values for enums (not objects with name/value)
2. Optimized for search/filter performance (minimal field fetch)
3. Contains `rank` and `gts` fields for function scoring
4. `listings` index has full data for serialization

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `status` | keyword | Property status | `status: 1` for active |
| `property_type` | integer | Property type ID | `property_type: 0` for houses |
| `price_type` | integer | Sale (0) or Rent (1) | `price_type: 0` for sale |
| `portal_id` | integer | Portal identifier | `portal_id: 1` for R123 |
| `project_type` | integer | Project/listing tier | See below |

---

## Status Field ✅

**Field**: `status` (keyword, stored as string)

| Value | Name | Description | Count (R123) |
|-------|------|-------------|--------------|
| "1" | Active | Property is live | ~2.18M |
| "4" | SoldRented | Property sold/rented | ~667K |
| "5" | Review | Under moderation | ~7K |

---

## Property Type ✅

**Field**: `property_type` (integer) - Direct ID, not an object

| Value | Name | Description |
|-------|------|-------------|
| 0 | House | Rumah |
| 1 | Apartment | Apartemen |
| 2 | Ruko | Shophouse |
| 3 | Villa | Villa |
| 4 | Commercial | Commercial Space |
| 5 | Land | Tanah |
| 6 | Kost | Boarding House |
| 7 | Office | Office Space |
| 8 | Warehouse | Gudang |
| 9 | Hotel | Hotel |
| 10 | Kios | Kiosk |
| 11 | Factory | Pabrik |
| 16 | Primary | New Development Project |

---

## Price Type ✅

**Field**: `price_type` (integer) - Direct ID

| Value | Name | Description |
|-------|------|-------------|
| 0 | Sale | Property for sale |
| 1 | Rent | Property for rent |

---

## Project Type ✅

**Field**: `project_type` (integer) - Marketing tier for primary projects

| Value | Name | Description | Count |
|-------|------|-------------|-------|
| 0 | Unknown/Secondary | Not a primary project | ~1,637 |
| 1 | Regular | Standard primary project | ~198 |
| 2 | Evergreen | Evergreen tier | ~2 |
| 3 | LGP | Lead Generation Program | ~42 |
| 4 | LGP+ | Lead Generation Plus | ~29 |
| 5 | Pasti | Premium tier | ~1 |

> **Note**: In code, values start at 1 (Regular=1, Evergreen=2, etc.), but ES data shows 0-based indexing in practice.

---

## Attributes ✅

**Field**: `attributes` (object) - Property specifications

| Sub-field | Type | Description |
|-----------|------|-------------|
| `bedrooms` | short | Number of bedrooms |
| `bathrooms` | short | Number of bathrooms |
| `building_size` | float | Building area (sqm) |
| `land_size` | float | Land area (sqm) |
| `floors` | short | Number of floors |
| `carports` | short | Number of carports |
| `garages` | short | Number of garages |
| `electricity` | keyword | Electricity capacity |
| `furnishing` | keyword | Furnishing level |
| `facing` | keyword | Building direction |
| `conditions` | keyword | Property condition |
| `tower_name` | text | Tower/building name |
| `advertised_installment_per_month` | long | Monthly installment |

---

## Agent Fields ✅

**Field**: `agents` (object) - Associated agents

| Sub-field | Type | Description |
|-----------|------|-------------|
| `uuid` | keyword | Agent UUID |
| `name` | text | Agent name |
| `origin_id` | keyword | Legacy ID |
| `marketer_type.id` | integer | Marketer type ID |
| `subscription` | object | Subscription details |
| `contact.phone_number` | keyword | Phone |
| `contact.whatsapp` | keyword | WhatsApp |
| `contact.email` | text | Email |

### Marketer Type ✅
| Value | Name |
|-------|------|
| 0 | Official Developer |
| 1 | Official Project Marketer |
| 2 | Official Partner |
| 3 | Official Management |
| 4 | Official Partner Rumah123 |

---

## Location Fields ✅

**Field**: `location` (object) - Same structure as listings

| Sub-field | Type | Description |
|-----------|------|-------------|
| `countries` | object[] | Country info |
| `provinces` | object[] | Province info |
| `cities` | object[] | City info |
| `districts` | object[] | District info |
| `coordinate` | geo_point | Lat/lon |
| `full_address` | text | Complete address |

---

## Price Fields ✅

**Field**: `price` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `offer` | long | Main price |
| `min` | long | Minimum price |
| `max` | long | Maximum price |
| `currency_type.value` | keyword | Currency code |
| `unit_type.value` | keyword | Price unit |

---

## Time Fields ✅

| Sub-field | Type | Description |
|-----------|------|-------------|
| `time.created` | date | Creation timestamp |
| `time.updated` | date | Last update |
| `time.posted` | date | Publication date |
| `time.repost_date` | date | Last repost |

---

## Ranking Fields ✅ (Important for Search)

| Field | Type | Description |
|-------|------|-------------|
| `rank` | long | Primary ranking score (used in function scoring) |
| `listing_score` | long | Listing quality score |
| `gts` | nested | GTS (location-based) ranking data |
| `gts.location_uuid` | keyword | Location UUID for GTS matching |

> **Source**: Used by `PropertyFSBuilder.RankValueFactor()` and `WithGTSNested()`

---

## Special Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `building_status_flag` | integer | Building completion status |
| `is_primary` | boolean | Is primary project |
| `is_subunit` | boolean | Is project subunit |
| `origin_project_type` | integer | Original project type |

---

## Query Examples

### Active properties for sale
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "1" }},
        { "term": { "price_type": 0 }}
      ]
    }
  }
}
```

### Count by project type
```json
{
  "size": 0,
  "query": { "term": { "status": "1" }},
  "aggs": {
    "by_project_type": {
      "terms": { "field": "project_type", "size": 10 }
    }
  }
}
```
