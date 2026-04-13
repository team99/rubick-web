# Elasticsearch Schema Documentation

> **Purpose**: This documentation provides field descriptions, enum values, and data types for all Elasticsearch indices. Use this as context when querying indices via natural language.

## Confidence Markers

- ✅ **Verified** - Field meaning confirmed from code and production data (>80% confidence)
- ⚠️ **Needs Review** - Field meaning inferred but not fully verified (<80% confidence)
- ❓ **Unknown** - Field purpose unclear, requires team input

---

## Index Overview

| Index Pattern | Domain | Description | Doc Count (approx) |
|--------------|--------|-------------|-------------------|
| `properties-r123-*` | Properties | **Primary search index** - filtering, sorting, ranking | ~9.7M |
| `properties-ipropsg` | Properties | Primary search index for iProperty | ~720K |
| `listings-r123-*` | Listings | **Data enrichment index** - full document details | ~9.5M |
| `listings-ipropsg` | Listings | Data enrichment for iProperty | ~720K |
| `users` | Users | Agent and user accounts for Rumah123 | ~316K |
| `users-ipropsg` | Users | Agent and user accounts for iProperty | ~8.8K |
| `organizations` | Organizations | Agencies and developers for Rumah123 | ~15K |
| `organizations-ipropsg` | Organizations | Agencies and developers for iProperty | ~445 |
| `enquiries` | Enquiries | Lead/enquiry data from consumers | ~37.5M |
| `suggestions-r123-*` | Suggestions | Search autocomplete and suggestions | ~8M |
| `suggestions-ipropsg` | Suggestions | Search suggestions for iProperty | ~33K |
| `locations` | Locations | Geographic hierarchy (country/province/city/district) | ~239K |
| `locations-ipropsg` | Locations | Geographic data for Singapore | - |
| `user-activities` | User Activities | User behavior tracking | ~8.3M |
| `user-seen-listings-*` | User Seen Listings | Listings viewed by users | ~7M |
| `homepage-advertisements` | Ads | Homepage banner advertisements | ~100 |
| `area-specialists` | Area Specialists | Agent area expertise rankings | ~598 |
| `mail_lead` | Mail Lead | Legacy enquiry data (Rumah123 PHP system) | ~24.8M |
| `adcredit-prod_adcredit_accounts` | AdCredit | Ad credit wallet accounts for agents | ~34K |
| `adcredit-prod_adcredit_balances` | AdCredit | Individual credit balance buckets with expiry | ~97.7K |
| `adcredit-prod_adcredit_transactions` | AdCredit | Complete ad credit transaction ledger | ~16.1M |
| `adcredit-prod_adcredit_nudge_events` | AdCredit | Nudge notifications sent to users | ~140.8K |
| `adcredit-prod_adcredit_nudge_custom_user_groups` | AdCredit | Custom user groups for nudge targeting | 1 |
| `adcredit-prod_adcredit_nudge_custom_user_members` | AdCredit | User memberships in nudge groups (blacklist) | ~4.3K |
| `adcredit-prod_adcredit_gorp_migrations` | AdCredit | Database migration tracking (system) | 10 |
| `listing_business_apps-analytics-srp_ranks` | LBA Analytics | SRP ranking data with rank history & summary | ~8.9M |
| `listing_business_apps-analytics-listing_performances` | LBA Analytics | Daily listing performance metrics (views, enquiries, etc.) | ~12.6M |
| `listing_business_apps-analytics-user_best_repost_listings` | LBA Analytics | Best listing to repost per user | ~10K |
| `listing_business_apps-analytics-user_listing_recommendation` | LBA Analytics | Personalized listing recommendations per user | ~10K |
| `listing_business_apps-analytics-user_listing_leap` | LBA Analytics | SRP ranking leaps/changes per user | ~10K |
| `listing_business_apps-analytics-district_performances` | LBA Analytics | Repost activity aggregated per district | 4,163 |
| `listing_business_apps-analytics-market_price_references` | LBA Analytics | Market price ranges by location and size | 5,948 |
| `listing_business_apps-developer_insight-project` | LBA DevInsight | Project master data reference | 2 |
| `listing_business_apps-developer_insight-in_house_recommendations` | LBA DevInsight | In-house vs all-agent recommendation metrics | 3,666 |
| `listing_business_apps-developer_insight-total_agents_summaries` | LBA DevInsight | Agent count summaries per project | 24 |
| `listing_business_apps-developer_insight-developer_leads_performance` | LBA DevInsight | Leads data by multiple dimensions with price ranges | 1 |
| `listing_business_apps-developer_insight-developer_project_total_listing_type` | LBA DevInsight | Daily listing type counts per project | 1,228 |
| `listing_business_apps-developer_insight-developer_project_inhouse_performances` | LBA DevInsight | Daily performance by in-house agents | 6 |
| `listing_business_apps-developer_insight-developer_project_all_agent_performances` | LBA DevInsight | Daily performance by all agents per project | 1,246 |
| `listing_business_apps-developer_insight-developer_city_performances` | LBA DevInsight | City-level performance metrics | 439 |
| `listing_business_apps-developer_insight-developer_district_performances` | LBA DevInsight | District-level performance metrics | 5,844 |

