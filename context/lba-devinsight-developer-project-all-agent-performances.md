# LBA Developer Insight — Developer Project All Agent Performances Index Schema

> **Index**: `listing_business_apps-developer_insight-developer_project_all_agent_performances`
>
> **Purpose**: Daily performance metrics (impressions, views, enquiries) for developer projects tracked across ALL agents (not just in-house)
>
> **Primary Use Cases**: Full agent performance dashboards, developer project engagement analytics, cross-agent comparison
>
> **Document Count**: ~1,246
>
> **Source**: PostgreSQL table `developer_insight.developer_project_all_agent_performances` (synced via CDC/ETL — no ES mappings in codebase)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `project_id` | text/keyword | Project ID (FK to project table) | Exact match via `.keyword` |
| `project_name` | text/keyword | Project name | Full-text or `.keyword` match |
| `performance_data` | nested/object | JSON array of daily performance metrics | Contains daily impressions/views/enquiries |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | text/keyword | Project ID — primary key (FK to `developer_insight.project`) |
| `project_name` | text/keyword | Project name (e.g. `"31 Sudirman Suites"`) |
| `performance_data` | nested/object | JSON array of daily performance metrics (see structure below) |

> **Primary Key**: `project_id`

---

## SQL Schema

```sql
CREATE TABLE "developer_insight".developer_project_all_agent_performances (
    project_id INT PRIMARY KEY REFERENCES "developer_insight".project(project_id),
    project_name VARCHAR NOT NULL,
    performance_data JSONB NOT NULL
);
```

---

## Nested JSON Structures

### `performance_data` (JSON array of daily metrics)

Each element represents one day of performance data across all agents for the developer project.

```json
[
  {
    "date": "2025-10-30",
    "views": 0,
    "enquiries": 0,
    "impressions": 4
  }
]
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `date` | string | Date of the metrics snapshot (YYYY-MM-DD) |
| `impressions` | int | Number of times project listings appeared in search results (all agents) |
| `views` | int | Number of listing detail page views (all agents) |
| `enquiries` | int | Number of enquiries received (all agents) |

> **Note**: `performance_data` is stored as text/keyword in ES (dynamic mapping). The JSON is stored as a string — you cannot query nested fields directly without scripting.

---

## Query Examples

### Get all-agent performance data for a specific project
```json
{
  "query": {
    "term": { "project_id.keyword": "456" }
  }
}
```

### Search projects by name
```json
{
  "query": {
    "match": { "project_name": "Sudirman Suites" }
  }
}
```

### List all projects with performance data (paginated)
```json
{
  "query": {
    "match_all": {}
  },
  "size": 20,
  "from": 0,
  "sort": [{ "project_name.keyword": "asc" }]
}
```

### Count total projects with all-agent performance data
```json
{
  "size": 0,
  "aggs": {
    "total_projects": {
      "value_count": { "field": "project_id.keyword" }
    }
  }
}
```

### Compare all-agent vs inhouse data for the same project
First query this index, then query `listing_business_apps-developer_insight-developer_project_inhouse_performances` with the same `project_id`:
```json
{
  "query": {
    "term": { "project_id.keyword": "456" }
  }
}
```

---

## Relationships

```
┌──────────────────────────────────────────────────┐
│  project                                         │
│  (project_id)                                    │
└──────┬───────────────────────────────────────────┘
       │
       ├── 1:1 → developer_project_inhouse_performances (project_id)
       ├── 1:1 → developer_project_all_agent_performances (project_id)  ← this index
       ├── 1:1 → developer_project_total_listing_type (project_id)
       ├── 1:N → in_house_recommendations (project_id)
       └── 1:1 → total_agents_summaries (project_id)
```

- **`project_id`** is the foreign key linking to `developer_insight.project`
- This index tracks **all agents** — for in-house-only metrics, see `lba-devinsight-developer-project-inhouse-performances.md`
- Both project-level performance indices share the same `performance_data` JSON structure (date, views, enquiries, impressions)
- This index has significantly more documents (~1,246) compared to the in-house index (~6), as it covers all agents across all projects
- City-level and district-level aggregations are available in `lba-devinsight-developer-city-performances.md` and `lba-devinsight-developer-district-performances.md`
