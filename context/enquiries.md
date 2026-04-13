# Enquiries Index Schema

> **Index**: `enquiries`
>
> **Purpose**: Lead/enquiry data from consumers to agents
>
> **Primary Use Cases**: Lead analytics, agent performance, consumer behavior analysis
>
> **Document Count**: ~37.5M

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `category` | keyword | Enquiry category | `category.keyword: "listing"` |
| `leads_source` | long | Lead source page | See enum below |
| `button_source` | long | Contact method used | See enum below |
| `time.created` | date | Enquiry timestamp | Date range queries |
| `agent.uuid` | keyword | Agent receiving enquiry | |

---

## Category ✅

**Field**: `category` (text with keyword)

| Value | Description | Count |
|-------|-------------|-------|
| "listing" | Enquiry about a specific listing | ~18M |
| "project" | Enquiry about a primary project | ~525K |
| "agent" | Direct enquiry to agent | ~450K |

---

## Leads Source ✅

**Field**: `leads_source` (long) - Page where enquiry originated

| Value | Name | Description | Count |
|-------|------|-------------|-------|
| -1 | Unknown | Source not tracked | ~3.4M |
| 0 | Unknown | Source not tracked | ~843K |
| 1 | SRP | Search Results Page | ~4.5M |
| 2 | LDP | Listing Detail Page | ~9.5M |
| 3 | NSRP | New Search Results Page | ~692 |
| 4 | PDP | Project Detail Page | ~124K |
| 5 | Agent | Agent Profile Page | ~362K |
| 6 | Crosspost SRP | Crosspost Search Results | ~84K |
| 7 | Crosspost LDP | Crosspost Listing Detail | ~175 |
| 8 | Developer | Developer Profile Page | ~334 |
| 9 | FB Lead Gen | Facebook Lead Generation | ~181K |
| 10 | Consumer Dashboard | Consumer Dashboard enquiry | ~3.7K |
| 11 | Undefined | Not defined in code (only 7 records - possibly test data) | ~7 |

> **Source**: Values confirmed from PHP `ConsumerEnquiry/models/enum/PageLabel.php`

---

## Button Source ✅

**Field**: `button_source` (long) - Contact method used

| Value | Name | Description | Count |
|-------|------|-------------|-------|
| -1 | Unknown | Not tracked | ~6M |
| 0 | Unknown | Not tracked | ~1.3M |
| 1 | Phone | Phone call button | ~1.4M |
| 2 | Email | Email form | ~703K |
| 3 | WhatsApp | WhatsApp button | ~8.3M |
| 4 | Crosspost | Crosspost enquiry | ~932K |
| 5 | Microsite Agency | Microsite agency enquiry | ~30K |
| 6 | Post Inquiry | Post inquiry form | ~249K |
| 7 | Area Specialist | Area specialist button | ~101 |
| 8 | Cobroke | Cobroke enquiry | ~11K |
| 9 | PDP POI Location | PDP POI location enquiry | - |
| 10 | UDP POI Location | UDP POI location enquiry | - |

> **Note**: Values 5-10 confirmed from PHP `ConsumerEnquiry/models/enum/ButtonLabel.php`

---

## Consumer Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `consumer_name` | text | Consumer's name |
| `consumer_email` | text | Consumer's email |
| `consumer_phone` | text | Consumer's phone number |

---

## Agent Fields ✅

**Field**: `agent` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `agent.uuid` | keyword | Agent UUID |
| `agent.name` | text | Agent name |
| `agent.origin_id` | keyword | Legacy agent ID |
| `agent.organization` | object | Agent's organization info |

---

## Listing Fields ✅

**Field**: `listing` (object) - Details of enquired listing

| Sub-field | Type | Description |
|-----------|------|-------------|
| `listing.uuid` | keyword | Listing UUID |
| `listing.origin_id` | keyword | Legacy listing ID |
| `listing.title` | text | Listing title |
| `listing.status` | long | Listing status |
| `listing.price.offer` | long | Listing price |
| `listing.property_type.value` | long | Property type ID |
| `listing.price_type.value` | long | Sale (0) or Rent (1) |
| `listing.location.cities.name` | text | City name |
| `listing.location.districts.name` | text | District name |

---

## Reference IDs ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | keyword | Unique enquiry ID |
| `origin_id` | keyword | Legacy ID |
| `listing_origin_id` | keyword | Legacy listing ID |
| `agent_origin_id` | keyword | Legacy agent ID |
| `project_origin_id` | keyword | Legacy project ID |
| `developer_origin_id` | keyword | Legacy developer ID |

---

## Source Field ✅

**Field**: `source` (text) - Data source identifier

Common values observed:
- "nnpri" - 99 Primary (99.co)
- "r123" - Rumah123
- Other portal identifiers

> **Note**: Values inferred from ES data samples

---

## Status Fields ✅

**Field**: `status` (text with keyword)
**Field**: `status_sort` (long)
**Field**: `status_history` (nested) - Status change history

### Lead Status ✅
| Value | Status | Sort | Description |
|-------|--------|------|-------------|
| unread | Unread | 1 | New/unread enquiry |
| read | Read | 2 | Enquiry has been read |
| contacted | Contacted | 3 | Agent has contacted consumer |
| survey | Survey | 4 | Site survey scheduled |
| cancel | Cancel | 5 | Enquiry cancelled |
| success | Success | 6 | Deal successful |

### Leads Category ✅
| Value | Category | Description |
|-------|----------|-------------|
| listing | Listing | Enquiry about a specific listing |
| agent | Agent | Direct enquiry to an agent |
| project | Project | Enquiry about a project |
| developer | Developer | Direct enquiry to a developer |

---

## Response Tracking ✅

| Field | Type | Description |
|-------|------|-------------|
| `contacted_via` | keyword | How agent responded |
| `duration_until_contacted` | long | Response time in seconds |

> **Note**: Optional fields, inferred from ES mapping

---

## Time Fields ✅

| Sub-field | Type | Description |
|-----------|------|-------------|
| `time.created` | date | Enquiry creation time |
| `time.updated` | date | Last update time |

---

## Query Examples

### Enquiries for specific agent
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "agent.uuid.keyword": "agent-uuid-here" }},
        { "range": { "time.created": { "gte": "now-30d" }}}
      ]
    }
  }
}
```

### Top agents by enquiry count
```json
{
  "size": 0,
  "query": {
    "range": { "time.created": { "gte": "now-30d" }}
  },
  "aggs": {
    "top_agents": {
      "terms": { "field": "agent.uuid.keyword", "size": 10 }
    }
  }
}
```
