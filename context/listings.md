# Listings Index Schema

> **Indices**: `listings-r123-*`, `listings-ipropsg`
>
> **Purpose**: **Data enrichment index** - full listing details for serialization
>
> **Primary Use Cases**: LDP (Listing Detail Page), listing cards, API responses

---

## How This Index Is Used ✅

The `listings` index is the **enrichment index** in the two-phase search pattern:

1. **Phase 1 (Properties Index)**: Filter/sort/rank, returns UUIDs
2. **Phase 2 (This Index)**: Fetch full documents by UUIDs for serialization

**Primary query method**: `GetByUUIDs(uuids []uuid.UUID)` - fetches complete documents

> **Source**: Verified from `pkg/repository/impl/elasticsearch/r123/listing_repository_impl.go`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `status` | keyword | Listing status (see enum below) | `status: 1` for active |
| `property_type.value` | keyword | Property type ID | `property_type.value: 0` for houses |
| `price_type.value` | keyword | Sale (0) or Rent (1) | `price_type.value: 0` for sale |
| `price.offer` | long | Price in local currency (IDR/SGD) | Range queries |
| `portal_id` | keyword | Portal identifier | `portal_id: 1` for R123 |
| `location.cities.name` | text | City name | Text search |
| `location.districts.name` | text | District name | Text search |

---

## Status Field ✅

**Field**: `status` (keyword, stored as string "1", "4", "5")

| Value | Name | Description | Count (R123) |
|-------|------|-------------|--------------|
| "1" | Active | Listing is live and searchable | ~2.18M |
| "4" | SoldRented | Property sold/rented, may still be visible | ~667K |
| "5" | Review | Under moderation review | ~7K |

> **Note**: Values 0 (Pending), 2 (Incomplete), 3 (Inactive) exist in code but not found in production listings index.

---

## Property Type ✅

**Field**: `property_type` (object)
- `property_type.value` - Integer ID
- `property_type.name` - Display name
- `property_type.label` - Optional label

| Value | Name (EN) | Name (ID) | Count (R123) |
|-------|-----------|-----------|--------------|
| 0 | House | Rumah | ~1.72M |
| 1 | Apartment | Apartemen | ~280K |
| 2 | Ruko (Shophouse) | Ruko | ~228K |
| 3 | Villa | Villa | ~44K |
| 4 | Commercial Space | Ruang Usaha | ~40K |
| 5 | Land | Tanah | ~319K |
| 6 | Kost (Boarding House) | Kost | ~33K |
| 7 | Office Space | Kantor | ~33K |
| 8 | Warehouse | Gudang | ~133K |
| 9 | Hotel | Hotel | ~5.7K |
| 11 | Factory | Pabrik | ~16K |
| 16 | Project (Primary) | Project | ~2.4K |

---

## Price Type ✅

**Field**: `price_type` (object)
- `price_type.value` - Integer ID (stored as string "0" or "1")
- `price_type.name` - "sale" or "rent"

| Value | Name | Description | Count (R123) |
|-------|------|-------------|--------------|
| "0" | Sale | Property for sale | ~2.27M |
| "1" | Rent | Property for rent | ~584K |

---

## Price Fields ✅

**Field**: `price` (object)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `price.offer` | long | Main price in local currency (IDR for R123, SGD for iProp) |
| `price.display` | text | Formatted price string for display |
| `price.currency_type.value` | keyword | Currency code |
| `price.unit_type.value` | keyword | Price unit (total, per sqm, etc.) |
| `price.range` | long_range | Price range for primary projects |
| `price.offer_per_meter` | long | Price per square meter (building) |
| `price.offer_land_per_meter` | long | Price per square meter (land) |
| `price.monthly_rent_price.offer` | long | Monthly rent price |
| `price.yearly_rent_price.offer` | long | Yearly rent price |
| `price.daily_rent_price.offer` | long | Daily rent price (hotels/villas) |

---

## Base Attributes ✅

**Field**: `base_attributes` (object) - Core property specifications

| Sub-field | Type | Description | Values |
|-----------|------|-------------|--------|
| `bedrooms` | short | Number of bedrooms | 0-99 |
| `bathrooms` | short | Number of bathrooms | 0-99 |
| `building_size` | float | Building area in sqm | |
| `land_size` | float | Land area in sqm | |
| `floors` | short | Number of floors/stories | |
| `carports` | short | Number of carports | |
| `garages` | short | Number of garages | |
| `listing_type` | long | 0=Secondary, 1=Primary | See below |
| `facing` | keyword | Building facing direction | See below |
| `conditions` | keyword | Property condition | See below |
| `furnishing` | keyword | Furnishing level | "Unfurnished", "Semi Furnished", "Furnished" |
| `certification.value` | keyword | Certificate type | See below |
| `electricity` | keyword | Electricity capacity | e.g., "2200" |

