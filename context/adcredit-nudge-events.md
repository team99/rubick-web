# AdCredit Nudge Events Index Schema

> **Index**: `adcredit-prod_adcredit_nudge_events`
>
> **Purpose**: Tracks nudge notifications sent to users about their ad credit status — low balance warnings, expiry reminders, abandoned cart nudges
>
> **Primary Use Cases**: Nudge delivery tracking, notification analytics, WhatsApp/push notification audit
>
> **Document Count**: ~140.8K
>
> **Source**: PostgreSQL table `adcredit.nudge_events` (synced via CDC/ETL)
>
> **Source Repo**: `rumah123-adcredit`

---

## Key Fields for Querying

| Field | Type | Description | Common Filters |
|-------|------|-------------|----------------|
| `user_id` | text/keyword | Target user ID | Per-user history |
| `status` | text/keyword | Delivery status | `DELIVERED`, `SKIP`, `PENDING` |
| `trigger_type_id` | text/keyword | What triggered the nudge | `7` (aggregate booster+kredit threshold) |
| `nudge_rule_id` | text/keyword | Rule that generated this nudge | |

---

## Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Event ID (auto-increment bigserial) |
| `nudge_rule_id` | text/keyword | ID of the nudge rule that triggered this event |
| `user_id` | text/keyword | Target user's R123 ID |
| `nudge_rule_data` | text/keyword | JSON string of the complete rule configuration (see structure below) |
| `delivery_date` | text/keyword | Scheduled delivery timestamp |
| `device_ids` | text/keyword | Target device IDs as JSON (often `"{}"`) |
| `status` | text/keyword | Delivery status (see enum) |
| `trigger_type_id` | text/keyword | What condition triggered this nudge (see enum) |
| `reference_id` | text/keyword | Reference UUID (nullable — e.g. balance or cart ID) |
| `reference_type_id` | text/keyword | Type of reference (see enum) |
| `message_data` | text/keyword | JSON string of the actual message sent (WhatsApp/push content) |
| `created_at` | text/keyword | Event creation timestamp |
| `created_by` | text/keyword | Creator ID (`"0"` = system) |
| `updated_at` | text/keyword | Last update timestamp |
| `updated_by` | text/keyword | Updater ID (nullable) |
| `deleted_at` | text/keyword | Soft-delete timestamp (nullable) |
| `deleted_by` | text/keyword | Deleter ID (nullable) |

---

## Enum Reference

### Nudge Event Status (`status`) ✅
| Value | Count | Description |
|-------|-------|-------------|
| `SKIP` | ~68.4K | Nudge was skipped (conditions not met or user blacklisted) |
| `DELIVERED` | ~41.7K | Nudge was successfully sent |
| `PENDING` | ~30.7K | Nudge is queued for delivery |

### Trigger Type ID (`trigger_type_id`) ✅
| Value | Name | Description |
|-------|------|-------------|
| `0` | Unknown | Unknown trigger |
| `1` | Abandon Cart | User left items in cart without purchasing |
| `2` | Last Transaction | Nudge based on time since last transaction |
| `3` | Remaining Aggregate Booster Quota | Booster (PL/FL) balance below threshold |
| `4` | Remaining Quota Booster Bucket Expiry | Booster balance bucket nearing expiry |
| `5` | Remaining Aggregate Kredit Quota | Kredit balance below threshold |
| `6` | Remaining Quota Kredit Bucket Expiry | Kredit balance bucket nearing expiry |
| `7` | Aggregate Booster+Kredit Threshold | Combined booster and kredit balance threshold |
| `8` | Booster+Kredit Expiry | Combined booster and kredit bucket expiry |

> **Source**: `pkg/constant/trigger_type_id.go` and `pkg/reference/nudge.go`
>
> **Production data**: All 140.8K events use trigger type `7`

### Reference Type ID (`reference_type_id`) ✅
| Value | Name | Description |
|-------|------|-------------|
| `0` | Unknown | Unknown reference type |
| `1` | Cart | Shopping cart reference |
| `2` | Transaction | Transaction reference |
| `3` | Order | Order reference |
| `4` | Paid Kredit Balance | Paid kredit balance reference |
| `5` | PL30D Balance | Premier Listing 30-day balance |
| `6` | FL30D Balance | Featured Listing 30-day balance |

> **Source**: `pkg/reference/nudge.go`
>
> **Production data**: All events use reference type `0`

---

## Nested JSON Structures

### `nudge_rule_data` (stored as JSON string)

Contains the complete rule configuration:
```json
{
  "id": 2,
  "NudgeID": 2,
  "TriggerType": 7,
  "RuleData": {
    "aggregate_booster_kredit_threshold": {
      "pl30_balance": 2,
      "fl30_balance": 2,
      "kredit_balance": 100
    }
  },
  "ChannelData": {
    "expected_delivery_time_from": "2023-09-05T00:00:00Z",
    "expected_delivery_time_to": "2023-09-05T23:59:00Z",
    "whatsapp_data": { "body": "...", "body_variable": {...} },
    "push_notification_data": { "title": "...", "body": "..." },
    "expected_deliver_type": 1,
    "whatsapp_flag": true
  },
  "PauseDuration": "168h0m0s"
}
```

### `message_data` (stored as JSON string)

Contains the actual message sent:
```json
{
  "whatsapp_data": {
    "Method": "SendMessage",
    "SendTo": "628xxxxxxxxxx",
    "Message": "Kuota Kredit Anda Akan Segera Habis...",
    "MessageType": "text",
    "DataEncoding": "text",
    "Format": "json"
  }
}
```

---

## Query Examples

### Nudge events for a specific user
```json
{
  "query": {
    "term": { "user_id.keyword": "1644984" }
  },
  "sort": [{ "created_at.keyword": "desc" }]
}
```

### Delivered nudges count by trigger type
```json
{
  "size": 0,
  "query": { "term": { "status.keyword": "DELIVERED" }},
  "aggs": {
    "by_trigger": {
      "terms": { "field": "trigger_type_id.keyword", "size": 20 }
    }
  }
}
```

### Nudge delivery status breakdown
```json
{
  "size": 0,
  "aggs": {
    "by_status": {
      "terms": { "field": "status.keyword", "size": 10 }
    }
  }
}
```