---

## Index Relationships ✅

### Properties ↔ Listings Flow

The application uses a **two-phase search pattern**:

```
┌─────────────────────┐     UUIDs      ┌─────────────────────┐
│  properties-r123-*  │ ────────────► │   listings-r123-*   │
│  (Filter + Sort)    │               │   (Enrichment)      │
└─────────────────────┘               └─────────────────────┘
         │                                      │
         ▼                                      ▼
   Minimal fields:                      Full document:
   - uuid, origin_id                    - All listing details
   - property_type, price_type          - Agent contacts
   - portal_id, location                - Organization info
   - agents.uuid, organizations.uuid    - Media, descriptions
   - gts, rank                          - Serialization data
```

**Phase 1 - Properties Index (Filtering & Ranking):**
- Executes search with all filters (location, price, bedrooms, etc.)
- Uses function scoring with `rank` and `gts` fields
- Returns only `uuid` and minimal fields via `FetchSourceContext`
- Fast because fetches minimal data

**Phase 2 - Listings Index (Enrichment):**
- Takes UUIDs from properties search
- Calls `GetByUUIDs()` to fetch full documents
- Provides complete data for serialization
- Maintains original search order

> **Source**: Verified from `internal/service/repository/property/service_property_search.go`

---

## Common Enum Reference

### Portal ID (`portal_id`)
| Value | Name | Brand | Country |
|-------|------|-------|---------|
| 0 | NinetyNineID | 99.co | Indonesia |
| 1 | Rumah123 | rumah123.com | Indonesia |
| 2 | IProperty | iProperty SG | Singapore |
| 3 | NinetyNineERP | 99.co | Indonesia |

### Property Status (`status`)
| Value | Name | Description |
|-------|------|-------------|
| 0 | Pending | Listing awaiting approval |
| 1 | Active | Listing is live and visible |
| 2 | Incomplete | Listing has missing required fields |
| 3 | Inactive | Listing manually deactivated |
| 4 | SoldRented | Property has been sold or rented |
| 5 | Review | Listing under review by moderators |

### Price Type (`price_type.value`)
| Value | Name | Description |
|-------|------|-------------|
| 0 | Sale | Property for sale |
| 1 | Rent | Property for rent |

### Property Type (`property_type.value`) - R123
| Value | Name (EN) | Name (ID) |
|-------|-----------|-----------|
| 0 | House | Rumah |
| 1 | Apartment | Apartemen |
| 2 | Ruko (Shophouse) | Ruko |
| 3 | Villa | Villa |
| 4 | Commercial Space | Ruang Usaha |
| 5 | Land | Tanah |
| 6 | Kost (Boarding House) | Kost |
| 7 | Office Space | Kantor |
| 8 | Warehouse | Gudang |
| 9 | Hotel | Hotel |
| 10 | Kios (Kiosk) | Kios |
| 11 | Factory | Pabrik |
| 12 | Multi-Storey Building | Gedung Bertingkat |
| 13 | Kondotel | Kondotel |
| 14 | Store | Toko |
| 15 | Residential | Residential |
| 16 | Project (Primary) | Project |