### Listing Type ✅
| Value | Name | Description |
|-------|------|-------------|
| 0 | Secondary | Resale/secondary market listing |
| 1 | Primary | New development/primary market |

### Facing Direction ✅
| Value | Direction |
|-------|-----------|
| 1 | East |
| 2 | Southeast |
| 3 | South |
| 4 | Southwest |
| 5 | West |
| 6 | Northwest |
| 7 | North |
| 8 | Northeast |

### Property Condition ✅
| Value | Name (ID) | Name (EN) |
|-------|-----------|-----------|
| "Baru" | Baru | New |
| "Bagus" | Bagus | Good |
| "Bagus Sekali" | Bagus Sekali | Very Good |
| "Butuh Renovasi" | Butuh Renovasi | Needs Renovation |
| "Sudah Renovasi" | Sudah Renovasi | Already Renovated |

### Certificate Type ✅
| Value | Name | Description |
|-------|------|-------------|
| 0 | SHM | Sertifikat Hak Milik (Freehold) |
| 1 | HGB | Hak Guna Bangunan (Building Rights) |
| 2 | HP | Hak Pakai (Right to Use) |
| 3 | HGU | Hak Guna Usaha (Business Use Rights) |
| 5 | AJB | Akta Jual Beli (Sale Deed) |
| 6 | PPJB | Perjanjian Pengikatan Jual Beli |
| 7 | Strata Title | Strata Title |
| 9 | Others | Lainnya |
| 10 | Hak Sewa | Leasehold |
| 11 | Adat | Customary |
| 12 | Girik | Girik (Traditional Land Certificate) |

---

## Location Fields ✅

**Field**: `location` (object) - Geographic hierarchy

| Sub-field | Type | Description |
|-----------|------|-------------|
| `location.countries` | object[] | Country info |
| `location.provinces` | object[] | Province/state info |
| `location.cities` | object[] | City info |
| `location.districts` | object[] | District/kecamatan info |
| `location.villages` | object[] | Village/kelurahan info |
| `location.estates` | object[] | Housing estate/perumahan |
| `location.streets` | object[] | Street info |
| `location.buildings` | object[] | Building/apartment name |
| `location.location_map_point` | geo_point | Lat/lon coordinates |
| `location.full_address` | text | Full address string |

Each location level has:
- `name` - Location name
- `uuid` - Unique identifier
- `origin_id` - Legacy ID
- `location_type.value` - Type ID (see overview)

---

## Agent Fields ✅

**Field**: `agents` (object[]) - Listing agents

| Sub-field | Type | Description |
|-----------|------|-------------|
| `agents.uuid` | keyword | Agent UUID |
| `agents.name` | text | Agent name |
| `agents.origin_id` | keyword | Legacy agent ID |
| `agents.contacts` | object[] | Contact info (phone, email, whatsapp) |
| `agents.type.value` | keyword | User type (1=Agent, 2=Developer) |
| `agents.subscription` | object | Subscription/membership info |
| `agents.property_counts` | object | Agent's listing statistics |
| `agents.medias` | object[] | Agent photos |
| `agents.attributes.is_verified` | boolean | Verified agent badge |
| `agents.attributes.is_homeowner` | boolean | Homeowner (non-agent) |

---

## Organization Fields ✅

**Field**: `organizations` (object) - Agency/developer info

| Sub-field | Type | Description |
|-----------|------|-------------|
| `organizations.uuid` | keyword | Organization UUID |
| `organizations.name` | text | Organization name |
| `organizations.type.value` | keyword | 0=Agency, 1=Developer |
| `organizations.attributes.nib` | keyword | Business registration number |
| `organizations.medias` | object[] | Logo images |

---

## Cobroke Fields ✅

**Field**: `cobroke` (object) - Co-brokerage settings

| Sub-field | Type | Description |
|-----------|------|-------------|
| `cobroke.status` | keyword | Cobroke status |
| `cobroke.type` | keyword | Cobroke type |
| `cobroke.total_subsidiary` | integer | Number of subsidiary listings |

### Cobroke Status ✅
| Value | Name | Description |
|-------|------|-------------|
| 0 | Undefined | Not set |
| 1 | Open | Open for co-brokerage |
| 3 | Closed | Closed for co-brokerage |

