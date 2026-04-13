# AdCredit Transactions Index Schema

> **Index**: `adcredit-prod_adcredit_transactions`
>
> **Purpose**: Complete ledger of all ad credit transactions — top-ups, deductions, transfers, and adjustments
>
> **Primary Use Cases**: Transaction history, credit usage analytics, listing activation tracking, reversal auditing
>
> **Document Count**: ~16.1M
>
> **Source**: PostgreSQL table `adcredit.transactions` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-adcredit`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `transaction_type` | text/keyword | Type of transaction | `DEDUCTION`, `TOP_UP`, etc. |
| `balance_id` | text/keyword | Associated balance UUID | Link to balances |
| `transaction_date` | text/keyword | When transaction occurred | Date range queries |
| `tags.listing_id` | text/keyword | Listing affected | Listing-level analysis |
| `tags.bucket_type` | text/keyword | Listing tier | `Regular`, `Premier`, `Featured` |

---

## Core Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Transaction ID (auto-increment bigserial) |
| `transaction_date` | text/keyword | When the transaction occurred |
| `transaction_type` | text/keyword | Type of transaction (see enum) |
| `balance_id` | text/keyword | Balance UUID this transaction affects (FK to `adcredit_balances.id`) |
| `amount` | text/keyword | Transaction amount (positive for credits, negative for debits, e.g. `"250"`, `"-1"`, `"-50"`) |
| `description` | text/keyword | Human-readable description (see common values) |
| `transfer_from_account_id` | text/keyword | Source account UUID (for transfers only, null otherwise) |
| `transfer_to_account_id` | text/keyword | Destination account UUID (for transfers only, null otherwise) |
| `balance_from` | text/keyword | Source balance UUID (for TRANSFER_IN only, null otherwise — enforced by DB constraint) |
| `created_date` | text/keyword | Record creation timestamp |
| `modified_date` | text/keyword | Last modification timestamp |

---

## Tags Object (Contextual Metadata) ✅

The `tags` field is a flexible JSON object whose structure varies by `transaction_type`. Below are the known sub-fields:

### Tags — Deduction (Repost Activation)

| Field | Type | Description |
|-------|------|-------------|
| `tags.listing_id` | text/keyword | Listing ID being reposted (e.g. `"hos16653507"`, `"las3349000"`) |
| `tags.bucket_type` | text/keyword | Listing tier: `Regular`, `Premier`, or `Featured` |
| `tags.by_schedule` | boolean | `true` if triggered by auto-repost schedule |
| `tags.product_activation_name` | text/keyword | Product name (e.g. `"Aktivasi Auto Repost"`) |

### Tags — Deduction (Premier/Featured Activation)

| Field | Type | Description |
|-------|------|-------------|
| `tags.listing_id` | text/keyword | Listing ID being boosted |
| `tags.depth_type` | long | Listing depth: `1` = Featured, `2` = Premier |
| `tags.activation_source` | long | Activation source: `2` = observed in production |
| `tags.product_activation_name` | text/keyword | e.g. `"Aktivasi Premier Listing 7 Hari"` |

### Tags — Deduction (Reversal)

| Field | Type | Description |
|-------|------|-------------|
| `tags.reversed` | boolean | `true` if this deduction was reversed |
| `tags.reversed_at` | date | When reversal occurred |
| `tags.reversed_by` | long | User ID who performed the reversal |
| `tags.reversal_reason` | text/keyword | Reason for reversal |
| `tags.reversal_transaction_id` | long | ID of the reversal transaction |
| `tags.attachments` | text/keyword | Array of screenshot/proof URLs |
| `tags.deduction_hash` | text/keyword | Unique hash for deduction idempotency |
| `tags.listing_owner_id` | long | Owner of the listing |
| `tags.order_id` | long | Related order ID |

### Tags — Top-Up

| Field | Type | Description |
|-------|------|-------------|
| `tags.discount_type` | long | Type of discount applied |
| `tags.discount_value` | long | Discount value |
| `tags.order_status` | long | Order status (e.g. `3` = completed) |
| `tags.total_price` | long | Total price in IDR |
| `tags.invoice_id` | text/keyword | Invoice reference |
| `tags.product_id` | long | Product ID |
| `tags.user_id` | text/keyword | User who initiated top-up |
| `tags.row_id` | long | Row ID for bulk uploads |
| `tags.file_upload_id` | long | Bulk upload file ID |
| `tags.primary_for_developer` | boolean | Whether primary for developer account |

### Tags — Transfer

| Field | Type | Description |
|-------|------|-------------|
| `tags.transfer_hash` | text/keyword | Unique hash for transfer idempotency (format: `transfer_{from}_{to}_{date}_{amount}`) |

### Tags — Validity Adjustment

| Field | Type | Description |
|-------|------|-------------|
| `tags.old_expired_date` | date | Previous expiry date |
| `tags.new_expired_date` | date | New expiry date |
| `tags.old_grace_period_date` | date | Previous grace period end |
| `tags.new_grace_period_date` | date | New grace period end |

### Tags — Activation (Nested)

| Field | Type | Description |
|-------|------|-------------|
| `tags.activation.listing_id` | text/keyword | Listing being activated |
| `tags.activation.product_type` | long | Product type ID (see ProductID enum) |
| `tags.activated_by` | text/keyword | Who activated |
| `tags.multi_deduction_reversal` | boolean | Multi-deduction reversal flag |
| `tags.reversed_transaction_id` | long | Original transaction being reversed |

---

## Enum Reference

### Transaction Type (`transaction_type`) ✅
| Value | Count | Description |
|-------|-------|-------------|
| `DEDUCTION` | ~16M | Credit consumed (repost, activation, etc.) |
| `TOP_UP` | ~54.4K | Credits added to balance |
| `TRANSFER_IN` | ~4.1K | Credits received from another account |
| `TRANSFER_OUT` | ~4.1K | Credits sent to another account |
| `VALIDITY_ADJUSTMENT` | ~800 | Balance expiry date modified |
| `BALANCE_ADJUSTMENT` | — | Balance amount adjusted (defined in code, not seen in data) |

> **Source**: `pkg/constant/transaction_type.go`

### Bucket Type (`tags.bucket_type`) ✅
| Value | Count | Description |
|-------|-------|-------------|
| `Regular` | ~14M | Standard repost (costs 1 credit) |
| `Premier` | ~1.55M | Premier listing activation |
| `Featured` | ~165K | Featured listing activation |

### Depth Type (`tags.depth_type`) ✅
| Value | Count | Description |
|-------|-------|-------------|
| `1` | ~53.5K | Featured Listing |
| `2` | ~118K | Premier Listing |

### Product ID (`tags.activation.product_type`) ✅
| Value | Count | Description |
|-------|-------|-------------|
| `0` | ~2.4K | Premier Listing |
| `1` | — | Featured Listing |
| `2` | 23 | Repost |
| `3` | 72 | Top Property |
| `4` | — | Smart Video |
| `5` | — | Membership Upgrade |
| `6` | 771 | Membership Renewal |
| `7` | 23 | Internal Product |
| `9` | 20 | (Unknown) |
| `11` | 10 | (Unknown) |

> **Source**: `pkg/constant/product.go`

### Common Descriptions ✅
| Description | Count | Transaction Type |
|-------------|-------|-----------------|
| `repost activation` | ~15.9M | DEDUCTION |
| *(empty)* | ~195K | Various (mostly TOP_UP) |
| `Free Kredit Membership Renewal` | ~17.7K | TOP_UP |
| `Top up via admin bulk upload` | ~11.4K | TOP_UP |
| `unfreeze listing` | ~2.5K | DEDUCTION |
| `Aktivasi Crosspost` | ~1.9K | DEDUCTION |
| `Free Kredit Membership` | ~1.4K | TOP_UP |
| `Free Kredit Cart` | 421 | TOP_UP |
| `req <sales_name>` | Various | TRANSFER_IN/OUT, VALIDITY_ADJUSTMENT |

---

## Query Examples

### Deductions for a specific listing
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "transaction_type.keyword": "DEDUCTION" }},
        { "term": { "tags.listing_id.keyword": "hos16653507" }}
      ]
    }
  }
}
```

### Top-ups in a date range
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "transaction_type.keyword": "TOP_UP" }},
        { "range": { "transaction_date.keyword": { "gte": "2025-01-01", "lte": "2025-01-31" }}}
      ]
    }
  }
}
```

### Premier listing activations
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "transaction_type.keyword": "DEDUCTION" }},
        { "term": { "tags.bucket_type.keyword": "Premier" }}
      ]
    }
  }
}
```

### Reversed transactions
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "tags.reversed": true }}
      ]
    }
  }
}
```

### Transaction volume by type
```json
{
  "size": 0,
  "aggs": {
    "by_type": {
      "terms": { "field": "transaction_type.keyword", "size": 10 }
    }
  }
}
```

### Deductions breakdown by bucket type
```json
{
  "size": 0,
  "query": { "term": { "transaction_type.keyword": "DEDUCTION" }},
  "aggs": {
    "by_bucket": {
      "terms": { "field": "tags.bucket_type.keyword", "size": 10 }
    }
  }
}
```
