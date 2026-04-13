# Mail Lead Index Schema

> **Index**: `mail_lead`
>
> **Purpose**: Legacy enquiry/lead data from consumers (Rumah123 legacy system)
>
> **Primary Use Cases**: Historical lead analysis, legacy data migration, lead tracking
>
> **Document Count**: ~24.8M

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `property_type` | text/keyword | Property type code | `property_type.keyword: "ho"` for houses |
| `property_category` | text/keyword | Sale (s) or Rent (r) | `property_category.keyword: "s"` |
| `lead_source` | text/keyword | Page source of lead | `lead_source.keyword: "2"` for LDP |
| `button_source` | text/keyword | Contact method used | `button_source.keyword: "3"` for WhatsApp |
| `inquiry_type` | text/keyword | Type of inquiry | `inquiry_type.keyword: "1"` for listing |
| `user_id` | text/keyword | Agent/recipient user ID | |
| `created_date` | text | Lead creation timestamp | |

---

## Property Type ✅

**Field**: `property_type` (text with keyword)

| Value | Type | Description | Count |
|-------|------|-------------|-------|
| `ho` | House | Rumah | ~15.3M |
| `ap` | Apartment | Apartemen | ~2.4M |
| `la` | Land | Tanah | ~1.9M |
| `sh` | Shop House | Ruko | ~1.8M |
| `wa` | Warehouse | Gudang | ~1M |
| `np` | New Project | Primary project | ~851K |
| `` (empty) | Profile | Direct agent contact | ~649K |
| `cs` | Commercial Space | Ruang Usaha | ~231K |
| `of` | Office | Kantor | ~219K |
| `fa` | Factory | Pabrik | ~143K |
| `ks` | Kost | Boarding house | ~126K |
| `vl` | Villa | Villa | ~58K |
| `ht` | Hotel | Hotel | ~15K |
| `dr` | Directory | Company directory | ~342 |

---

## Property Category ✅

**Field**: `property_category` (text with keyword)

| Value | Category | Count |
|-------|----------|-------|
| `s` | Sale | ~13.7M |
| `r` | Rent | ~10.4M |
| `` (empty) | Not specified | ~650K |

---

## Lead Source ✅

**Field**: `lead_source` (text with keyword) - Page where enquiry originated

| Value | Source | Description | Count |
|-------|--------|-------------|-------|
| 1 | SRP | Search Results Page | ~5.9M |
| 2 | LDP | Listing Detail Page | ~11.6M |
| 3 | NSRP | New Search Results Page | ~1.5K |
| 4 | PDP | Project Detail Page | ~158K |
| 5 | Agent | Agent Profile Page | ~475K |
| 6 | Crosspost SRP | Crosspost Search Results | ~167K |
| 9 | FB Lead Gen | Facebook Lead Generation | ~286K |
| 10 | Consumer Dashboard | Consumer Dashboard | ~5.3K |
| -1 | Unknown | Not tracked | ~5.6M |
| 0 | Unknown | Not tracked | ~570K |

---

## Button Source ✅

**Field**: `button_source` (text with keyword) - Contact method used

| Value | Button | Description | Count |
|-------|--------|-------------|-------|
| 1 | Phone | Phone call | ~1.9M |
| 2 | Email | Email form | ~1.4M |
| 3 | WhatsApp | WhatsApp button | ~12.7M |
| 4 | Crosspost | Crosspost enquiry | ~946K |
| 5 | Microsite Agency | Microsite agency | ~31K |
| 6 | Post Inquiry | Post inquiry form | ~261K |
| 8 | Cobroke | Cobroke enquiry | ~11K |
| -1 | Unknown | Not tracked | ~6.1M |
| 0 | Unknown | Not tracked | ~1.3M |

---

## Inquiry Type ✅

**Field**: `inquiry_type` (text with keyword)

| Value | Type | Description | Count |
|-------|------|-------------|-------|
| 0 | Legacy | Default/legacy enquiries | ~8K |
| 1 | Listing | Enquiry about a specific listing | ~24.1M |
| 2 | Profile | Direct agent enquiry (no listing) | ~637K |
| 3 | Project | Primary/new project enquiry | ~3K |
| 4 | Developer | Developer section enquiry | ~56K |

