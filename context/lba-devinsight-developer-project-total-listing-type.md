# LBA Developer Insight Developer Project Total Listing Type Index Schema

> **Index**: `listing_business_apps-developer_insight-developer_project_total_listing_type`
>
> **Purpose**: Daily counts of listing types (featured, premier, regular, online) per developer project, split by all agents vs in-house
>
> **Primary Use Cases**: Listing type distribution analysis per project, in-house vs all-agent listing breakdown, daily listing trend tracking
>
> **Document Count**: ~1.2K
>
> **Source**: PostgreSQL table `developer_insight.developer_project_total_listing_type` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-listing`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `project_id` | text/keyword | Project ID (primary key) | Per-project lookups via `.keyword` |
| `project_name` | text/keyword | Project name | Text search or exact match |

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | text/keyword | Project ID (primary key, FK to `developer_insight.project`) |
| `project_name` | text/keyword | Project name (e.g. `"The Primrose Condovilla"`) |
| `performance_data` | nested/object | JSON array of daily listing type counts (see structure below) |

> **Primary Key**: `project_id`
>
> **SQL Schema**: `developer_insight.developer_project_total_listing_type`

---

## Nested JSON Structures

### `performance_data` (JSON array of daily snapshots)

Each element in the array represents one day's listing type counts, split between all agents and in-house agents.

```json
[
  {
    "date": "2024-11-21",
    "online": { "all": 1, "inhouse": 0 },
    "premier": { "all": 0, "inhouse": 0 },
    "regular": { "all": 1, "inhouse": 0 },
    "featured": { "all": 0, "inhouse": 0 }
  },
  {
    "date": "2024-11-22",
    "online": { "all": 2, "inhouse": 1 },
    "premier": { "all": 1, "inhouse": 0 },
    "regular": { "all": 1, "inhouse": 1 },
    "featured": { "all": 0, "inhouse": 0 }
  }
]
```

| Nested Field | Type | Description |
|-------------|------|-------------|
| `date` | string | Date of the snapshot (format: `YYYY-MM-DD`) |
| `online` | object | Online listing counts |
| `online.all` | int | Total online listings across all agents |
| `online.inhouse` | int | Online listings by in-house agents only |
| `premier` | object | Premier listing counts |
| `premier.all` | int | Total premier listings across all agents |
| `premier.inhouse` | int | Premier listings by in-house agents only |
| `regular` | object | Regular listing counts |
| `regular.all` | int | Total regular listings across all agents |
| `regular.inhouse` | int | Regular listings by in-house agents only |
| `featured` | object | Featured listing counts |
| `featured.all` | int | Total featured listings across all agents |
| `featured.inhouse` | int | Featured listings by in-house agents only |

> **Note on field naming**: The Go model uses `Basic` for the field name (`ListingTypeCount`), but the ES data contains `regular` instead. These may have been renamed during the ETL transformation.
>
> **Go Model** (`TotalListingType`):
> ```go
> type TotalListingType struct {
>     ProjectId int              `json:"project_id"`
>     Date      string           `json:"date"`
>     Online    ListingTypeCount `json:"online"`
>     Premier   ListingTypeCount `json:"premier"`
>     Featured  ListingTypeCount `json:"featured"`
>     Basic     ListingTypeCount `json:"basic"`
> }
> ```

---

## Query Examples

### Get listing type data for a specific project
```json
{
  "query": {
    "term": { "project_id.keyword": "2746" }
  }
}
```

### Search projects by name
```json
{
  "query": {
    "match": { "project_name": "Primrose" }
  }
}
```

### Get project by exact name
```json
{
  "query": {
    "term": { "project_name.keyword": "The Primrose Condovilla" }
  }
}
```

### Get all projects with their listing type data (paginated)
```json
{
  "query": { "match_all": {} },
  "sort": [{ "project_id.keyword": "asc" }],
  "size": 20,
  "from": 0
}
```

### Get only project metadata (exclude large performance_data)
```json
{
  "query": { "match_all": {} },
  "_source": ["project_id", "project_name"],
  "size": 50
}
```

### Count total projects in the index
```json
{
  "size": 0,
  "query": { "match_all": {} }
}
```

---

## Relationships

```
┌──────────────────────────────────────────────────┐
│  listing_business_apps-developer_insight-        │
│  developer_project_total_listing_type            │
│  (project_id = developer project identity)       │
│  Daily listing type counts per project           │
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
│  total_agents_summaries                          │
│  (project_id = developer project identity)       │
│  Agent totals per project (in-house vs all)      │
└──────────────────────────────────────────────────┘
```

- **`project_id`** links to the same developer project across all `developer_insight` indices
- The listing types (`online`, `premier`, `regular`, `featured`) correspond to the listing tier system used across the Rumah123 platform
- See also: `lba-devinsight-in-house-recommendations.md`, `lba-devinsight-total-agents-summaries.md`, `lba-devinsight-developer-leads-performance.md`
