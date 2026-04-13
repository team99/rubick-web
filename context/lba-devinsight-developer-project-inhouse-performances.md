# LBA Developer Insight — Developer Project Inhouse Performances Index Schema

> **Index**: `listing_business_apps-developer_insight-developer_project_inhouse_performances`
>
> **Purpose**: Daily performance metrics (impressions, views, enquiries) for developer projects tracked by in-house agents only
>
> **Primary Use Cases**: In-house agent performance dashboards, developer project engagement analytics, internal team reporting
>
> **Document Count**: ~6
>
> **Source**: PostgreSQL table `developer_insight.developer_project_inhouse_performances` (synced via CDC/ETL — no ES mappings in codebase)
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
| `project_name` | text/keyword | Project name (e.g. `"The Daarra Exclusive Residence - Ungaran"`) |
| `performance_data` | nested/object | JSON array of daily performance metrics (see structure below) |

> **Primary Key**: `project_id`

---

## SQL Schema

```sql
CREATE TABLE "developer_insight".developer_project_inhouse_performances (
    project_id INT PRIMARY KEY REFERENCES "developer_insight".project(project_id),
    project_name VARCHAR NOT NULL,
    performance_data JSONB NOT NULL
);
```

---

## Nested JSON Structures

### `performance_data` (JSON array of daily metrics)

Each element represents one day of in-house agent performance data for the developer project.

```json
[
  {
    "date": "2025-07-06",
    "views": 9,
    "enquiries": 0,
    "impressions": 137
  }
]
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `date` | string | Date of the metrics snapshot (YYYY-MM-DD) |
| `impressions` | int | Number of times project listings appeared in search results (in-house agents only) |
| `views` | int | Number of listing detail page views (in-house agents only) |
| `enquiries` | int | Number of enquiries received (in-house agents only) |

> **Note**: `performance_data` is stored as text/keyword in ES (dynamic mapping). The JSON is stored as a string — you cannot query nested fields directly without scripting.

---

## Query Examples

### Get inhouse performance data for a specific project
```json
{
  "query": {
    "term": { "project_id.keyword": "123" }
  }
}
```

### Search projects by name
```json
{
  "query": {
    "match": { "project_name": "Daarra Exclusive" }
  }
}
```

### List all inhouse performance records
```json
{
  "query": {
    "match_all": {}
  },
  "size": 10
}
```

### Count total inhouse performance records
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

### Compare inhouse vs all-agent data for the same project
First query this index, then query `listing_business_apps-developer_insight-developer_project_all_agent_performances` with the same `project_id`:
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
       ├── 1:1 → developer_project_inhouse_performances (project_id)    ← this index
       ├── 1:1 → developer_project_all_agent_performances (project_id)
       ├── 1:1 → developer_project_total_listing_type (project_id)
       ├── 1:N → in_house_recommendations (project_id)
       └── 1:1 → total_agents_summaries (project_id)
```

- **`project_id`** is the foreign key linking to `developer_insight.project`
- This index tracks **in-house agents only** — for all-agent metrics, see `lba-devinsight-developer-project-all-agent-performances.md`
- Both project-level performance indices share the same `performance_data` JSON structure (date, views, enquiries, impressions)
- City-level and district-level aggregations are available in `lba-devinsight-developer-city-performances.md` and `lba-devinsight-developer-district-performances.md`
