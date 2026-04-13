# Users Index Schema

> **Indices**: `users`, `users-ipropsg`
>
> **Purpose**: Agent and user account data
>
> **Primary Use Cases**: Agent search, profile display, agent analytics

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `type.value` | keyword | User type ID | `type.value: 1` for agents |
| `portal_id` | integer | Portal identifier | `portal_id: 1` for R123 |
| `name` | text | User/agent name | Text search |
| `organization.uuid` | keyword | Associated agency | Exact match |

---

## User Type ✅

**Field**: `type` (object)
- `type.value` - Integer ID
- `type.name` - Display name

| Value | Name | Description | Count (R123) |
|-------|------|-------------|--------------|
| 1 | Agent | Real estate agent | ~303K |
| 2 | Developer | Property developer | ~1.4K |
| 4 | Internal User | Internal staff | 4 |

> **Note**: Value 0 (Regular user) exists in code but not found in this index.

### ⚠️ Agent Status Filtering (Important)

When querying **agents only** (`type.value: 1`), the application **automatically adds** `instance_info.status: 1` (active) filter. This means:
- Agent-only queries return only **active** agents
- Developer queries do NOT have this automatic filter
- Mixed user type queries do NOT have this automatic filter

> **Source**: Verified from `pkg/repository/impl/elasticsearch/r123/v8/user_repository_helper.go`

---

## Portal ID ✅

**Field**: `portal_id` (integer)

| Value | Name |
|-------|------|
| 1 | Rumah123 |
| 2 | iProperty SG |

---

## Core User Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | keyword | Unique user identifier |
| `origin_id` | keyword | Legacy user ID |
| `name` | text | Display name |
| `username` | keyword | Login username (usually email) |
| `url` | text | Profile URL |
| `description` | text | Bio/description |
| `address` | text | User address |
| `language` | keyword | Preferred language |

---

## Contact Fields ✅

**Field**: `contacts` (object[])

| Sub-field | Type | Description |
|-----------|------|-------------|
| `contacts.type.value` | keyword | Contact type ID |
| `contacts.type.name` | keyword | Contact type name |
| `contacts.value` | keyword | Contact value |

### Contact Types ✅
| Value | Name | Description |
|-------|------|-------------|
| 1 | Email | Email address |
| 2 | Phone Number | Phone number |
| 3 | Whatsapp | WhatsApp number |
| 5 | Website | Website URL |

---

## Organization Fields ✅

**Field**: `organization` (object) - Associated agency/developer

| Sub-field | Type | Description |
|-----------|------|-------------|
| `organization.uuid` | keyword | Organization UUID |
| `organization.name` | text | Organization name |
| `organization.type.value` | keyword | 0=Agency, 1=Developer |
| `organization.url` | text | Organization profile URL |
| `organization.instance_info.status` | keyword | Organization status |

---

## Agent Statistics ✅

| Field | Type | Description |
|-------|------|-------------|
| `agent_enquiry_count` | integer | Total enquiries received |
| `agent_feature_purchase_count` | integer | Feature purchases |
| `agent_premier_purchase_count` | integer | Premier purchases |
| `agent_repost_purchase_count` | integer | Repost purchases |
| `median_property_price` | long | Median listing price |
| `property_counts` | object | Listing statistics |

### Property Counts ✅
| Sub-field | Type | Description |
|-----------|------|-------------|
| `property_counts.active` | long | Active listings |
| `property_counts.sale` | long | Sale listings |
| `property_counts.rent` | long | Rent listings |
| `property_counts.sold` | long | Sold properties |
| `property_counts.rented` | long | Rented properties |

> **Note**: Computed aggregate statistics, inferred from ES mapping

---

## Agent Attributes ✅

**Field**: `attributes` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `is_verified` | boolean | Verified agent badge |
| `is_homeowner` | boolean | Is homeowner (non-agent) |
| `nib` | keyword | Agent business registration |
| `organization_nib` | keyword | Agency business registration |

---

## Specializations ✅

| Field | Type | Description |
|-------|------|-------------|
| `area_specialist` | keyword[] | Area expertise (location UUIDs) |
| `property_specialist` | text | Property type expertise |

---

## Awards ✅

**Field**: `awards` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `rumah123_awards` | keyword[] | R123 award names |
| `other_awards` | keyword[] | External awards |

> **Note**: Optional fields, inferred from ES mapping

---

## Social Media ✅

**Field**: `social_media` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `facebook` | keyword | Facebook URL |
| `instagram` | keyword | Instagram handle |
| `twitter` | keyword | Twitter handle |
| `linkedin` | keyword | LinkedIn URL |
| `youtube` | keyword | YouTube channel |

---

## Media Fields ✅

**Field**: `medias` (object[]) - Profile photos

| Sub-field | Type | Description |
|-----------|------|-------------|
| `media_type_id` | keyword | Media type (0=Regular, 1=Cover) |
| `info.url` | text | Image URL |
| `info.thumbnail_url` | text | Thumbnail URL |

---

## Developer Listings ✅ (Nested)

**Field**: `listings` (nested array) - Only for developers (type.value: 2)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `listings.uuid` | keyword | Listing UUID |
| `listings.origin_id` | keyword | Legacy listing ID |
| `listings.title` | text | Listing title |
| `listings.price.offer` | long | Price |
| `listings.price.range.gte` | long | Min price |
| `listings.price.range.lte` | long | Max price |
| `listings.location.uuid` | keyword | Location UUID |
| `listings.location.parents.uuid` | keyword[] | Parent location UUIDs |
| `listings.attributes.property_types` | integer[] | Property types |

> **Source**: Used for developer search with inner hits. Verified from `pkg/repository/impl/elasticsearch/r123/v8/helper/user/query_developer_buiilder.go`

---

## Subscription ✅

**Field**: `subscription` (object) - Agent subscription/membership

| Sub-field | Type | Description |
|-----------|------|-------------|
| `id` | long | Subscription ID |
| `status` | long | Subscription status |
| `type.value` | long | Subscription type |
| `type.name` | text | Subscription name |
| `time.start_time` | date | Subscription start |
| `time.end_time` | date | Subscription end |

---

## Instance Info ✅

**Field**: `instance_info` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `is_removed` | boolean | User is deleted |
| `status` | keyword | User status |

---

## Time Fields ✅

| Sub-field | Type | Description |
|-----------|------|-------------|
| `time.created` | date | Account creation |
| `time.updated` | date | Last update |
| `time.removed` | date | Deletion timestamp |

---

## Query Examples

### Active agents
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "type.value": 1 }},
        { "term": { "instance_info.is_removed": false }}
      ]
    }
  }
}
```

### Top agents by listing count
```json
{
  "size": 10,
  "query": {
    "bool": {
      "filter": [
        { "term": { "type.value": 1 }},
        { "term": { "instance_info.is_removed": false }}
      ]
    }
  },
  "sort": [{ "property_counts.active": "desc" }]
}
```
