# Business Context — Rumah123 & iProperty

> **Purpose**: This document explains Rumah123's business features, agent workflows, and monetization model so that Claude Desktop can produce grounded, actionable analysis when querying Elasticsearch data. Read this before interpreting any index data.

---

## 1. Platform Overview

**Rumah123** (rumah123.com) is Indonesia's leading property listing platform, connecting property seekers with real estate agents and developers. It operates two portals:

| Portal | `portal_id` | Country | Brand |
|--------|-------------|---------|-------|
| Rumah123 | `1` | Indonesia | rumah123.com |
| iProperty | `2` | Singapore | iProperty SG |

**Key stakeholders:**
- **Consumers** — search for properties, submit enquiries (phone, WhatsApp, email)
- **Agents** — list properties, purchase credits, repost listings, monitor performance
- **Developers** — manage projects with in-house agents, track project-level metrics

---

## 2. Agent Lifecycle

The agent lifecycle is the core loop that generates most data in Elasticsearch:

```
Onboard → List Property → Boost/Feature → Repost ("Sundul") → Monitor Performance → Renew Credits
   ↑                                                                                       |
   └───────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Onboard** — Agent creates an account (`users` index, `type.value: 1`), joins an agency (`organizations`)
2. **List Property** — Agent creates a listing (`listings-r123-*`), which also appears in the `properties-r123-*` search index
3. **Boost/Feature** — Agent spends credits to upgrade a listing to Featured or Premier tier, increasing SRP visibility
4. **Repost** — Agent "sunduls" (bumps) the listing to the top of its tier within a district
5. **Monitor** — Agent checks impressions, views, enquiries, phone calls, WhatsApp clicks (`listing_performances`)
6. **Renew Credits** — Agent purchases more Kredit or receives Booster quotas to keep the cycle going

---

## 3. Listing Visibility Tiers

Every listing has a **depth** (tier) that determines its visibility on the Search Results Page (SRP):

| Tier | `depth` value | Cost | Duration | SRP Placement |
|------|---------------|------|----------|---------------|
| **Basic** (Regular) | `0` | Free | Default | Bottom section of SRP |
| **Featured** | `1` | Kredit or FL30D booster | 7 days per activation | Middle section, above Basic |
| **Premier** | `2` or `4` | Kredit or PL30D booster | 7 days per activation | Top section, highest visibility |

**Key behaviors:**
- Upgrading a listing from Basic → Featured or Featured → Premier costs ad credits
- Each activation lasts **7 days**, after which the listing falls back to its previous tier unless re-activated
- Auto-extend can be configured to automatically re-activate when the period ends
- The `depth` field in properties/listings indices reflects the current tier

**In ES data:** Look at `depth` in `properties-r123-*` or transaction descriptions containing "Premier" / "Featured" in `adcredit-prod_adcredit_transactions`.

---

## 4. SRP Ranking System

Listings are displayed on SRP pages ordered by a combination of tier and recency. The ranking uses **buckets** (priority groups):

### Ranking Bucket Order (highest → lowest)
1. **GTS** (Guaranteed Top Spot) — contractual placement, always first
2. **Premier + Active Repost** — Premier-tier listings recently reposted
3. **Premier** — Premier-tier listings (not recently reposted)
4. **Featured + Active Repost** — Featured-tier listings recently reposted
5. **Featured** — Featured-tier listings
6. **Basic + Active Repost** — Basic-tier listings recently reposted
7. **Basic** — Standard listings (free)

### How it works
- SRP shows **20 listings per page**
- Rankings are computed **per district** — a listing's rank differs by district
- The `rank` field in `properties-r123-*` is used in function scoring during search
- The `gts` nested field handles GTS placements by location

### Leap
A **leap** measures the rank change between two snapshots (e.g., daily). Tracked in `lba-analytics-user-listing-leap`:
- Positive `diff` = listing moved up (improved)
- Negative `diff` = listing dropped
- Agents use this to understand the impact of reposting or tier upgrades

---

## 5. Repost System ("Sundul")

**Sundul** (Indonesian slang for "headbutt" / bump up) is the action of reposting a listing to move it to the top of its tier within a district.

### How it works
- A repost does **not** change the listing's tier — it bumps the listing to the top **within** its current tier bucket
- A Premier listing reposted will appear above other Premier listings that haven't been reposted recently

### Repost types
| Type | Description |
|------|-------------|
| **Manual repost** | Agent triggers a single repost on demand |
| **Auto-repost group** | Scheduled repost — agent defines a rotation of listings with dates/times |

### Cost
- Regular (Basic) repost: **1 credit** per repost
- Cost varies by tier and property type for Featured/Premier reposts
- The vast majority of transactions (~15.9M out of ~16.1M) are repost activations

### Insufficient credit handling
When an agent has insufficient credits for a scheduled repost:
- System sends a **WhatsApp message** and/or **push notification** (nudge)
- The repost is skipped until credits are available

**In ES data:** Repost activity appears in `adcredit-prod_adcredit_transactions` (description: `"repost activation"`). District-level repost aggregates are in `lba-analytics-district-performances`.

---

## 6. Ad Credit System

Agents pay for listing upgrades and reposts using ad credits. There are two credit types:

### Credit Types

| Type | Name | What it buys |
|------|------|-------------|
| **Kredit** | Flexible currency | Any product — Featured, Premier, Repost, Top Property, Smart Video |
| **PL30D** | Premier Listing 30-Day Booster | Premier activations only (product-specific quota) |
| **FL30D** | Featured Listing 30-Day Booster | Featured activations only (product-specific quota) |

### Balance Structure
Each credit purchase creates a **balance bucket** with:
- `start_amount` — initial credit amount
- `current_amount` — remaining credits
- `expired_at` — expiry date (default: **365 days** from top-up)
- `grace_period` — **7 days** after expiry before credits are forfeited
- Status: `ACTIVE` (has remaining credits) or `EMPTY` (consumed/expired)

Credits are deducted using **FIFO** — oldest-expiring bucket is consumed first.

### Purchase Types (top-up sources)

| Top-Up Type | Description | Volume |
|-------------|-------------|--------|
| `BONUS` | Free credits from membership renewal/promotions | ~46.5K |
| `INDIVIDUAL_PURCHASE` | Agent self-purchased | ~22.3K |
| `BALANCE_TRANSFER` | Received from another account | ~21K |
| `SELF_PURCHASE` | Self-service purchase | ~3.3K |
| `BULK_PURCHASE` | Bulk upload by admin/sales | ~2.6K |
| `CORPORATE_BALANCE_TRANSFER` | Transfer from corporate account | ~1.5K |
| `CORPORATE_PURCHASE` | Purchased by corporate entity | ~582 |

### Purchasable Products

| Product | `product_id` | Description |
|---------|-------------|-------------|
| Premier Listing | `0` | 7-day Premier activation |
| Featured Listing | `1` | 7-day Featured activation |
| Repost | `2` | Bump listing within its tier |
| Top Property | `3` | Premium placement product |
| Smart Video | `4` | Video listing enhancement |
| Membership Upgrade | `5` | Upgrade membership tier |
| Membership Renewal | `6` | Renew existing membership |

### Key configuration
- Credit price: **2,000 IDR per coin**
- Max balance adjustment: **500,000 coins**

**In ES data:** Accounts in `adcredit-prod_adcredit_accounts`, balance buckets in `adcredit-prod_adcredit_balances`, transaction ledger in `adcredit-prod_adcredit_transactions`.

---

## 7. Nudge System

The nudge system sends proactive notifications to agents about their credit status, encouraging timely top-ups.

### Channels
- **WhatsApp** — primary channel for nudge delivery
- **Push Notifications** — mobile app notifications

### Trigger Types

| `trigger_type` | Trigger | Business Meaning |
|----------------|---------|-----------------|
| `1` | Abandon Cart | Agent left items in cart without completing purchase |
| `2` | Last Transaction | Agent has been inactive (no transactions for a period) |
| `3` | Low Booster Balance | PL30D or FL30D balance below threshold |
| `4` | Booster Bucket Expiry | Booster balance nearing expiry date |
| `5` | Low Kredit Balance | Kredit balance below threshold |
| `6` | Kredit Bucket Expiry | Kredit bucket nearing expiry date |
| `7` | Combined Low Balance | Booster + Kredit combined balance below threshold |
| `8` | Combined Expiry | Booster + Kredit combined bucket nearing expiry |

### Thresholds (from production rules)
- PL30D balance threshold: **2 credits**
- FL30D balance threshold: **2 credits**
- Kredit balance threshold: **100 credits**

### Anti-spam
- **Pause duration: 7 days** (168 hours) — an agent won't receive the same nudge type again within this window
- Event status: `DELIVERED` (sent), `SKIP` (suppressed), `PENDING` (queued)

### Blacklist
Users who opt out are added to `adcredit-prod_adcredit_nudge_custom_user_members` (group `1` = Blacklist, ~4.3K users). Blacklisted users never receive nudges.

**In ES data:** Nudge events in `adcredit-prod_adcredit_nudge_events`, blacklist in `adcredit-prod_adcredit_nudge_custom_user_members`.

---

## 8. Recommendation Engine

The platform provides personalized recommendations to help agents optimize their listings.

### Repost Recommendations
Index: `lba-analytics-user-best-repost-listings`
- Suggests which single listing each agent should repost for maximum impact
- Selection based on `impression_increase_percentage` — predicted impression gain from reposting

### Listing Recommendations
Index: `lba-analytics-user-listing-recommendation`
- Personalized listing recommendations grouped by type:

| Type | Recommendation Category |
|------|------------------------|
| `1` | Low impression listings (need visibility boost) |
| `2` | High view listings (performing well, capitalize on momentum) |
| `3` | Low price listings (competitively priced, likely to convert) |
| `6` | Biggest leap listings (trending upward in rank) |
| `7` | Best repost usage (most effective use of repost credits) |

Two format versions exist:
- **v1**: Flat list of listing IDs with types
- **v2**: Grouped by type with nested listing arrays

### Listing ID format
Format: `{property_type_code}s{ads_id}` — e.g., `hos39718509` = house for sale, ID 39718509.

**In ES data:** Per-user recommendations in `lba-analytics-user-listing-recommendation`, best repost picks in `lba-analytics-user-best-repost-listings`.

---

## 9. Developer Insight Dashboard

The Developer Insight module serves **property developers** (not regular agents), providing project-level analytics.

### What it tracks
- **Project performance**: views, impressions, enquiries across all agents for a project
- **In-house vs all agents**: compare in-house agent performance against the full agent pool
- **Listing type distribution**: daily counts of Online, Premier, Featured, and Regular listings per project
- **Geographic performance**: city-level and district-level metrics
- **Leads by dimension**: enquiries sliced by city, district, property type, and price range

### Price range buckets (for leads analysis)
11 buckets from `< 400M IDR` to `> 4B IDR`, each spanning 400M IDR.

### ES indices involved
| Index | What it contains |
|-------|-----------------|
| `developer_insight-project` | Project master data (project → location mapping) |
| `developer_insight-in_house_recommendations` | In-house vs all-agent recommendation metrics |
| `developer_insight-total_agents_summaries` | Agent count summaries per project |
| `developer_insight-developer_leads_performance` | Leads data by multiple dimensions with price ranges |
| `developer_insight-developer_project_total_listing_type` | Daily listing type counts per project |
| `developer_insight-developer_project_inhouse_performances` | Daily performance by in-house agents |
| `developer_insight-developer_project_all_agent_performances` | Daily performance by all agents |
| `developer_insight-developer_city_performances` | City-level performance metrics |
| `developer_insight-developer_district_performances` | District-level performance metrics |

---

## 10. Key Business Metrics

When analyzing data, these are the metrics that matter most to the business, mapped to available ES data:

### Agent Engagement
| Metric | How to measure | Index |
|--------|---------------|-------|
| Credit purchase frequency | Count `TOP_UP` transactions per agent over time | `adcredit_transactions` |
| Repost frequency | Count `repost activation` transactions per agent | `adcredit_transactions` |
| Active agents | Agents with transactions in last 30 days | `adcredit_transactions` |

### Listing Performance
| Metric | How to measure | Index |
|--------|---------------|-------|
| Impressions | `impressions` field, daily per listing | `listing_performances` |
| Views | `views` field | `listing_performances` |
| Enquiries | `enquiries` + `phones` + `whatsapps` | `listing_performances` |
| Conversion rate | Enquiries / Impressions | `listing_performances` |

### Monetization
| Metric | How to measure | Index |
|--------|---------------|-------|
| Credit spend rate | Sum of `DEDUCTION` transaction amounts per period | `adcredit_transactions` |
| Balance utilization | `start_amount - current_amount` / `start_amount` | `adcredit_balances` |
| Expiry waste | Balances where `status = EMPTY` and credits weren't fully consumed | `adcredit_balances` |
| Revenue by product | Group transactions by `product_id` | `adcredit_transactions` |

### Nudge Effectiveness
| Metric | How to measure | Index |
|--------|---------------|-------|
| Delivery rate | `DELIVERED` / total events | `adcredit_nudge_events` |
| Skip rate | `SKIP` / total events | `adcredit_nudge_events` |
| Opt-out rate | Blacklist members / total accounts | `nudge_custom_user_members` + `adcredit_accounts` |

### Market Coverage
| Metric | How to measure | Index |
|--------|---------------|-------|
| Listings per district | Count active listings grouped by district | `properties-r123-*` |
| Price reference coverage | Districts with market price data | `market_price_references` |
| Repost activity by district | `total_repost` per district per week | `district_performances` |

---

## 11. Glossary

| Term | Meaning |
|------|---------|
| **Sundul / Repost** | Bump a listing to the top of its tier within a district |
| **Kredit** | Flexible ad credit currency, can buy any product (1 coin = 2,000 IDR) |
| **Booster** | Product-specific credit quota (PL30D for Premier, FL30D for Featured) |
| **PL30D** | Premier Listing 30-Day — booster quota for Premier activations |
| **FL30D** | Featured Listing 30-Day — booster quota for Featured activations |
| **Depth** | Listing visibility tier: 0 = Basic, 1 = Featured, 2/4 = Premier |
| **GTS** | Guaranteed Top Spot — contractual premium placement at top of SRP |
| **Leap** | Rank change between two snapshots; positive = improved position |
| **Nudge** | Proactive notification (WhatsApp/push) about credit status |
| **SRP** | Search Results Page — where consumers browse listings |
| **LDP / PDP** | Listing/Property Detail Page — individual listing view |
| **FIFO** | First In, First Out — oldest-expiring credit bucket is consumed first |
| **Auto-repost** | Scheduled repost group that bumps listings on a rotation |
| **Top Property** | Premium product for extra listing visibility |
| **Smart Video** | Video enhancement product for listings |
| **Area Specialist** | Agent with expertise ranking in a specific district |
| **Cobroke** | Agent-to-agent referral/collaboration system |
| **Crosspost** | Publishing a listing across multiple portals |

---

> **Last updated**: 2026-02 | **Source**: Derived from Elasticsearch schema documentation and production data analysis
