# Conversation History & Compaction — Design Spec

**Date:** 2026-04-22
**Status:** Approved (design), pending implementation plan
**Owner:** Erwin

---

## 1. Problem

Rubick-web today is a stateless chat surface over Elasticsearch. Every reload loses context. Users need:

1. **Follow-up conversations** — ask something, come back later, continue where they left off (Claude Desktop / Web behavior).
2. **History UI** — a sidebar listing prior conversations so they can be revisited.
3. **Separate context windows per conversation** — no cross-talk between threads.

Secondary requirements established during brainstorming:

- **Multi-user** with hard per-user data isolation.
- **Google OAuth only** (no shared password).
- **Invite-only.** `erwin@99.co` is bootstrapped as the first admin; admins can invite others.
- **Storage:** Postgres (Neon as recommended host).
- **v1 surface:** sidebar list + resume + auto-title only. No rename / delete / search / share / fork in v1.
- **Long conversations must survive context-window limits.** A conversation is never "full"; it compacts.

---

## 2. Non-goals (v1)

- Rename, delete, search, share, fork, pin, archive.
- Cross-conversation user profile / dossier.
- Client-side message persistence or offline support.
- Multi-device sync conflict resolution (single source of truth is the server).
- Team / org / workspace abstractions.
- Native provider compaction APIs (Anthropic `compact_20260112`, OpenAI `/v1/responses/compact`, etc.) — see §7.

---

## 3. Architecture overview

Three owned responsibilities:

| Layer | Owns |
|---|---|
| **Browser** | UI state, input buffer, current `conversationId` in URL |
| **Server (Next.js route handlers)** | Auth, message persistence, compaction, LLM streaming, title generation |
| **Postgres** | Users, invites, conversations, messages (source of truth) |

The browser never mutates or stores message history. It sends `{ conversationId, newUserMessage, model }` and receives a stream. On reload, it fetches the conversation from the server.

---

## 4. Data model

Three tables. No `conversation_turns`, no `conversation_state`, no `client_dossier` — those exist in maya because maya has webhook idempotency, concurrent writers, and per-client business memory. Rubick has none of that.

### 4.1 `users`

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,           -- nanoid
  email        TEXT NOT NULL UNIQUE,
  name         TEXT,
  image_url    TEXT,
  role         TEXT NOT NULL CHECK (role IN ('admin','member')),
  status       TEXT NOT NULL CHECK (status IN ('invited','active','disabled')),
  invited_by   TEXT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);
```

Bootstrap row (migration, idempotent): `erwin@99.co`, role `admin`, status `active`, `invited_by = NULL`.

### 4.2 `invites`

```sql
CREATE TABLE invites (
  email        TEXT PRIMARY KEY,
  invited_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at  TIMESTAMPTZ
);
```

Used by the Auth.js `signIn` callback. Non-admin sign-ins are rejected unless an unconsumed `invites` row exists.

### 4.3 `conversations`

```sql
CREATE TABLE conversations (
  id         TEXT PRIMARY KEY,             -- nanoid
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New chat',
  model      TEXT NOT NULL,                -- model id at creation time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conv_user_updated ON conversations(user_id, updated_at DESC);
```

`updated_at` is bumped whenever a message is appended. Sidebar queries order by it.

### 4.4 `messages`

```sql
CREATE TABLE messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool','compaction')),
  content         TEXT,                    -- text; for role='tool' holds serialized result
  tool_calls      JSONB,                   -- only when role='assistant' and the step issued tool calls
  tool_call_id    TEXT,                    -- only when role='tool'
  tool_name       TEXT,                    -- only when role='tool'
  metadata        JSONB,                   -- usage, model, prompt_version, timings
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK ((role = 'tool') = (tool_call_id IS NOT NULL AND tool_name IS NOT NULL)),
  CHECK (tool_calls IS NULL OR role = 'assistant'),
  CHECK (pg_column_size(tool_calls) < 64 * 1024),
  CHECK (pg_column_size(metadata)   < 16 * 1024)
);
CREATE INDEX idx_msg_conv ON messages(conversation_id, id ASC);
CREATE UNIQUE INDEX idx_msg_tool_result
  ON messages(conversation_id, tool_call_id)
  WHERE tool_call_id IS NOT NULL;