### User Type (`type.value`)
| Value | Name | Description |
|-------|------|-------------|
| 0 | Regular | Regular user/consumer |
| 1 | Agent | Real estate agent |
| 2 | Developer | Property developer |
| 4 | Internal User | Internal staff |

### Organization Type (`type.value`)
| Value | Name | Description |
|-------|------|-------------|
| 0 | Agency | Real estate agency |
| 1 | Developer | Property developer company |

### Location Type (`location_type.value`)
| Value | Name | Description |
|-------|------|-------------|
| 0 | Regular | Generic location |
| 1 | POI | Point of Interest |
| 2 | Venue | Venue/Complex |
| 4 | Area | Area grouping |
| 5 | R123Legacy | Legacy R123 area |
| 6 | Country | Country level |
| 7 | Province | Province level |
| 8 | City | City level |
| 9 | District | District level |
| 10 | Estate | Housing estate |
| 11 | Street | Street level |
| 12 | Building | Building |
| 13 | PostalCode | Postal code |
| 14 | Village | Village (Kelurahan) |
| 15 | Block | Block |

---

## Documentation Files

- [business-context.md](./business-context.md) - Business context: features, agent workflows, monetization model
- [listings.md](./listings.md) - Listings index schema
- [properties.md](./properties.md) - Properties index schema
- [users.md](./users.md) - Users index schema
- [organizations.md](./organizations.md) - Organizations index schema
- [enquiries.md](./enquiries.md) - Enquiries index schema
- [suggestions.md](./suggestions.md) - Suggestions index schema
- [locations.md](./locations.md) - Locations index schema
- [user-activities.md](./user-activities.md) - User activities schema
- [user-seen-listings.md](./user-seen-listings.md) - User seen listings schema
- [homepage-advertisements.md](./homepage-advertisements.md) - Homepage ads schema
- [area-specialists.md](./area-specialists.md) - Area specialists schema
- [mail-lead.md](./mail-lead.md) - Mail lead (legacy) schema
- [adcredit-accounts.md](./adcredit-accounts.md) - AdCredit accounts schema
- [adcredit-balances.md](./adcredit-balances.md) - AdCredit balances schema
- [adcredit-transactions.md](./adcredit-transactions.md) - AdCredit transactions schema
- [adcredit-nudge-events.md](./adcredit-nudge-events.md) - AdCredit nudge events schema
- [adcredit-nudge-custom-user-groups.md](./adcredit-nudge-custom-user-groups.md) - AdCredit nudge custom user groups schema
- [adcredit-nudge-custom-user-members.md](./adcredit-nudge-custom-user-members.md) - AdCredit nudge custom user members schema
- [adcredit-gorp-migrations.md](./adcredit-gorp-migrations.md) - AdCredit GORP migrations (system)
- [lba-analytics-srp-ranks.md](./lba-analytics-srp-ranks.md) - LBA SRP ranking data
- [lba-analytics-listing-performances.md](./lba-analytics-listing-performances.md) - LBA daily listing performance metrics
- [lba-analytics-user-best-repost-listings.md](./lba-analytics-user-best-repost-listings.md) - LBA best repost listings per user
- [lba-analytics-user-listing-recommendation.md](./lba-analytics-user-listing-recommendation.md) - LBA listing recommendations per user
- [lba-analytics-user-listing-leap.md](./lba-analytics-user-listing-leap.md) - LBA SRP ranking leaps per user
- [lba-analytics-district-performances.md](./lba-analytics-district-performances.md) - LBA district repost performance
- [lba-analytics-market-price-references.md](./lba-analytics-market-price-references.md) - LBA market price references
- [lba-devinsight-project.md](./lba-devinsight-project.md) - LBA project master data
- [lba-devinsight-in-house-recommendations.md](./lba-devinsight-in-house-recommendations.md) - LBA in-house recommendation metrics
- [lba-devinsight-total-agents-summaries.md](./lba-devinsight-total-agents-summaries.md) - LBA agent count summaries
- [lba-devinsight-developer-leads-performance.md](./lba-devinsight-developer-leads-performance.md) - LBA developer leads performance
- [lba-devinsight-developer-project-total-listing-type.md](./lba-devinsight-developer-project-total-listing-type.md) - LBA project listing type counts
- [lba-devinsight-developer-project-inhouse-performances.md](./lba-devinsight-developer-project-inhouse-performances.md) - LBA in-house agent performance
- [lba-devinsight-developer-project-all-agent-performances.md](./lba-devinsight-developer-project-all-agent-performances.md) - LBA all-agent performance
- [lba-devinsight-developer-city-performances.md](./lba-devinsight-developer-city-performances.md) - LBA city-level performance
- [lba-devinsight-developer-district-performances.md](./lba-devinsight-developer-district-performances.md) - LBA district-level performance