### Cobroke Type ✅
| Value | Name | Description |
|-------|------|-------------|
| 0 | Original | Original listing |
| 1 | Subsidiary | Co-broke copy |

---

## Special Flags ✅

**Field**: `special_flags` (object) - Feature flags

| Sub-field | Type | Description |
|-----------|------|-------------|
| `is_primary_project` | boolean | Primary/new development project |
| `is_cobroke` | boolean | Has cobroke enabled |
| `is_verified` | boolean | Verified listing |
| `is_owner` | boolean | Listed by property owner |
| `is_highlighted` | boolean | Premium highlighted listing |
| `is_have_video` | boolean | Has video content |
| `is_have_360` | boolean | Has 360° virtual tour |
| `is_have_brochure` | boolean | Has downloadable brochure |
| `is_have_promo` | boolean | Has active promotion |
| `is_price_drop` | boolean | Price recently reduced |
| `is_npl` | boolean | Non-Performing Loan property |
| `is_subunit` | boolean | Is a subunit of primary project |
| `is_fast_selling` | boolean | Fast-selling property |
| `is_under_njop` | boolean | Below government valuation |
| `is_no_down_payment` | boolean | No down payment required |

---

## Media Fields ✅

**Field**: `medias` (object[]) - Photos and videos

| Sub-field | Type | Description |
|-----------|------|-------------|
| `media_type_id` | keyword | Media type ID |
| `media_type_value` | keyword | Media type name |
| `info.url` | text | Image/video URL |
| `info.thumbnail_url` | text | Thumbnail URL |
| `info.order` | short | Display order |
| `info.uuid` | keyword | Media UUID |

### Media Type ✅
| Value | Name | Description |
|-------|------|-------------|
| 0 | Regular | Standard photo |
| 1 | Cover | Cover/main photo |
| 2 | Background | Background image |
| 3 | SitePlan | Site plan |
| 4 | Facility | Facility photo |
| 5 | Youtube | YouTube video |
| 6 | Brochure | Brochure PDF |
| 9 | VR360 | 360° photo |
| 10 | SmartVideo | Smart video |

---

## Time Fields ✅

**Field**: `time` (object in various locations)

| Sub-field | Type | Description |
|-----------|------|-------------|
| `time.created` | date | Creation timestamp |
| `time.updated` | date | Last update timestamp |
| `time.posted` | date | Publication timestamp |
| `time.removed` | date | Removal timestamp |

---

## Facilities (V3) ✅

**Field**: `base_attributes.facilities_v3` (object) - Detailed facilities

| Sub-field | Type | Description |
|-----------|------|-------------|
| `all` | long[] | All facility IDs |
| `residentialFacilities` | long[] | Residential-specific facilities |
| `roomFacilities` | long[] | Room-specific facilities |
| `regulations` | long[] | Property regulations |

