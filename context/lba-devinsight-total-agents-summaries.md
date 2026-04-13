# LBA Developer Insight Total Agents Summaries Index Schema

> **Index**: `listing_business_apps-developer_insight-total_agents_summaries`
>
> **Purpose**: Summary of total agents (in-house vs all) per developer project
>
> **Primary Use Cases**: Agent count lookups per project, in-house agent ratio analysis, developer staffing overview
>
> **Document Count**: ~24
>
> **Source**: PostgreSQL table `developer_insight.total_agents_summaries` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `project_id` | text/keyword | Project ID | Per-project lookups via `.keyword` |
| `total_all_agent` | text/keyword | Total agent count | Numeric comparison (stored as string) |
| `total_in_house` | text/keyword | In-house agent count | Numeric comparison (stored as string) |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Record ID (auto-increment) |
| `total_all_agent` | text/keyword | Total number of all agents for the project (stored as string) |
| `total_in_house` | text/keyword | Total number of in-house agents (stored as string) |
| `project_id` | text/keyword | Project ID |
| `created_at` | text/keyword | Creation timestamp (format: `YYYY-MM-DD HH:mm:ss.SSSSSS`) |
| `updated_at` | text/keyword | Last update timestamp (format: `YYYY-MM-DD HH:mm:ss.SSSSSS`) |

> **SQL Schema**: `developer_insight.total_agents_summaries`
>
> **Note**: Numeric values (`total_all_agent`, `total_in_house`) are stored as strings in ES due to dynamic mapping. Use `.keyword` for exact match or sorting.

---

## Sample Document

```json
{
  "id": "5",
  "total_all_agent": "6",
  "total_in_house": "0",
  "project_id": "2746",
  "created_at": "2024-11-07 12:00:04.040643",
  "updated_at": "2024-11-29 12:00:09.444437"
}
```

---

## Query Examples

### Get agent summary for a specific project
```json
{
  "query": {
    "term": { "project_id.keyword": "2746" }
  }
}
```

### All projects with their agent counts
```json
{
  "query": { "match_all": {} },
  "sort": [{ "project_id.keyword": "asc" }],
  "size": 50
}
```

### Find projects with in-house agents
```json
{
  "query": {
    "bool": {
      "must_not": [
        { "term": { "total_in_house.keyword": "0" }}
      ]
    }
  }
}
```

### Recently updated summaries
```json
{
  "query": {
    "range": { "updated_at.keyword": { "gte": "2026-01-01" }}
  },
  "sort": [{ "updated_at.keyword": "desc" }]
}
```

### Get all summaries (small index -- safe to retrieve all)
```json
{
  "query": { "match_all": {} },
  "size": 50,
  "_source": ["project_id", "total_all_agent", "total_in_house", "updated_at"]
}
```

---

## Relationships

```
┌──────────────────────────────────────────────────┐
│  listing_business_apps-developer_insight-        │
│  total_agents_summaries                          │
│  (project_id = developer project identity)       │
└────────────┬─────────────────────────────────────┘
             │ shares project_id
             ▼
┌──────────────────────────────────────────────────┐
│  listing_business_apps-developer_insight-        │
│  in_house_recommendations                        │
│  (project_id + type = recommendation identity)   │
│  Per-type in-house vs all-agent recommendations  │
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
- The `total_all_agent` value here corresponds to the `all_agent` field in `TOTAL_AGENT` type recommendations
- See also: `lba-devinsight-in-house-recommendations.md`, `lba-devinsight-developer-project-total-listing-type.md`