---

## Query Tips

1. **Active listings only**: Filter by `status: 1`
2. **Sale properties**: Filter by `price_type.value: 0`
3. **Rent properties**: Filter by `price_type.value: 1`
4. **Houses only**: Filter by `property_type.value: 0`
5. **Apartments only**: Filter by `property_type.value: 1`
6. **Rumah123 portal**: Filter by `portal_id: 1`
7. **iProperty portal**: Filter by `portal_id: 2`
8. **Agents only**: Filter by `type.value: 1`
9. **Location hierarchy**: Use `location.cities`, `location.districts`, `location.provinces`
10. **Price range**: Use `price.offer` for exact price, `price.range` for range queries

---

## Additional Enum Reference (from PHP API)

> These enums are from the `rumah123-new-api` PHP codebase. Some use string values while others use integers.

### Property Type Code (Short Code) ✅
| Code | Type | Indonesian |
|------|------|------------|
| `ho` | House | Rumah |
| `ap` | Apartment | Apartemen |
| `la` | Land | Tanah |
| `sh` | Shop House | Ruko |
| `cs` | Commercial Space | Ruang Usaha |
| `fa` | Factory | Pabrik |
| `wa` | Warehouse | Gudang |
| `of` | Office | Kantor |
| `vl` | Villa | Villa |
| `ks` | Kost | Kost |
| `ht` | Hotel | Hotel |

### Certificate Type (String) ✅
| Value | Name | Description |
|-------|------|-------------|
| `shm` | SHM | Sertifikat Hak Milik (Freehold) |
| `hgb` | HGB | Hak Guna Bangunan (Building Rights) |
| `hp` | HP | Hak Pakai (Usage Rights) |
| `hs` | HS | Hak Sewa (Lease Rights) |
| `other` | Lainnya | PPJB, Girik, Adat, etc. |
| `` (empty) | None | No certificate |

### Furniture Condition (String) ✅
| Value | Display |
|-------|---------|
| `furnished` | Furnished |
| `semi furnished` | Semi Furnished |
| `unfurnished` | Unfurnished |

### Property Condition (String) ✅
| Value | Indonesian |
|-------|------------|
| `new` | Baru |
| `very good` | Bagus Sekali |
| `good` | Bagus |
| `need renovation` | Butuh Renovasi |
| `renovated` | Sudah Renovasi |

### Facing Direction (`face`) ✅
| Value | Direction | Indonesian |
|-------|-----------|------------|
| 1 | East | Timur |
| 2 | Southeast | Tenggara |
| 3 | South | Selatan |
| 4 | Southwest | Barat Daya |
| 5 | West | Barat |
| 6 | Northwest | Barat Laut |
| 7 | North | Utara |
| 8 | Northeast | Timur Laut |

### Water Source ✅
| Value | Type | Indonesian |
|-------|------|------------|
| 1 | PAM/PDAM | PAM atau PDAM |
| 2 | Pump | Sumur Pompa |
| 3 | Drill | Sumur Bor |
| 4 | Infiltration | Sumur Resapan |
| 5 | Excavation | Sumur Galian |

