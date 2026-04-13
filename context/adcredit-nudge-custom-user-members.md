# AdCredit Nudge Custom User Members Index Schema

> **Index**: `adcredit-prod_adcredit_nudge_custom_user_members`
>
> **Purpose**: Membership records linking users to custom nudge groups — currently tracks blacklisted users who should not receive nudge notifications
>
> **Primary Use Cases**: Nudge blacklist lookups, user group membership management
>
> **Document Count**: ~4.3K
>
> **Source**: PostgreSQL table `adcredit.nudge_custom_user_members` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-adcredit`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `user_id` | text/keyword | User's R123 ID | Check if user is blacklisted |
| `nudge_custom_user_group_id` | text/keyword | Group ID | `"1"` (Blacklist) |

---

## Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Member record ID (auto-increment bigserial) |
| `nudge_custom_user_group_id` | text/keyword | Group ID (FK to `adcredit_nudge_custom_user_groups.id`) |
| `user_id` | text/keyword | User's R123 ID |
| `created_at` | text/keyword | Membership creation timestamp |
| `created_by` | text/keyword | Creator ID (`"0"` = system) |
| `updated_at` | text/keyword | Last update timestamp |
| `updated_by` | text/keyword | Updater ID |
| `deleted_at` | text/keyword | Soft-delete timestamp (nullable) |
| `deleted_by` | text/keyword | Deleter ID (nullable) |

---

## Current Usage

All ~4.3K members belong to group `1` (Blacklist). These are users who should be excluded from receiving nudge notifications (WhatsApp messages, push notifications) about their ad credit status.

---

## Query Examples

### Check if a user is blacklisted
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "user_id.keyword": "1965196" }},
        { "term": { "nudge_custom_user_group_id.keyword": "1" }}
      ]
    }
  }
}
```

### All blacklisted users
```json
{
  "query": {
    "term": { "nudge_custom_user_group_id.keyword": "1" }
  },
  "size": 100
}
```

### Count members per group
```json
{
  "size": 0,
  "aggs": {
    "by_group": {
      "terms": { "field": "nudge_custom_user_group_id.keyword", "size": 10 }
    }
  }
}
```