```

**Why four roles and no separate "compactions" table.** Compaction is modeled as a message with `role='compaction'` inserted inline. This means:

- Loading the "effective" context is one SQL query (`SELECT ... ORDER BY id ASC` starting at the most recent compaction).
- No FK juggling between `messages` and a parallel `conversation_state.summary` column.
- The summary participates in the same insert ordering as user/assistant/tool messages — no race to "which is newer, the summary or the new turn?"

### 4.5 Compaction row format

`content` is **sectioned markdown** with a fixed heading skeleton:

```markdown
## Conversation summary

### Current task
One-paragraph description of what the user is currently trying to learn.

### Data focus
- Indices: `enquiries`, `listings-r123-*`
- Schemas loaded: enquiries, users
- Active filters: status="1", instance_info.is_removed=false, month=2026-04

### Established findings
- Enquiry volume for April 2026 is 12,348 (+4% MoM).
- Top 3 agents by enquiries: agent_1123, agent_0045, agent_0988.

### Decisions made
- Excluding iProperty data for this thread (user scoped to Rumah123 only).
- Prices displayed in abbreviated IDR (e.g. "1.5B IDR").

### Open items
- User wants weekly breakdown next.
```

`metadata` on a compaction row:

```json
{
  "summarized_through_message_id": 482,
  "pre_tokens": 148211,
  "post_tokens": 3104,
  "summarizer_model": "claude-haiku-4-5",
  "prompt_version": "compaction_prompt_v1",
  "ms": 812
}
```

**Why markdown and not JSON.** Maya's L4 uses JSON because maya extracts typed fields programmatically (L5 dossier reads `stablePreferences`). Rubick has exactly one consumer of the summary: the next LLM prompt. There is no typed schema in the ES-analyst domain worth encoding (each conversation has a different index focus), no downstream extractor, no analytics that reads summary fields. Single-consumer prose is the right shape. Decision rule recorded for future features: *if something other than the next LLM prompt starts reading the summary, revisit.*

**Chained, with bounded drift.** Each compaction is generated from `(previous_compaction_content || messages_after_it)` — the prior summary *is* fed into the next summarizer as `[PRIOR SUMMARY]`. That is technically chaining, and paraphrase drift compounds across cycles. The mitigating factors we accept:

1. The fixed-heading skeleton (`## Conversation summary` / `### Current task` / …) constrains drift to bullet content within stable sections.
2. The summarizer prompt demands verbatim preservation of ES index names, field paths, and numbers.
3. Rubick conversations rarely exceed ~5 compactions in practice (ES analysts move on to new questions quickly).
4. *Loading* never replays multiple compactions — the most recent compaction is the only one injected into the next chat request. So drift lives only on the write path, not on the read path.

The honest statement: compactions are chained writes but single-compaction reads. If drift becomes observable, switch the summarizer to re-consume raw history instead of the prior summary.

---

## 5. Auth (Google OAuth, invite-gated)

- **Library:** Auth.js v5 (NextAuth) with Google provider.
- **Session:** JWT session stored in a cookie. `userId` on the session claims.
- **Invite gate:** `signIn` callback rejects sign-ins where email ∉ `users.status='active'` ∪ `invites.consumed_at IS NULL`. On successful sign-in of an invited user, transition to `status='active'` and set `invites.consumed_at = now()`.
- **Admin bootstrap:** migration seeds `erwin@99.co` as active admin.
- **Middleware:** all routes under `/c/*`, `/api/chat`, `/api/conversations/*` require an authenticated session.
- **Invite surface (admin-only):** out of scope for v1 UI — admins can insert rows into `invites` directly or via a minimal `POST /api/admin/invites` route gated on `role='admin'`. (Internal tool; no UI in v1.)

The current HMAC shared-password auth in `src/lib/auth.ts` is replaced entirely. No migration path — everyone re-authenticates via Google.

---

## 6. API surface

### 6.1 `POST /api/conversations`
Creates a new conversation. Body: `{ model }` where `model` must be a valid id from `MODELS`. Returns `{ id, title, model }`. 400 on invalid model.

### 6.2 `GET /api/conversations`
Lists current user's conversations. Returns `[{ id, title, model, updated_at }]` ordered by `updated_at DESC`. Used by the sidebar.

