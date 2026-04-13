# Locations Index Schema

> **Indices**: `locations`, `locations-ipropsg`
>
> **Purpose**: Geographic hierarchy and location data
>
> **Primary Use Cases**: Location search, geographic filtering, address resolution
>
> **Document Count**: ~239K

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `name` | text | Location name | Text search |
| `type.value` | keyword | Location type | See enum below |
| `level` | integer | Hierarchy level | |
| `portal_id` | integer | Portal identifier | |

---

## Location Type ✅

**Field**: `type` (object)

| Value | Name | Description |
|-------|------|-------------|
| 0 | Regular | Generic location |
| 1 | POI | Point of Interest |
| 2 | Venue | Venue/Complex |
| 4 | Area | Area grouping |
| 5 | R123Legacy | Legacy R123 area |
| 6 | Country | Country level |
| 7 | Province | Province/state level |
| 8 | City | City level |
| 9 | District | District/kecamatan level |
| 10 | Estate | Housing estate |
| 11 | Street | Street level |
| 12 | Building | Building/apartment |
| 13 | PostalCode | Postal code |
| 14 | Village | Village/kelurahan |
| 15 | Block | Block |

---

## Core Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | keyword | Unique identifier |
| `origin_id` | keyword | Legacy ID |
| `name` | text | Location name |
| `name_en` | text | English name |
| `slug` | keyword | URL-friendly name |
| `level` | integer | Hierarchy depth |

---

## Geographic Data ✅

| Field | Type | Description |
|-------|------|-------------|
| `coordinate` | geo_point | Lat/lon center point |
| `polygon` | geo_shape | Boundary polygon |
| `bounding_box` | geo_shape | Bounding rectangle |

---

## Hierarchy Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `parent` | object | Parent location |
| `parent.uuid` | keyword | Parent UUID |
| `parent.name` | text | Parent name |
| `countries` | object[] | Country info |
| `provinces` | object[] | Province info |
| `cities` | object[] | City info |
| `districts` | object[] | District info |

---

## Statistics ✅

| Field | Type | Description |
|-------|------|-------------|
| `listing_count` | long | Number of listings in area |
| `active_listing_count` | long | Active listings |

> **Note**: Computed aggregate statistics

---

## Query Examples

### Cities and districts
```json
{
  "query": {
    "bool": {
      "filter": [
        { "terms": { "type.value": [8, 9] }},
        { "range": { "active_listing_count": { "gte": 1 }}}
      ]
    }
  },
  "sort": [{ "active_listing_count": "desc" }]
}
```

### Search location by name
```json
{
  "query": {
    "match": { "name": "kebayoran" }
  }
}
```