### Building Material ✅
| Value | Type | Indonesian |
|-------|------|------------|
| 1 | Concrete Bricks | Batako |
| 2 | Concrete | Beton |
| 3 | Red Bricks | Bata Merah |
| 4 | Hebel Bricks | Bata Hebel |

### Floor Material ✅
| Value | Type | Indonesian |
|-------|------|------------|
| 1 | Granite | Granit |
| 2 | Ceramic | Keramik |
| 3 | Marble | Marmer |
| 4 | Tile | Ubin |
| 5 | Vinyl | Vinyl |

### Property Style ✅
| Value | Style | Indonesian |
|-------|-------|------------|
| 1 | Minimalist | Minimalis atau Sederhana |
| 2 | Modern | Modern |
| 3 | Minimalist Modern | Minimalis Modern |
| 4 | Modern Glass House | Modern Glass House |
| 5 | Scandinavian | Scandinavian |
| 6 | Industrial | Industrial |
| 7 | Contemporary | Kontemporer |
| 8 | American Classic | American Classic |
| 9 | Townhouse | Townhouse |
| 10 | Pavilion | Paviliun |

### Property Location Type ✅
| Value | Type | Indonesian |
|-------|------|------------|
| 1 | Housing/Complex | Perumahan/Komplek |
| 2 | Alley | Masuk Gang |
| 3 | Roadside | Samping Jalan |
| 4 | Country | Pedesaan |

### Views ✅
| Value | View Type | Indonesian |
|-------|-----------|------------|
| 1 | Urban | Perkotaan |
| 2 | Country | Pedesaan |
| 3 | Mountains | Pegunungan |
| 4 | Beach | Pantai |
| 5 | City Park | Taman Kota |
| 6 | Residential Areas | Pemukiman Warga |

### Road Width ✅
| Value | Width | Indonesian |
|-------|-------|------------|
| 1 | 1 Car | Seukuran 1 Mobil |
| 2 | 2 Cars | Seukuran 2 Mobil |
| 3 | 3 Cars | Seukuran 3 Mobil |
| 4 | 4 Cars | Seukuran 4 Mobil |

### IMB (Building Permit) ✅
| Value | Status | Indonesian |
|-------|--------|------------|
| `exists` | Has IMB | Ada |
| `not-exists` | No IMB | Belum Ada |

### Price Unit ✅
| Value | Unit | Display |
|-------|------|---------|
| `total` | Total Price | Total |
| `squaremeter` | Per m² | /m² |
| `are` | Per are | /are |
| `hectare` | Per hectare | /hectare |

### Rental Period ✅
| Value | Period |
|-------|--------|
| `daily` | Daily |
| `monthly` | Monthly |
| `yearly` | Yearly |

### Channel (Sale/Rent) ✅
| Value | Type |
|-------|------|
| `s` | Sale |
| `r` | Rent |

### Depth Product (Listing Tier) ✅
| Value | Tier | Display |
|-------|------|---------|
| 0 | Regular | regular |
| 1 | Featured | feature |
| 2/4 | Premier | premier |

### Button Label (Enquiry Source) ✅
| Value | Button |
|-------|--------|
| 1 | Phone |
| 2 | Email |
| 3 | WhatsApp |
| 4 | Crosspost |
| 5 | Microsite Agency |
| 6 | Post Inquiry |
| 7 | Area Specialist |
| 8 | Cobroke |
| 9 | PDP POI Location |
| 10 | UDP POI Location |

### Page Label (Enquiry Page Source) ✅
| Value | Page |
|-------|------|
| 1 | SRP (Search Results Page) |
| 2 | LDP (Listing Detail Page) |
| 3 | NSRP (New Search Results Page) |
| 4 | PDP (Property Detail Page) |
| 5 | Agent Page |
| 6 | Crosspost SRP |
| 7 | Crosspost LDP |
| 8 | Developer Page |
| 9 | FB Lead Gen |
| 10 | Consumer Dashboard |