### 6.3 `GET /api/conversations/:id/messages`
Returns the full post-latest-compaction slice as AI-SDK UIMessages. Used on page load / tab switch. 404 if conversation does not belong to caller.

### 6.4 `POST /api/chat`
Body: `{ conversationId, message, model }`.

- Looks up conversation (enforces `user_id` match).
- Persists the incoming user message.
- Loads context per §7.
- Streams the assistant turn; persists assistant + tool messages as they stream.
- On finish: updates `conversations.updated_at`, checks compaction threshold, kicks title generation if needed.

---

## 7. Chat request flow (compaction-matched)

This section is informed by the deep research on provider compaction APIs (see §10). The summary: **we build our own compaction, one summarization LLM call, same code path for all providers.** Provider-native APIs are used only opportunistically for prompt caching.

### 7.1 Per-provider compaction capability matrix

| Provider | Native auto-compaction API? | Stateful conversations API? | Prompt caching? | Our stance |
|---|---|---|---|---|
| **Anthropic** | Yes — `compact_20260112` beta, opaque tool-use pairs preserved, triggered by `compact_threshold` token count. | No (stateless; Claude Desktop owns its own threads). | Yes — explicit `cache_control: ephemeral` breakpoints. | **Emulate**. We skip native so behavior is identical across providers and summarizer cost is pinned to Haiku. Use `cache_control` on the stable prefix. |
| **OpenAI** | Yes — Responses API `context_management.compact_threshold` + standalone `/v1/responses/compact`. Produces encrypted/opaque items the client cannot inspect. | Yes — Conversations API (replacement for Assistants). | Yes — automatic prefix caching on Responses. | **Emulate**. Native produces opaque items we can't render, debug, re-summarize, or port to another provider. Opacity is a dealbreaker for a multi-provider app. |
| **Google (Gemini)** | No auto-compaction. Live API has `contextWindowCompression` but that is sliding-window truncation, not summarization. | No persistent thread API. | Yes — explicit `cachedContent` + implicit caching on Flash/Pro. | **Emulate**. Our summarizer is the only option for summarization. |
| **Qwen (DashScope OAI-compat)** | No. `qwen-long` model extends the window to ~10M tokens, which defers the problem, not solves it. | No. | Partial — `cache_control: ephemeral` on DashScope's OpenAI-compatible endpoint (per Alibaba docs). | **Emulate**. For `qwen-long` we can set threshold to Infinity and never compact. |

### 7.2 Per-provider thresholds (tokens-in, pre-call)

```ts
const COMPACTION_THRESHOLD: Record<Provider, number> = {
  anthropic: 150_000,  // Claude 4.x 200k window, leave 50k for response + tools
  openai:    150_000,  // gpt-4.1/5 128k–200k windows, conservative
  google:    700_000,  // Gemini 2.x/3.x 1M window
  qwen:      700_000,  // qwen3 series; qwen-long overrides to Infinity below
};
// qwen-long special case: threshold = Infinity (10M window, never compact)
```

Thresholds are on **estimated input tokens** for the about-to-be-sent request (system + history + new user message + tool schemas), computed via `@anthropic-ai/tokenizer` as a cheap approximation across all providers.

### 7.3 Request pipeline

For each `POST /api/chat` call:

```
1. Authn/z          → session.userId matches conversation.user_id
2. Persist user msg → INSERT messages(role='user')
3. Load context     → SELECT messages WHERE conversation_id=?
                      AND id >= latest_compaction_id ORDER BY id ASC
4. Estimate tokens  → system + tool schemas + history + next_turn_budget
5. If > threshold   → compact(load → summarize → INSERT role='compaction' →
                      re-load from new compaction forward)
6. Build request    → system = [static_prompt, es_slim_context,
                                cache_breakpoint,
                                compaction_if_any]
                      messages = post-compaction history
7. streamText       → persist assistant / tool messages as they stream
8. On finish        → UPDATE conversations SET updated_at = now()
                      If title == 'New chat' AND assistant turn complete:
                        kick async title generation
```