### All Facility IDs (1-78) ✅
| ID | Key | Description |
|----|-----|-------------|
| 1 | wifi | WiFi |
| 2 | workspace | Workspace |
| 3 | refrigerator | Refrigerator |
| 4 | microwave | Microwave |
| 5 | breakfast | Breakfast |
| 6 | smart_tv | Smart TV |
| 7 | washing_machine | Washing Machine |
| 8 | kitchen_set | Kitchen Set |
| 9 | stove | Stove |
| 10 | cctv | CCTV |
| 11 | ac | Air Conditioning |
| 12 | cable_tv | Cable TV |
| 13 | pool | Swimming Pool |
| 14 | bbq_area | BBQ Area |
| 15 | gymnastics | Gym |
| 16 | water_heater | Water Heater |
| 17 | toiletries | Toiletries |
| 18 | extra_bed | Extra Bed |
| 19 | hair_dryer | Hair Dryer |
| 20 | wastafel | Wastafel |
| 21 | telephone | Telephone |
| 22 | clothes_line | Clothes Line |
| 23 | park | Park |
| 24 | cleaning_staff | Cleaning Staff |
| 25 | security_staff | Security Staff |
| 26 | laundromat | Laundromat |
| 27 | water_dispensers | Water Dispensers |
| 28 | clean_water | Clean Water |
| 29 | mattress | Mattress |
| 30 | mirror | Mirror |
| 31 | wardrobe | Wardrobe |
| 32 | table | Table |
| 33 | television | Television |
| 34 | squatting_toilet | Squatting Toilet |
| 35 | sitting_toilet | Sitting Toilet |
| 36 | shower | Shower |
| 37 | early_checkin | Early Check-in |
| 38 | all_time_checkin | All Time Check-in |
| 39 | late_checkout | Late Checkout |
| 40 | porter | Porter |
| 41 | bar | Bar |
| 42 | cafe | Cafe |
| 43 | elevator | Elevator |
| 44 | receptionist | Receptionist |
| 45 | child_daycare | Child Daycare |
| 46 | airport_transport | Airport Transport |
| 47 | car_rent | Car Rent |
| 48 | valet_parking | Valet Parking |
| 49 | disability_care | Disability Care |
| 50 | security_patrol | Security Patrol |
| 51 | jogging_track | Jogging Track |
| 52 | kids_area | Kids Area |
| 53 | hot_tub_outdoor_pool | Hot Tub/Outdoor Pool |
| 54 | kids_pool | Kids Pool |
| 55 | jacuzzi | Jacuzzi |
| 56 | bar_access | Bar Access |
| 57 | pool_access | Pool Access |
| 58 | minibar | Minibar |
| 59 | place_of_worship | Place of Worship |
| 60 | hospital | Hospital |
| 61 | shopping_centre | Shopping Centre |
| 62 | school | School |
| 63 | airport | Airport |
| 64 | public_transport | Public Transport |
| 65 | traditional_market | Traditional Market |
| 66 | pillow | Pillow |
| 67 | roll_pillow | Roll Pillow |
| 68 | dressing_table | Dressing Table |
| 69 | window | Window |
| 70 | chair | Chair |
| 71 | kitchen | Kitchen |
| 72 | shared_bathroom | Shared Bathroom |
| 73 | living_room | Living Room |
| 74 | parking_area | Parking Area |
| 75 | parking_access | Parking Access |
| 76 | phoneline | Phone Line |
| 77 | laundry_shop | Laundry Shop |
| 78 | cafe_resto | Cafe/Restaurant |

> **Source**: Verified from `pkg/reference/facility_v3.go`

---

## Additional Attributes (from PHP API) ✅

These attributes may appear in listings with string-based enum values:

> **Source**: All values verified from PHP `apps/plugin/Listing/models/enums/*.php`

### Price Unit (`price.unit_type`) ✅
| Value | Display | Description |
|-------|---------|-------------|
| `total` | Total | Full property price |
| `squaremeter` | /m² | Price per square meter |
| `are` | /are | Price per are (100 sqm) |
| `hectare` | /hectare | Price per hectare |

### Rental Period ✅
| Value | Period |
|-------|--------|
| `daily` | Daily rental |
| `monthly` | Monthly rental |
| `yearly` | Yearly rental |

### Channel Code ✅
| Value | Type |
|-------|------|
| `s` | Sale |
| `r` | Rent |

### Depth Product (Listing Tier) ✅
| Value | Tier | Description |
|-------|------|-------------|
| 0 | Regular | Standard listing |
| 1 | Featured | Featured/promoted listing |
| 2/4 | Premier | Premium listing |

### Building Material ✅
| Value | Material | Indonesian |
|-------|----------|------------|
| 1 | Concrete Bricks | Batako |
| 2 | Concrete | Beton |
| 3 | Red Bricks | Bata Merah |
| 4 | Hebel Bricks | Bata Hebel |

### Floor Material ✅
| Value | Material | Indonesian |
|-------|----------|------------|
| 1 | Granite | Granit |
| 2 | Ceramic | Keramik |
| 3 | Marble | Marmer |
| 4 | Tile | Ubin |
| 5 | Vinyl | Vinyl |

### Water Source ✅
| Value | Source | Indonesian |
|-------|--------|------------|
| 1 | PAM/PDAM | PAM atau PDAM |
| 2 | Pump | Sumur Pompa |
| 3 | Drill | Sumur Bor |
| 4 | Infiltration | Sumur Resapan |
| 5 | Excavation | Sumur Galian |

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
| Value | View | Indonesian |
|-------|------|------------|
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

---

## Query Examples

### Active houses for sale in Jakarta
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "1" }},
        { "term": { "property_type.value": "0" }},
        { "term": { "price_type.value": "0" }},
        { "match": { "location.cities.name": "Jakarta" }}
      ]
    }
  }
}
```

### Top agents by listing count
```json
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "1" }},
        { "range": { "time.created": { "gte": "2025-01-01", "lte": "2025-01-31" }}}
      ]
    }
  },
  "aggs": {
    "by_agent": {
      "terms": { "field": "agents.uuid", "size": 10 }
    }
  }
}
```
