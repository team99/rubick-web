# Homepage Advertisements Index Schema

> **Index**: `homepage-advertisements`
>
> **Purpose**: Homepage banner and advertisement data
>
> **Primary Use Cases**: Banner display, ad targeting, campaign management
>
> **Document Count**: ~100

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `status` | keyword | Ad status | Active/inactive |
| `position` | keyword | Banner position | |
| `portal_id` | integer | Portal identifier | |
| `time.start` | date | Campaign start | Date range |
| `time.end` | date | Campaign end | Date range |

---

## Core Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | keyword | Unique identifier |
| `origin_id` | keyword | Legacy ID |
| `name` | text | Advertisement name |
| `title` | text | Display title |
| `description` | text | Ad description |

> **Note**: Inferred from ES mapping structure

---

## Media Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `image_url` | text | Banner image URL |
| `image_url_mobile` | text | Mobile banner URL |
| `link_url` | text | Click destination |
| `link_target` | keyword | Target (_blank, _self) |

> **Note**: Inferred from ES mapping structure

---

## Targeting Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `portal_id` | integer | Target portal |
| `position` | keyword | Banner position |
| `page_type` | keyword | Target page type |
| `location_uuids` | keyword[] | Target locations |
| `property_types` | integer[] | Target property types |

> **Note**: Inferred from ES mapping structure

---

## Schedule Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `time.start` | date | Campaign start |
| `time.end` | date | Campaign end |
| `time.created` | date | Creation date |
| `time.updated` | date | Last update |

---

## Status Field ✅

**Field**: `status` (keyword)

Common values:
- "active" - Currently running
- "inactive" - Paused/stopped
- "scheduled" - Awaiting start date
- "expired" - Past end date

> **Note**: Values inferred from ES data samples

---

## Priority/Ordering ✅

| Field | Type | Description |
|-------|------|-------------|
| `priority` | integer | Display priority |
| `order` | integer | Display order |

---

## Query Examples

### Active advertisements
```json
{
  "query": {
    "bool": {
      "must": [
        { "term": { "status": "active" }},
        { "range": { "time.start": { "lte": "now" }}},
        { "range": { "time.end": { "gte": "now" }}}
      ]
    }
  }
}
```

### Ads for specific portal
```json
{
  "query": {
    "term": { "portal_id": 1 }
  }
}
```
