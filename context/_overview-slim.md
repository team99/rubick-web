# Elasticsearch Index Overview

> Use `get_schema` to load detailed field documentation before querying an index.

## Available Indices

| Index Pattern | Domain | Description | Doc Count |
|---|---|---|---|
| `enquiries` | Enquiries | Lead/enquiry data from consumers | ~37.5M |
| `listings-r123-*` | Listings | Full listing details (Rumah123) | ~9.5M |
| `listings-ipropsg` | Listings | Full listing details (iProperty) | ~720K |
| `properties-r123-*` | Properties | Search/filter index (Rumah123) | ~9.7M |
| `properties-ipropsg` | Properties | Search/filter index (iProperty) | ~720K |
| `users` | Users | Agent and user accounts (Rumah123) | ~316K |
| `users-ipropsg` | Users | Agent and user accounts (iProperty) | ~8.8K |
| `organizations` | Organizations | Agencies and developers (Rumah123) | ~15K |
| `organizations-ipropsg` | Organizations | Agencies and developers (iProperty) | ~445 |
| `locations` | Locations | Geographic hierarchy | ~239K |
| `suggestions-r123-*` | Suggestions | Search autocomplete | ~8M |
| `user-activities` | User Activities | User behavior tracking | ~8.3M |
| `user-seen-listings-*` | User Seen Listings | Listings viewed by users | ~7M |
| `homepage-advertisements` | Ads | Homepage banner ads | ~100 |
| `area-specialists` | Area Specialists | Agent area expertise rankings | ~598 |
| `mail_lead` | Mail Lead | Legacy enquiry data (PHP system) | ~24.8M |
| `adcredit-prod_adcredit_accounts` | AdCredit | Ad credit wallet accounts | ~34K |
| `adcredit-prod_adcredit_balances` | AdCredit | Credit balance buckets with expiry | ~97.7K |
| `adcredit-prod_adcredit_transactions` | AdCredit | Ad credit transaction ledger | ~16.1M |
| `adcredit-prod_adcredit_nudge_events` | AdCredit | Nudge notifications | ~140.8K |
| `listing_business_apps-analytics-srp_ranks` | LBA Analytics | SRP ranking data | ~8.9M |
| `listing_business_apps-analytics-listing_performances` | LBA Analytics | Daily listing performance metrics | ~12.6M |
| `listing_business_apps-analytics-market_price_references` | LBA Analytics | Market price ranges by location | 5,948 |
| `listing_business_apps-analytics-district_performances` | LBA Analytics | Repost activity per district | 4,163 |
| `listing_business_apps-developer_insight-*` | LBA DevInsight | Developer project analytics | Various |

## Key Fields per Index

| Index | Key Fields |
|---|---|
| `enquiries` | `time.created` (date), `agent.uuid.keyword`, `button_source` (long), `category.keyword`, `leads_source` (long) |
| `listings-r123-*` | `status`, `property_type.value`, `price_type.value`, `price.offer` (long), `portal_id`, `agents.uuid`, `location.cities.name`, `time.created` |
| `properties-r123-*` | `status`, `property_type`, `price_type`, `portal_id`, `bedrooms`, `bathrooms`, `building_size`, `land_size` |
| `users` | `type.value` (1=agent), `name`, `uuid`, `organization.uuid`, `portal_id`, `instance_info.is_removed` |
| `organizations` | `type.value` (0=agency, 1=developer), `name`, `status`, `portal_id` |
| `locations` | `name`, `type.value`, `level`, `portal_id` |
| `user-activities` | `user_uuid`, `activity_type`, `listing_uuid`, `time.created` |
| `mail_lead` | `user_id`, `property_type.keyword`, `button_source.keyword`, `created_date.keyword` |
| `adcredit-*_transactions` | `transaction_type.keyword`, `transaction_date.keyword`, `tags.listing_id`, `tags.bucket_type` |

## Index Relationships

**Properties <-> Listings (two-phase search):**
- `properties-r123-*` is for filtering/sorting (minimal fields, fast)
- `listings-r123-*` has full document details (agent info, media, descriptions)
- Search flow: query properties -> get UUIDs -> fetch from listings

**Enquiries -> Users:**
- `enquiries.agent.uuid` links to `users.uuid`
- To get agent names for enquiry data, query enquiries first, then look up users by UUID

## Common Enums

### Portal ID
| Value | Brand |
|---|---|
| 1 | Rumah123 |
| 2 | iProperty SG |

### Property Status (`status`)
| Value | Name |
|---|---|
| 0 | Pending |
| 1 | Active |
| 3 | Inactive |
| 4 | Sold/Rented |

### Price Type
| Value | Name |
|---|---|
| 0 | Sale |
| 1 | Rent |

### Property Type (R123)
| Value | Name |
|---|---|
| 0 | House |
| 1 | Apartment |
| 2 | Ruko (Shophouse) |
| 3 | Villa |
| 5 | Land |

### User Type (`type.value`)
| Value | Name |
|---|---|
| 0 | Regular consumer |
| 1 | Agent |
| 2 | Developer |

### Organization Type (`type.value`)
| Value | Name |
|---|---|
| 0 | Agency |
| 1 | Developer |

### Enquiry Button Source (`button_source`)
| Value | Method |
|---|---|
| 1 | Phone |
| 2 | Email |
| 3 | WhatsApp |
| 4 | Crosspost |
| 6 | Post Inquiry Form |

## Query Tips

1. **Use `filter` not `must`** for exact matches — faster (cacheable)
2. **Always exclude deleted**: `instance_info.is_removed: false`
3. **Use `.keyword` suffix** for exact string matches on text fields
4. **Date fields**: listings/enquiries use `time.created`, mail_lead uses `created_date.keyword`
5. **Active listings**: filter `status: "1"`
6. **Agents only**: filter `type.value: 1`
7. **Prices**: IDR for Rumah123, SGD for iProperty

## Example Query Mapping

| Question | Indices Needed |
|---|---|
| "Top agents by enquiries" | enquiries + users |
| "Houses for sale under 1B in Jakarta" | listings-r123-* |
| "WhatsApp enquiries this month" | enquiries |
| "Most viewed listings last 7 days" | user-activities |
| "Agent credit spending" | adcredit-prod_adcredit_transactions |
