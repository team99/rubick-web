# AdCredit Accounts Index Schema

> **Index**: `adcredit-prod_adcredit_accounts`
>
> **Purpose**: Ad credit wallet accounts for agents/users in the Rumah123 platform
>
> **Primary Use Cases**: Account lookups, credit balance management, agent billing
>
> **Document Count**: ~34K
>
> **Source**: PostgreSQL table `adcredit.accounts` (synced via CDC/ETL — no ES mappings in codebase)
>
> **Source Repo**: `rumah123-adcredit`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `customer_reference_id` | text/keyword | Agent/user ID in Rumah123 | Exact match via `.keyword` |
| `system_id` | text/keyword | Platform identifier | `RUMAH123` |
| `status` | text/keyword | Account status | `ACTIVE` |

---

## Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Account UUID (primary key) |
| `system_id` | text/keyword | Platform identifier (see enum below) |
| `customer_reference_id` | text/keyword | External user/agent ID in R123 (maps to `users.origin_id`) |
| `status` | text/keyword | Account status (see enum below) |
| `created_date` | text/keyword | Account creation timestamp (format: `YYYY-MM-DD HH:mm:ss.SSSSSS+ZZ`) |
| `modified_date` | text/keyword | Last modification timestamp |
| `deleted_date` | text/keyword | Soft-delete timestamp (null if not deleted) |

---

## Enum Reference

### System ID (`system_id`) ✅
| Value | Description |
|-------|-------------|
| `RUMAH123` | Rumah123 platform |
| `99ID` | 99.co Indonesia (defined in code, not seen in production data) |

> **Source**: `pkg/constant/system.go`

### Account Status (`status`) ✅
| Value | Description |
|-------|-------------|
| `ACTIVE` | Account is active and can transact |
| `INACTIVE` | Account is deactivated |
| `SUSPENDED` | Account is suspended |

> **Source**: `pkg/constant/account_status.go`
>
> **Production data**: All 34K accounts are `ACTIVE`

---

## Relationships

```
┌─────────────────────────────┐
│  adcredit_accounts          │
│  (id = account UUID)        │
│  (customer_reference_id     │
│   = user origin_id in R123) │
└──────────┬──────────────────┘
           │ 1:N
           ▼
┌─────────────────────────────┐
│  adcredit_balances          │
│  (account_id → accounts.id) │
└──────────┬──────────────────┘
           │ 1:N
           ▼
┌─────────────────────────────┐
│  adcredit_transactions      │
│  (balance_id → balances.id) │
└─────────────────────────────┘
```

---

## Query Examples

### Find account by agent R123 ID
```json
{
  "query": {
    "term": { "customer_reference_id.keyword": "1862709" }
  }
}
```

### All active accounts
```json
{
  "query": {
    "term": { "status.keyword": "ACTIVE" }
  }
}
```
