# User Activities Index Schema

> **Index**: `user-activities`
>
> **Purpose**: User behavior and interaction tracking
>
> **Primary Use Cases**: User analytics, behavior analysis, recommendation systems
>
> **Document Count**: ~8.3M

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `user_uuid` | keyword | User identifier | |
| `activity_type` | keyword | Type of activity | |
| `listing_uuid` | keyword | Related listing | |
| `time.created` | date | Activity timestamp | Date range |

---

## Activity Types ✅

**Field**: `activity_type` (keyword)

| Value | Name | Description |
|-------|------|-------------|
| 0 | VISITED | User visited/viewed a listing (LDP view) |
| 1 | ENQUIRY | User sent an enquiry |
| 2 | FAVORITE | User saved/favorited a listing |

> **Source**: Verified from `api/pb_generated/services/userpreference/user_preference_service.pb.go`

---

## Core Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | keyword | Activity record UUID |
| `user_uuid` | keyword | User who performed action |
| `session_id` | keyword | User session identifier |
| `portal_id` | integer | Portal (1=R123, 2=iProp) |

---

## Target Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `listing_uuid` | keyword | Target listing UUID |
| `listing_origin_id` | keyword | Target listing legacy ID |
| `agent_uuid` | keyword | Target agent UUID |
| `project_uuid` | keyword | Target project UUID |
| `location_uuid` | keyword | Target location UUID |

> **Note**: Fields inferred from ES mapping structure

---

## Context Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `page_type` | keyword | Page where activity occurred |
| `source` | keyword | Traffic source |
| `device_type` | keyword | Device (mobile/desktop) |
| `platform` | keyword | Platform (web/app) |

> **Note**: Fields inferred from ES mapping structure

---

## Search Context ✅

For search activities:

| Field | Type | Description |
|-------|------|-------------|
| `search_query` | text | Search query text |
| `filters` | object | Applied filters |
| `results_count` | integer | Number of results |

> **Note**: Fields inferred from ES mapping structure

---

## Time Fields ✅

| Sub-field | Type | Description |
|-----------|------|-------------|
| `time.created` | date | Activity timestamp |

---

## Query Examples

### User's recent activities
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "user_uuid": "user-uuid-here" }},
        { "range": { "time.created": { "gte": "now-7d" }}}
      ]
    }
  },
  "sort": [{ "time.created": "desc" }]
}
```

### Most viewed listings
```json
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "activity_type": 0 }},
        { "range": { "time.created": { "gte": "now-30d" }}}
      ]
    }
  },
  "aggs": {
    "top_listings": {
      "terms": { "field": "listing_uuid", "size": 10 }
    }
  }
}
```
