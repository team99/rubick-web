# AdCredit Balances Index Schema

> **Index**: `adcredit-prod_adcredit_balances`
>
> **Purpose**: Individual credit balance buckets for ad credit accounts — each top-up creates a new balance with its own expiry
>
> **Primary Use Cases**: Balance lookups, expiry tracking, top-up history, credit consumption analysis
>
> **Document Count**: ~97.7K
>
> **Source**: PostgreSQL table `adcredit.balances` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-adcredit`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `account_id` | text/keyword | Parent account UUID | Link to accounts |
| `status` | text/keyword | Balance status | `ACTIVE`, `EMPTY` |
| `balance_type` | text/keyword | Type of balance | `COIN` |
| `topup_type` | text/keyword | How balance was acquired | `BONUS`, `INDIVIDUAL_PURCHASE`, etc. |
| `expired_date` | text/keyword | When balance expires | Range queries |

---

## Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Balance UUID (primary key) |
| `account_id` | text/keyword | Parent account UUID (FK to `adcredit_accounts.id`) |
| `balance_type` | text/keyword | Type of balance unit (see enum) |
| `topup_type` | text/keyword | How this balance was created (see enum) |
| `start_amount` | text/keyword | Initial credit amount (stored as string, e.g. `"200"`) |
| `start_date` | text/keyword | When the balance became active |
| `expired_date` | text/keyword | When the balance expires |
| `grace_period_date` | text/keyword | End of grace period after expiry (typically +7 days) |
| `status` | text/keyword | Current balance status (see enum) |
| `created_date` | text/keyword | Record creation timestamp |
| `modified_date` | text/keyword | Last modification timestamp |
| `external_identifier` | text/keyword | External reference identifier (nullable) |
| `external_additional_attributes` | text/keyword | Additional external attributes as JSON (nullable) |

---

## Enum Reference

### Balance Type (`balance_type`) ✅
| Value | Description |
|-------|-------------|
| `COIN` | Credit coins (the unit used for ad credit transactions) |
| `CURRENCY` | Currency-based balance (defined in code, not seen in production) |

> **Source**: `pkg/constant/balance_type.go`
>
> **Production data**: All 97.7K balances are `COIN`

### Top-Up Type (`topup_type`) ✅
| Value | Count | Description |
|-------|-------|-------------|
| `BONUS` | ~46.5K | Free credits given as bonus (e.g. membership renewal, promotions) |
| `INDIVIDUAL_PURCHASE` | ~22.3K | Agent purchased credits individually |
| `BALANCE_TRANSFER` | ~21K | Credits received via transfer from another account |
| `SELF_PURCHASE` | ~3.3K | Self-service purchase by the account holder |
| `BULK_PURCHASE` | ~2.6K | Credits purchased in bulk (by admin/sales) |
| `CORPORATE_BALANCE_TRANSFER` | ~1.5K | Transfer from a corporate/agency account |
| `CORPORATE_PURCHASE` | ~582 | Purchase made by corporate entity |
| `BANK_TRANSFER` | — | Payment via bank transfer (defined in code, not seen in data) |

> **Source**: `pkg/constant/purchase_type.go`

### Balance Status (`status`) ✅
| Value | Count | Description |
|-------|-------|-------------|
| `EMPTY` | ~82.3K | Balance fully consumed or expired |
| `ACTIVE` | ~15.3K | Balance has remaining credits |
| `INACTIVE` | — | Balance deactivated (defined in code, not seen in data) |

> **Source**: `pkg/constant/balance_status.go`

---

## Configuration Notes

From the application config:
- **Default expiry**: 365 days from top-up (`ADCREDIT_EXPIRY_DAYS`)
- **Grace period**: 7 days after expiry (`ADCREDIT_GRACE_PERIOD_DAYS`)
- **New expiry duration**: 6 months (`ADCREDIT_NEW_EXPIRY_DURATION`)
- **Credit price**: 2000 IDR per coin (`ADCREDIT_PRICE`)
- **Max balance adjustment**: 500,000 coins (`ADCREDIT_MAX_DELTA_UPDATE_BALANCE`)

---

## Query Examples

### Active balances for an account
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "account_id.keyword": "account-uuid-here" }},
        { "term": { "status.keyword": "ACTIVE" }}
      ]
    }
  },
  "sort": [{ "expired_date.keyword": "asc" }]
}
```

### Balances by top-up type
```json
{
  "size": 0,
  "aggs": {
    "by_topup_type": {
      "terms": { "field": "topup_type.keyword", "size": 20 }
    }
  }
}
```

### Balances expiring soon
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status.keyword": "ACTIVE" }},
        { "range": { "expired_date.keyword": { "lte": "2026-03-01" }}}
      ]
    }
  }
}
```