### Facility (In-House & Residential) ✅
| Value | Facility | Indonesian |
|-------|----------|------------|
| `ac` | Air Conditioning | Ac |
| `park` | Park/Garden | Taman |
| `phone_line` | Phone Line | Jalur Telepon |
| `pool` | Swimming Pool | Kolam Renang |
| `security` | Security | Keamanan |
| `mosque` | Mosque | Masjid |
| `jogging_track` | Jogging Track | Jogging Track |
| `cctv` | CCTV | CCTV |
| `carport` | Carport | Carport |

### Electricity (Wattage) ✅
Common values: 450, 900, 1300, 2200, 3300, 3500, 4400, 5500, 6600, 7600, 7700, 8000, 9500, 10000, 10600, 11000, 12700, 13200, 13300, 13900, 16500, 17600, 19000, 22000, 23000, 24000, 30500, 33000, 38100, 41500, 47500, 53000, 61000, 66000, 76000, 82500, 85000, 95000, `others` (Lainnya)

---

## Additional Enum Reference (from Go core-services)

### Currency Type ✅
| Value | Currency |
|-------|----------|
| 360 | IDR (Indonesian Rupiah) |
| 702 | SGD (Singapore Dollar) |
| 840 | USD (US Dollar) |

### Contact Type ✅
| Value | Type | Description |
|-------|------|-------------|
| 1 | Email | Email address |
| 2 | PhoneNumber | Phone number |
| 3 | WhatsApp | WhatsApp number |
| 4 | Address | Physical address |
| 5 | Website | Website URL |
| 6 | FacebookUID | Facebook User ID |
| 7 | GoogleUID | Google User ID |
| 8 | FCM Token | Firebase Cloud Messaging Token |
| 9 | APN Token | Apple Push Notification Token |

### Listing Type ✅
| Value | Type | Description |
|-------|------|-------------|
| 0 | Secondary | Resale/secondary market listing |
| 1 | Primary | New development/primary market |
| 47 | Undefined | Type not determined |

### Bathroom Type ✅
| Value | Type | Indonesian |
|-------|------|------------|
| 1 | Inside | Dalam |
| 2 | Outside | Luar |

### Bed Type ✅
| Value | Type |
|-------|------|
| 1 | King Bed |
| 2 | Queen Bed |
| 3 | Twin Bed |
| 4 | Double Bed |
| 5 | Single Bed |

### Occupancy Type ✅
| Value | Type | Indonesian |
|-------|------|------------|
| 1 | Private Room | Private Room |
| 2 | Whole Villa | Seluruh Vila |
| 3 | Shared Room | Kamar Bersama |

### Hotel Room Type ✅
| Value | Type |
|-------|------|
| 1 | Standard |
| 2 | Superior |
| 3 | Deluxe |
| 4 | Twin |
| 5 | Single |
| 6 | Double |
| 7 | Family |
| 8 | Junior Suite |
| 9 | Suite |
| 10 | Presidential Suite |
| 11 | Connecting |
| 12 | Disabled |
| 13 | Smoking |

### Home Appliance ✅
| Value | Key | Description |
|-------|-----|-------------|
| 1 | sink | Sink |
| 2 | refrigrator | Refrigerator |
| 3 | washing_machine | Washing Machine |
| 4 | kitchen | Kitchen |
| 5 | stove | Stove |
| 6 | water_heater | Water Heater |
| 7 | ac | Air Conditioning |
| 8 | cctv | CCTV |
| 9 | wifi | WiFi |

### Regulation (Kost/Boarding) ✅
| Value | Key | Indonesian |
|-------|-----|------------|
| 1 | entry_for_oppose_sex | Lawan jenis tidak boleh masuk |
| 2 | access_24hour | Akses 24 Jam |
| 3 | no_smoking_area | Tidak ada Tempat Merokok |
| 4 | guest_staying | Tamu menginap |
| 5 | pet_friendly | Tempat yang ramah terhadap hewan |

### Lead Status ✅
| Value | Status | Description |
|-------|--------|-------------|
| 1 | unread | New/unread enquiry |
| 2 | read | Enquiry has been read |
| 3 | contacted | Agent has contacted consumer |
| 4 | survey | Site survey scheduled |
| 5 | cancel | Enquiry cancelled |
| 6 | success | Deal successful |

