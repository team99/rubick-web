# Area Specialists Index Schema

> **Index**: `area-specialists`
>
> **Purpose**: Agent area expertise and rankings
>
> **Primary Use Cases**: Area specialist badges, agent recommendations by location
>
> **Document Count**: ~598

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `agent_uuid` | keyword | Agent identifier | |
| `location_uuid` | keyword | Area of expertise | |
| `rank` | integer | Ranking in area | |
| `portal_id` | integer | Portal identifier | |

---

## Core Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | keyword | Record identifier |
| `agent_uuid` | keyword | Agent UUID |
| `agent_origin_id` | keyword | Agent legacy ID |
| `location_uuid` | keyword | Location UUID |
| `location_origin_id` | keyword | Location legacy ID |
| `portal_id` | integer | Portal (1=R123, 2=iProp) |

---

## Ranking Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `rank` | integer | Rank position (1 = top) |
| `score` | float | Calculated score |
| `listing_count` | integer | Listings in area |
| `enquiry_count` | integer | Enquiries in area |

> **Note**: Computed rankings, inferred from ES mapping

---

## Location Details ✅

| Field | Type | Description |
|-------|------|-------------|
| `location_name` | text | Area name |
| `location_type` | keyword | Location type |
| `city_uuid` | keyword | City UUID |
| `district_uuid` | keyword | District UUID |

> **Note**: Denormalized location data for querying

---

## Agent Details ✅

| Field | Type | Description |
|-------|------|-------------|
| `agent_name` | text | Agent name |
| `organization_uuid` | keyword | Agency UUID |

> **Note**: Denormalized agent data for querying

---

## Time Fields ✅

| Sub-field | Type | Description |
|-----------|------|-------------|
| `time.created` | date | Record creation |
| `time.updated` | date | Last calculation |

---

## Query Examples

### Top specialists in area
```json
{
  "query": { "term": { "location_uuid": "location-uuid-here" }},
  "sort": [{ "rank": "asc" }],
  "size": 10
}
```

### Agent's specialist areas
```json
{
  "query": { "term": { "agent_uuid": "agent-uuid-here" }}
}
```
