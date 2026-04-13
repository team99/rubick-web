# User Seen Listings Index Schema

> **Index**: `user-seen-listings-*`
>
> **Purpose**: Track which listings users have viewed
>
> **Primary Use Cases**: "Already viewed" badges, personalization, duplicate prevention
>
> **Document Count**: ~7M

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `user_uuid` | keyword | User identifier | |
| `listing_uuid` | keyword | Viewed listing UUID | |
| `time.created` | date | View timestamp | Date range |

---

## Core Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | keyword | Record identifier |
| `user_uuid` | keyword | User who viewed |
| `listing_uuid` | keyword | Listing that was viewed |
| `listing_origin_id` | keyword | Legacy listing ID |
| `portal_id` | integer | Portal (1=R123, 2=iProp) |

---

## View Context ✅

| Field | Type | Description |
|-------|------|-------------|
| `source` | keyword | Where user came from |
| `page_type` | keyword | Page type (SRP, LDP, etc.) |
| `session_id` | keyword | Session identifier |

> **Note**: Optional fields, inferred from ES mapping

---

## Time Fields ✅

| Sub-field | Type | Description |
|-----------|------|-------------|
| `time.created` | date | When listing was viewed |

---

## Query Examples

### Listings viewed by user
```json
{
  "query": { "term": { "user_uuid": "user-uuid-here" }},
  "sort": [{ "time.created": "desc" }]
}
```

### Count views per listing
```json
{
  "size": 0,
  "aggs": {
    "by_listing": { "terms": { "field": "listing_uuid", "size": 100 }}
  }
}
```
