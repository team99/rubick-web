# LBA Developer Insight In-House Recommendations Index Schema

> **Index**: `listing_business_apps-developer_insight-in_house_recommendations`
>
> **Purpose**: Recommendations for property developers comparing their in-house agent performance vs all agents -- helps developers understand market positioning
>
> **Primary Use Cases**: Developer performance benchmarking, in-house vs market agent comparison, recommendation lookups by project
>
> **Document Count**: ~3.7K
>
> **Source**: PostgreSQL table `developer_insight.in_house_recommendations` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `project_id` | text/keyword | Project ID (FK to project table) | Per-project lookups via `.keyword` |
| `type` | text/keyword | Recommendation type | `TOTAL_AGENT`, `BOOSTER_USAGE`, `LISTING_ONLINE` |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Record ID (auto-increment) |
| `project_id` | text/keyword | Project ID (FK to `developer_insight.project`) |
| `type` | text/keyword | Recommendation type (see enum below) |
| `recommendations` | object | JSON object with recommendation data (see structure below) |
| `created_at` | text/keyword | Creation timestamp |
| `updated_at` | text/keyword | Last update timestamp |

> **Unique Constraint**: `(project_id, type)` -- each project has at most one recommendation per type
>
> **SQL Schema**: `developer_insight.in_house_recommendations`

---

## Enum Reference

### Recommendation Type (`type`)
| Value | Count | Description |
|-------|-------|-------------|
| `TOTAL_AGENT` | ~1,276 | Total agent count comparison (in-house vs all agents) |
| `BOOSTER_USAGE` | ~1,195 | Booster feature usage comparison |
| `LISTING_ONLINE` | ~1,195 | Online listing count comparison |
| `PREMIER_USAGE` | 0 | Premier listing usage comparison (defined in enum but not in production data) |

> **Source**: PostgreSQL enum `RecommendationTypes` in `developer_insight` schema
>
> **Production data**: Only `TOTAL_AGENT`, `BOOSTER_USAGE`, and `LISTING_ONLINE` are actively used

---

## Nested JSON Structures

### `recommendations` (JSON object -- varies by type)

The structure of `recommendations` depends on the `type` field.

**For `TOTAL_AGENT`:**
```json
{
  "in_house": 0,
  "all_agent": 2,
  "in_house_percentage": 0
}
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `in_house` | int | Number of in-house agents for the project |
| `all_agent` | int | Total number of agents (in-house + external) |
| `in_house_percentage` | int/float | Percentage of agents that are in-house |

**For `BOOSTER_USAGE`:**
```json
{
  "in_house": 0,
  "all_agent": 5,
  "in_house_percentage": 0
}
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `in_house` | int | Booster usage count by in-house agents |
| `all_agent` | int | Booster usage count by all agents |
| `in_house_percentage` | int/float | Percentage of booster usage by in-house agents |

**For `LISTING_ONLINE`:**
```json
{
  "in_house": 0,
  "all_agent": 10,
  "in_house_percentage": 0
}
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `in_house` | int | Number of online listings by in-house agents |
| `all_agent` | int | Number of online listings by all agents |
| `in_house_percentage` | int/float | Percentage of online listings by in-house agents |

> **Note**: All recommendation types share the same JSON structure with `in_house`, `all_agent`, and `in_house_percentage` fields. The values are stored as a JSONB column in PostgreSQL and synced to ES as a nested object.

---

## Query Examples

### Get all recommendations for a specific project
```json
{
  "query": {
    "term": { "project_id.keyword": "2746" }
  }
}
```

### Get all recommendations of a specific type
```json
{
  "query": {
    "term": { "type.keyword": "TOTAL_AGENT" }
  }
}
```

### Get a specific project's recommendation by type
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "project_id.keyword": "2746" }},
        { "term": { "type.keyword": "BOOSTER_USAGE" }}
      ]
    }
  }
}
```

### Recommendation type breakdown
```json
{
  "size": 0,
  "aggs": {
    "by_type": {
      "terms": { "field": "type.keyword", "size": 10 }
    }
  }
}
```

### Recently updated recommendations
```json
{
  "query": {
    "range": { "updated_at.keyword": { "gte": "2026-01-01" }}
  },
  "sort": [{ "updated_at.keyword": "desc" }]
}
```

---

## Relationships

```
┌──────────────────────────────────────────────────┐
│  listing_business_apps-developer_insight-        │
│  in_house_recommendations                        │
│  (project_id = developer project identity)       │
└────────────┬─────────────────────────────────────┘
             │ shares project_id
             ▼
┌──────────────────────────────────────────────────┐
│  listing_business_apps-developer_insight-        │
│  total_agents_summaries                          │
│  (project_id = developer project identity)       │
│  Agent totals per project (in-house vs all)      │
└────────────┬─────────────────────────────────────┘
             │ shares project_id
             ▼
┌──────────────────────────────────────────────────┐
│  listing_business_apps-developer_insight-        │
│  developer_project_total_listing_type            │
│  (project_id = developer project identity)       │
│  Daily listing type counts per project           │
└──────────────────────────────────────────────────┘
```

- **`project_id`** links to the same developer project across all `developer_insight` indices
- See also: `lba-devinsight-total-agents-summaries.md`, `lba-devinsight-developer-project-total-listing-type.md`
