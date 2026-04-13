# AdCredit Nudge Custom User Groups Index Schema

> **Index**: `adcredit-prod_adcredit_nudge_custom_user_groups`
>
> **Purpose**: Custom user groups for nudge targeting — currently used for blacklisting users from nudge notifications
>
> **Primary Use Cases**: Nudge blacklist management, custom audience groups
>
> **Document Count**: 1
>
> **Source**: PostgreSQL table `adcredit.nudge_custom_user_groups` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-adcredit`

---

## Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Group ID (auto-increment bigserial) |
| `description` | text/keyword | Group description/name |
| `status` | text/keyword | Group status (see enum) |
| `created_at` | text/keyword | Creation timestamp |
| `created_by` | text/keyword | Creator ID (`"0"` = system) |
| `updated_at` | text/keyword | Last update timestamp |
| `updated_by` | text/keyword | Updater ID |
| `deleted_at` | text/keyword | Soft-delete timestamp (nullable) |
| `deleted_by` | text/keyword | Deleter ID (nullable) |

---

## Enum Reference

### Group Status (`status`) ✅
| Value | Description |
|-------|-------------|
| `0` | Inactive |
| `1` | Active |

> **Source**: `pkg/constant/nudge_custom_user_group_status.go`

---

## Current Data

Only 1 group exists in production:

| id | description | status |
|----|-------------|--------|
| `1` | `Blacklist` | `1` (Active) |

This group is used to blacklist users from receiving nudge notifications. Members are tracked in the `adcredit_nudge_custom_user_members` index.

---

## Relationships

```
┌───────────────────────────────────┐
│  adcredit_nudge_custom_user_groups│
│  (id = group ID)                  │
└──────────┬────────────────────────┘
           │ 1:N
           ▼
┌───────────────────────────────────┐
│  adcredit_nudge_custom_user_members│
│  (nudge_custom_user_group_id      │
│   → groups.id)                    │
└───────────────────────────────────┘
```

---

## Query Examples

### Get all active groups
```json
{
  "query": {
    "term": { "status.keyword": "1" }
  }
}
```