---

## Client Type ✅

**Field**: `client_type` (text with keyword) - Source client/platform (from oauth_clients)

| Value | Platform | Description | Count |
|-------|----------|-------------|-------|
| 2 | Web | Web browser client (legacy) | ~1.3M |
| 5 | Android | Android mobile customer app | ~22.9M |
| 6 | iOS | iOS mobile customer app | - |
| 22 | Web | Web browser client (newer) | ~437K |
| 25 | Mobile Consumer | Android consumer app | ~210K |
| 26 | Mobile Consumer | iOS consumer app | ~32K |
| 27 | Regional Mobile | Regional mobile consumer app | ~14K |

> **Source**: Verified from `apps/models/DeviceToken.php` and `apps/plugin/Auth/plugin/OAuth.php`
> **Note**: Values 5, 6 are mobile_customer (agent app), values 25, 26, 27 are mobile_consumer (consumer app)

---

## Sender Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `sender_name` | text | Consumer's name |
| `sender_mail` | text | Consumer's email |
| `sender_contact` | text | Consumer's phone number |
| `message` | text | Enquiry message content |
| `sender_ip` | text | Client IP address |
| `sender_guid` | text | Consumer GUID/session ID |
| `sender_url` | text | Page URL where enquiry was sent |
| `sender_user_agent` | text | Browser/client user agent |
| `sender_section` | text | Page section identifier |

---

## Reference Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `mail_lead_id` | text | Primary key / Lead ID |
| `ads_id` | text | Listing/ad ID (legacy) |
| `ads_project_id` | text | Project ID (for primary listings) |
| `ads_global_id` | text | Global listing ID |
| `user_id` | text | Recipient agent/user ID |
| `ref_origin_id` | text | Reference origin ID |
| `ref_district_name` | text | District name reference |
| `ref_city_name` | text | City name reference |
| `ref_ads_price` | text | Price reference |

---

## Status Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `is_read` | text | Read status (0=Unread, 1=Read) |
| `read_date` | text | When lead was read |
| `is_send` | text | Push notification sent (0=No, 1=Yes) |
| `send_date` | text | When notification was sent |
| `delete_date` | text | Soft delete timestamp |
| `iql_status` | text | IQL status (0=Success) |
| `iql_status_date` | text | IQL status timestamp |

---

## Subscription Flags ✅

| Field | Type | Description |
|-------|------|-------------|
| `issubs_invitation` | text | Subscribed to invitations (0/1) |
| `issubs_schedule` | text | Subscribed to schedules (0/1) |
| `issubs_brosur` | text | Subscribed to brochures (0/1) |
| `issubs_detail_info` | text | Subscribed to detail info (0/1) |
| `issubs_price_info` | text | Subscribed to price info (0/1) |
| `issubs_developer_news` | text | Subscribed to developer news (0/1) |

> **Note**: Boolean flags stored as text ("0"/"1")

---

## Location Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `longitude` | text | Sender longitude |
| `latitude` | text | Sender latitude |

> **Note**: Optional geolocation data

---

## Time Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `created_date` | text | Lead creation timestamp |
| `modified_date` | text | Last modification timestamp |
| `read_date` | text | When lead was read |
| `delete_date` | text | Soft delete timestamp |

---

## Additional Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `badge` | text | iOS notification badge count |
| `listing_snapshot` | text | Listing data snapshot (JSON) |
| `mail_lead_tracker_data` | text | Tracking data |

> **Note**: Legacy fields, inferred from ES mapping

---

## Query Examples

### Enquiries for specific agent
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "user_id.keyword": "12345" }},
        { "term": { "is_read.keyword": "0" }}
      ],
      "must_not": [{ "exists": { "field": "delete_date" }}]
    }
  }
}
```

### Count by property type
```json
{
  "size": 0,
  "aggs": {
    "by_property_type": {
      "terms": { "field": "property_type.keyword", "size": 20 }
    }
  }
}
```

---

## Notes

- This is a **legacy index** from the Rumah123 PHP/MySQL system
- All fields are stored as `text` with `.keyword` subfields (dynamic mapping)
- NULL values are stored as string `"NULL"` not actual null
- Date fields are stored as text strings, not ES date type
- Consider using `enquiries` index for newer data with proper typing