**Notes on step 6 (cache-aware layout).** Stable tokens (static system prompt, ES slim context, compaction if present) go *before* the dynamic tail (recent messages). Providers that support prefix caching (all four, with varying mechanics) hit the cache on subsequent turns within the same conversation because the prefix is identical until the next compaction. Anthropic gets an explicit `cache_control: ephemeral` breakpoint after the compaction block; OpenAI / Gemini / Qwen get it implicitly via prefix stability.

**Notes on step 5 (compaction).** The summarizer is always `claude-haiku-4-5` regardless of the user's chosen chat model, with fallback chain `haiku-4-5 → gpt-4.1-mini → gemini-2.5-flash`. The fallback is triggered only if the primary provider is unavailable (not configured, rate-limited, or 5xx). The summarization prompt is versioned as `compaction_prompt_v1` and recorded in `metadata.prompt_version`. This pins summary cost and output quality independent of chat-model churn.

**Notes on tool-call preservation.** Compaction never splits an `assistant(tool_calls)` row from its matching `tool(tool_call_id)` rows. If the cut point falls inside a tool pair, it is pushed forward to after the tool result. This avoids the "orphan tool_use" error that all providers emit when a tool call lacks its result in the message array.

**Notes on streaming durability.** Assistant / tool messages are persisted as each step finishes (hook into `ai-sdk`'s `onStepFinish`), not at the end of the stream. A disconnected client loses the rendered stream, but the DB has the messages, and a page reload continues seamlessly.

### 7.4 Summarizer prompt (`compaction_prompt_v1`)

```
You are summarizing an Elasticsearch data-analysis conversation so it can
continue with fewer tokens. Produce a markdown summary using EXACTLY these
headings, in this order:

## Conversation summary
### Current task
### Data focus
### Established findings
### Decisions made
### Open items

Rules:
- Preserve Elasticsearch index names, field paths (dot notation), and enum
  values VERBATIM. Do not paraphrase `instance_info.is_removed` to "removal
  flag", etc.
- Preserve exact numbers the assistant reported (counts, percentages, IDR/SGD
  amounts). Do not round.
- Preserve user preferences or scoping decisions (market, date range, currency
  format) as bullet points under "Decisions made".
- Under "Data focus", list which schemas have been loaded via get_schema.
- Under "Open items", list what the user asked next or asked to follow up on.
- Omit pleasantries, apologies, and retries. Do NOT include raw tool payloads.
- If a section has nothing to record, write "None." — do not skip the heading.
- Target length: 300–600 tokens. Hard cap 1,500 tokens.
```

---

## 8. Title generation

Fires once per conversation, after the first complete assistant turn, if `conversations.title = 'New chat'`.

- Kicked asynchronously after the stream response is sent (does not block the user).
- Uses the same summarizer model (`claude-haiku-4-5`).
- Input: first user message + first assistant message (truncated to 2k tokens).
- Output constraint: ≤ 60 chars, no quotes, no trailing punctuation, title case.
- Persisted via `UPDATE conversations SET title = ? WHERE id = ? AND title = 'New chat'` — the `AND title = 'New chat'` guards against overwriting a future rename feature.

---

## 9. UI changes

- **Route change.** `src/app/page.tsx` becomes a "new chat" launcher that creates a conversation and redirects to `/c/[id]`. The actual chat UI moves to `src/app/c/[id]/page.tsx` and reads `conversationId` from the route.
- **Sidebar.** `src/components/chat/sidebar.tsx` — fetches `GET /api/conversations`, lists by `updated_at DESC`, shows `title`, active-conversation highlight, "+ New chat" button at top. No rename / delete / search in v1.
- **Resume.** On `/c/[id]` mount, fetch `GET /api/conversations/:id/messages`, hydrate `useChat` initial messages. Subsequent streaming proceeds normally via `POST /api/chat` with `{ conversationId, message, model }`.
- **Compaction indicator.** Compaction rows are rendered as a subtle separator in the transcript: a horizontal rule + "Earlier context summarized" label + expandable reveal showing the markdown summary. Not an error, not alarming — just honest.
- **Auth surface.** Unauthenticated users land on `/login` (Google sign-in button). Non-invited sign-ins get a polite "This app is invite-only. Ask erwin@99.co for access." page.
- **Model selector scope.** On `/c/[id]`, the model selector is disabled — the conversation's model is fixed at creation time and enforced server-side.

---

## 10. Research appendix (provider compaction deep-dive)

Full matrix and reasoning for §7.1:

**Anthropic `compact_20260112` (beta).** Header `anthropic-beta: compact-2026-01-12`. Triggered by `compact_threshold` on the request. The API returns opaque tool-use/tool-result pairs Claude can expand later. Stateless — the caller still owns message history. If we used this, Claude-path compaction would be invisible to us (we couldn't port it), would cost Opus/Sonnet rates (the chat model does it, not a cheap summarizer), and would diverge from other providers.

**OpenAI `/v1/responses/compact` + `context_management.compact_threshold`.** Produces encrypted reasoning/tool items the client cannot read. Useful for providers' own cost savings, not ours. Opacity is incompatible with "show the user what was summarized" and with cross-provider consistency.

**OpenAI Conversations API.** Stateful threads, replacement for Assistants. We deliberately don't use it: we want one storage model (Postgres), one audit trail, one exportable format. Adopting Conversations would mean OpenAI conversations live in OpenAI's system and the others in ours — unacceptable asymmetry.

**Gemini context caching.** Explicit `cachedContent` (minimum cache size, expires) and implicit caching on Flash/Pro. Useful for prefix caching, not for summarization. Our stable prefix layout benefits from this automatically.

**Gemini Live API `contextWindowCompression`.** Sliding-window token truncation, not summarization. Different mechanism, different goal. Not applicable.

**Qwen via DashScope OAI-compat.** No compaction API. `qwen-long` (10M tokens) lets us skip compaction entirely for that model. Other Qwen models use our standard 700k threshold.

**2025–2026 agentic-chat learnings applied:**

1. **Tool-call atomicity** — every frontier agent framework hit "orphan tool_use" bugs when context trimming broke tool_call/tool_result pairs. §7.3 bakes in atomic preservation.
2. **Stable-prefix / dynamic-tail layout** — now standard across OpenAI, Anthropic, Gemini caching docs. §7.3 step 6.
3. **Durable per-step writes** — Claude Code, Cursor, Devin all persist tool results as they stream so disconnects don't lose work. §7.3 step 8.
4. **Summarizer pinning** — multiple teams (Anthropic research, Replit agent, Continue.dev) report that pinning summarization to a cheap, stable model prevents summary drift when the chat model upgrades. §7.3 step 5.
5. **Self-contained summaries over chained deltas** — chained compactions accumulate error; self-contained compactions reset the error budget each cycle. §4.5.

---

## 11. File layout

```
src/
├── app/
│   ├── page.tsx                                   (new-chat launcher; redirects to /c/[id])
│   ├── c/[id]/page.tsx                            (chat UI, reads conversationId)
│   ├── login/page.tsx                             (Google sign-in)
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts            (Auth.js v5)
│   │   ├── chat/route.ts                          (rewritten)
│   │   ├── conversations/route.ts                 (POST create, GET list)
│   │   └── conversations/[id]/messages/route.ts   (GET history)
│   └── ...existing...
├── components/
│   ├── chat/
│   │   ├── sidebar.tsx                            (new)
│   │   ├── compaction-divider.tsx                 (new)
│   │   └── ...existing...
│   └── ...existing...
├── lib/
│   ├── db.ts                                      (postgres client)
│   ├── auth.ts                                    (rewritten for NextAuth)
│   ├── conversation.ts                            (load/append helpers)
│   ├── compaction.ts                              (threshold check + summarize)
│   ├── title.ts                                   (async title generation)
│   └── tokens.ts                                  (tokenizer wrapper)
├── middleware.ts                                  (NextAuth gate)
└── db/
    └── migrations/
        └── 0001_init.sql
```

---

## 12. Open questions (non-blocking for v1 build)

- Compaction UI reveal: inline expandable vs. "View summary" modal. Pick during UI implementation.
- Admin invite surface: CLI-only vs. minimal admin page. CLI/direct-SQL is fine for v1 since it's only Erwin.
- Token tokenizer accuracy across non-Anthropic models: `@anthropic-ai/tokenizer` is a conservative approximation. Acceptable for threshold decisions; revisit if we see false-positive compactions on OpenAI/Gemini.
