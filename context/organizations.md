# Organizations Index Schema

> **Indices**: `organizations`, `organizations-ipropsg`
>
> **Purpose**: Real estate agencies and developer companies
>
> **Primary Use Cases**: Agency search, agency profiles, developer listings

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `type.value` | keyword | Organization type | `type.value: 0` for agencies |
| `name` | text | Organization name | Text search |
| `status` | keyword | Organization status | |
| `portal_id` | integer | Portal identifier | |

---

## Organization Type ✅

**Field**: `type` (object)

| Value | Name | Description | Count (R123) |
|-------|------|-------------|--------------|
| 0 | Agency | Real estate agency | ~15K |
| 1 | Developer | Property developer | 0 (in this index) |

---

## Core Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | keyword | Unique identifier |
| `origin_id` | keyword | Legacy ID |
| `name` | text | Organization name |
| `description` | text | About/description |
| `url` | text | Profile URL |
| `slug` | keyword | URL-friendly name |

---

## Instance Info ✅

**Field**: `instance_info` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `is_removed` | boolean | Organization is deleted |
| `status` | keyword | Organization status |

---

## Attributes ✅

**Field**: `attributes` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `address` | text | Office address |
| `nib` | keyword | Business registration number |
| `license_no` | keyword | License number |
| `language` | keyword | Preferred language |
| `is_paid` | boolean | Has paid subscription |
| `area_specialist` | keyword[] | Area expertise |
| `property_specialist` | keyword | Property type expertise |

---

## Contact Fields ✅

**Field**: `contacts` (object[])

| Sub-field | Type | Description |
|-----------|------|-------------|
| `type.value` | keyword | Contact type ID |
| `type.name` | keyword | Contact type name |
| `value` | keyword | Contact value |

### Contact Types
| Value | Name |
|-------|------|
| 1 | Email |
| 2 | Phone Number |
| 3 | Whatsapp |
| 5 | Website |

---

## Location ✅

**Field**: `location` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `countries` | object[] | Country info |
| `provinces` | object[] | Province info |
| `cities` | object[] | City info |
| `districts` | object[] | District info |
| `additional_address` | text | Additional address info |

---

## Social Media ✅

**Field**: `attributes.social_media` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `facebook` | keyword | Facebook URL |
| `instagram` | keyword | Instagram handle |
| `twitter` | keyword | Twitter handle |
| `linkedin` | keyword | LinkedIn URL |
| `youtube` | keyword | YouTube channel |

> **Note**: Optional fields, inferred from ES mapping

---

## Awards ✅

**Field**: `attributes.awards` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `rumah123_awards` | keyword[] | R123 awards |
| `other_awards` | keyword[] | External awards |

> **Note**: Optional fields, inferred from ES mapping

---

## Media Fields ✅

**Field**: `medias` (object[]) - Logo and images

| Sub-field | Type | Description |
|-----------|------|-------------|
| `media_type_id` | keyword | Media type |
| `media_type_value` | keyword | Media type name |
| `info.url` | text | Image URL |

---

## Statistics ✅

| Field | Type | Description |
|-------|------|-------------|
| `median_property_price` | long | Median listing price |
| `agent_count` | integer | Number of agents |
| `property_counts` | object | Listing statistics |

> **Note**: Computed aggregate statistics

---

## Parent Organization ✅

**Field**: `parent` (object) - For branch offices

| Sub-field | Type | Description |
|-----------|------|-------------|
| `uuid` | keyword | Parent org UUID |
| `name` | text | Parent org name |
| `origin_id` | keyword | Parent legacy ID |

> **Note**: Optional for branch offices, inferred from ES mapping

---

## Time Fields ✅

| Sub-field | Type | Description |
|-----------|------|-------------|
| `time.created` | date | Creation timestamp |
| `time.updated` | date | Last update |
| `time.removed` | date | Deletion timestamp |

---

## Query Examples

### Active agencies
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "type.value": 0 }},
        { "term": { "instance_info.is_removed": false }}
      ]
    }
  }
}
```

### Agencies by agent count
```json
{
  "size": 10,
  "query": {
    "bool": {
      "filter": [
        { "term": { "type.value": 0 }},
        { "term": { "instance_info.is_removed": false }}
      ]
    }
  },
  "sort": [{ "agent_count": "desc" }]
}
```