### Leads Category ✅
| Value | Category | Description |
|-------|----------|-------------|
| listing | Listing | Enquiry about a listing |
| agent | Agent | Direct enquiry to agent |
| project | Project | Enquiry about a project |
| developer | Developer | Direct enquiry to developer |

### Payment Method ✅
| Value | Method | Indonesian |
|-------|--------|------------|
| 1 | Cash | Cash Keras |
| 2 | Mortgage | KPR |
| 3 | Cash Installment | Cicilan Bertahap |

### Size Unit ✅
| Value | Unit | Display |
|-------|------|---------|
| squaremeter | Square Meter | m² |
| are | Are | are (100 sqm) |
| hectare | Hectare | hectare (10,000 sqm) |

### District Status ✅
| Value | Status |
|-------|--------|
| Approved | District is approved |
| Offline | District is offline |
| Online | District is online |
| Rejected | District is rejected |

### Listing Status (Customer Dashboard) ✅
| Value | Status |
|-------|--------|
| Online | Listing is live |
| Sold | Property sold |
| Dead | Listing dead/inactive |
| Pending | Awaiting approval |
| Unsold | Marked as unsold |
| Offline | Taken offline |
| Rejected | Listing rejected |
| Deleted | Listing deleted |

---

## Common Query Patterns

### Active Listings Base Query
Always start with these filters for listings:
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "1" }},
        { "term": { "instance_info.is_removed": false }}
      ]
    }
  }
}
```

### Active Agents Base Query
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

### Date Range Pattern
```json
{
  "range": {
    "time.created": {
      "gte": "2025-01-01",
      "lte": "2025-01-31"
    }
  }
}
```

### Relative Date Pattern
```json
{
  "range": {
    "time.created": {
      "gte": "now-30d"
    }
  }
}
```

### Price Range Pattern (Sale)
```json
{
  "range": {
    "price.sale_price.offer": {
      "gte": 500000000,
      "lte": 1000000000
    }
  }
}
```

### Aggregation Pattern
```json
{
  "size": 0,
  "query": { "match_all": {} },
  "aggs": {
    "group_by_field": {
      "terms": { "field": "field_name", "size": 20 }
    }
  }
}
```

---

## Example Natural Language to Query Mapping

| Natural Language | Index | Key Filters |
|-----------------|-------|-------------|
| "Top 5 agents with most listings in January 2025" | `listings-r123-*` | `status=1`, `time.created` range, agg by `agents.uuid` |
| "WhatsApp enquiries this month" | `enquiries` | `button_source=3`, `time.created>=now/M` |
| "Houses for sale under 1 billion in Jakarta" | `listings-r123-*` | `status=1`, `property_type.value=0`, `price_type.value=0`, `price.sale_price.offer<=1000000000`, location match |
| "Agent response time analysis" | `enquiries` | `duration_until_contacted` exists, agg avg by agent |
| "Most viewed listings last 7 days" | `user-activities` | `activity_type=0`, `time.created>=now-7d`, agg by `listing_uuid` |

---

## Query Tips

1. **Use `filter` instead of `must`** for exact matches - it's faster (cacheable)
2. **Always exclude deleted records** with `instance_info.is_removed: false`
3. **Use `.keyword` suffix** for exact string matches on text fields
4. **For date fields**: listings/enquiries use `time.created`, mail_lead uses `created_date.keyword`
5. **Property types**: Use numeric values (0=house, 1=apartment, etc.) not strings
6. **Status**: Use string `"1"` for active (stored as text in some indices)

---

## Skipped Indices

The following indices are not documented (system/internal use):
- `.siem-signals-*` - Security signals
- `.kibana*` - Kibana internal
- `.apm-*` - APM internal
- `.lists-*` - Lists internal
- `.security-7` - Security internal
- `logs-index_pattern_placeholder` - System placeholder
- `metrics-index_pattern_placeholder` - System placeholder
