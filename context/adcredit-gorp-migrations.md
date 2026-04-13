# AdCredit GORP Migrations Index Schema

> **Index**: `adcredit-prod_adcredit_gorp_migrations`
>
> **Purpose**: Database migration tracking — records which SQL migrations have been applied to the adcredit PostgreSQL database
>
> **Primary Use Cases**: Migration status auditing (not typically queried for business purposes)
>
> **Document Count**: 10
>
> **Source**: PostgreSQL table `adcredit.gorp_migrations` (managed by Goose migration tool, synced via CDC/ETL)
>
> **Source Repo**: `rumah123-adcredit`

---

## Fields ✅

| Field | Type | Description |
|-------|------|-------------|
| `id` | text/keyword | Migration filename (e.g. `"20231002110926-init.sql"`) |
| `applied_at` | text/keyword | Timestamp when the migration was applied |

---

## Current Data (All 10 Migrations)

| id | applied_at | Description |
|----|-----------|-------------|
| `20231002110926-init.sql` | 2023-11-06 | Initial schema (accounts, balances, transactions) |
| `20231017205109-add_purchase_type_value.sql` | 2023-11-06 | Added `BONUS` purchase type |
| `20231101092531-alter_table_transfer_add_balance_from_column.sql` | 2023-11-06 | Added `balance_from` column to transactions |
| `20231102090315-alter_table_transfer_add_constraint_balance_from.sql` | 2023-11-06 | Added FK constraint on `balance_from` |
| `20231108205452-alter_purchase_type_add_corporate_balance_transfer.sql` | 2023-11-06 | Added `CORPORATE_BALANCE_TRANSFER` type |
| `20240422144408-alter_table_balance_external_identifier.sql` | — | Added `external_identifier` and `external_additional_attributes` to balances |
| `20240902113905-create_nudge_events_table.sql` | — | Created nudge events table |
| `20240911145353-alter_nudge_rules_events_table_delivery_date_type.sql` | — | Changed `delivery_date` from TIME to TIMESTAMP |
| `20241106101053-create_nudge_custom_user_group.sql` | — | Created nudge custom user groups and members tables |
| `20241121022757-alter_reference_id_nullable_in_nudge_events.sql` | — | Made `reference_id` nullable in nudge events |

> **Note**: This index is a system/infrastructure artifact. It is not used for business queries but is included in documentation for completeness.
