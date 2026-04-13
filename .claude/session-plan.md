# Session Plan — Rubick Web

**Created:** 2026-04-13
**Intent Contract:** See .claude/session-intent.md

## What You'll End Up With

A working Next.js web app where internal users log in with a shared password, pick an LLM model, and ask natural language questions about Rumah123/iProperty data. The backend sends the question + pre-loaded ES schema context to the chosen LLM, which generates an ES query, executes it against the cluster, and streams back a human-readable answer.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Next.js)                 │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Login Page │  │  Chat UI     │  │ Model Picker │ │
│  │ (shared pw)│  │ (streaming)  │  │ (dropdown)   │ │
│  └───────────┘  └──────────────┘  └──────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/chat (streaming)
                       ▼
┌─────────────────────────────────────────────────────┐
│              Next.js API Routes (Backend)            │
│                                                     │
│  1. Load pre-baked ES context (.md files)            │
│  2. Build system prompt with schema context          │
│  3. Send user question + context to chosen LLM      │
│  4. LLM responds with ES query (tool call)           │
│  5. Execute ES query against cluster                 │
│  6. Feed results back to LLM for summarization       │
│  7. Stream final answer to browser                   │
└────────┬───────────────────────────┬────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐      ┌───────────────────────┐
│  LLM APIs       │      │  Elasticsearch 7.x    │
│  - Claude       │      │  43.173.29.240:9200   │
│  - OpenAI       │      │  (read-only)          │
│  - Gemini       │      └───────────────────────┘
└─────────────────┘
```

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14 (App Router) | API routes + SSR + React in one package |
| UI | Tailwind CSS + shadcn/ui | Fast to build, clean look |
| Chat UI | Vercel AI SDK (`ai`) | Handles streaming, model switching, tool calls |
| ES Client | `@elastic/elasticsearch` v7 | Matches ES 7.x cluster |
| Auth | Middleware + cookie session | Shared password, simple cookie |
| State | React state (no DB) | MVP — no chat persistence needed |
| Deployment | Local / Docker | Internal tool |

---

## UI Design — Claude Theme

The UI should mirror Claude's aesthetic: clean, warm, minimal, professional.

### Color Palette
| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--bg-primary` | `#FAFAF8` (warm off-white) | `#1A1A1A` | Main background |
| `--bg-secondary` | `#F5F5F0` | `#262626` | Sidebar, input area |
| `--bg-chat` | `#FFFFFF` | `#1E1E1E` | Chat message area |
| `--accent` | `#D97706` / `#C2884D` | `#D4A574` | Claude orange — model badge, links |
| `--text-primary` | `#1A1A1A` | `#E8E8E8` | Body text |
| `--text-secondary` | `#6B6B6B` | `#999999` | Timestamps, metadata |
| `--user-bubble` | `#F0EDE8` (warm beige) | `#2A2A2A` | User message background |
| `--assistant-bubble` | transparent (no bubble) | transparent | Assistant messages — no bubble, left-aligned text |
| `--border` | `#E5E3DC` | `#333333` | Subtle borders |
| `--input-bg` | `#FFFFFF` | `#262626` | Chat input field |
| `--code-bg` | `#F5F2EB` | `#1E1E1E` | Code blocks |

### Layout
```
┌──────────────────────────────────────────────────┐
│  ┌────────┐                    [Model ▾] [Logout]│  ← Top bar (slim)
│  │ Rubick │                                      │
│  └────────┘                                      │
├──────────────────────────────────────────────────┤
│                                                  │
│  (centered chat area, max-width ~768px)          │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │ 👤 User message in warm beige bubble │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  Assistant response — no bubble, just text       │
│  with markdown tables, code blocks rendered      │
│  cleanly. ES query shown in collapsible block.   │
│                                                  │
│                                                  │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  Ask about your data...            [Send]│    │  ← Input at bottom
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

### Key UI Elements
- **No sidebar** — clean single-column chat (Claude-style)
- **Top bar**: logo left, model selector + logout right
- **Model selector**: dropdown showing provider icon + model name (e.g. "Claude Sonnet 4", "GPT-4o", "Gemini 2.5 Pro")
- **User messages**: right-aligned warm beige bubble
- **Assistant messages**: left-aligned, no bubble, just flowing text (like Claude)
- **Input**: bottom-fixed, rounded, with send button — placeholder "Ask about your data..."
- **Typography**: system font stack (`-apple-system, Inter`), 15-16px body
- **New conversation**: button in top bar to clear chat and start fresh
- **Welcome state**: centered greeting with 3-4 example question chips (e.g. "Top agents by enquiries this month", "Active listings in Jakarta")
- **Streaming**: text appears word-by-word with a subtle cursor indicator
- **Dark mode**: toggle in top bar, defaults to system preference

---

## Implementation Plan

### Phase 1: Project Scaffold (Step 1-3)

**Step 1 — Next.js setup**
- `npx create-next-app@latest` with App Router, TypeScript, Tailwind
- Install deps: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@elastic/elasticsearch`
- Install UI: `shadcn/ui` (button, input, card, select, scroll-area)
- Set up `.env.local` with API keys and ES config

**Step 2 — Auth (shared password)**
- Login page (`/login`) with single password field
- API route `POST /api/auth` validates against `AUTH_PASSWORD` env var
- Sets httpOnly cookie on success
- Middleware redirects unauthenticated users to `/login`
- Logout button clears cookie

**Step 3 — Layout & model picker**
- Claude-themed layout: top bar with logo, model selector, dark mode toggle, logout
- Centered single-column chat (max-width ~768px), no sidebar
- Model selector dropdown with all supported models:
  - Claude: Sonnet 4, Opus 4, Haiku 4
  - OpenAI: GPT-4o, GPT-4o-mini
  - Google: Gemini 2.5 Pro, Gemini 2.5 Flash
- Models config in `lib/models.ts` — easy to add/remove models by editing one file
- Selected model stored in localStorage for persistence across sessions

### Phase 2: Chat Interface (Step 4-5)

**Step 4 — Chat UI**
- Chat page (`/`) with message list and input box
- Use Vercel AI SDK's `useChat` hook for streaming
- Message bubbles: user (right) / assistant (left)
- Markdown rendering in assistant messages (tables, code blocks)
- Auto-scroll to bottom on new messages
- Loading indicator while streaming

**Step 5 — Chat API route**
- `POST /api/chat` — main chat endpoint
- Accepts: `{ messages, model }`
- Uses Vercel AI SDK's `streamText` with model routing
- System prompt includes the pre-loaded ES context

### Phase 3: ES Integration (Step 6-8)

**Step 6 — Context loader**
- Load all 37 `.md` files at build time or server startup
- Concatenate into a single system prompt (or smart chunking if too large)
- Cache in memory — no need to re-read on every request
- Include the `_overview.md` and `business-context.md` always; include specific index schemas based on query relevance (optional optimization)

**Step 7 — ES query execution via tool calls**
- Define a tool for the LLM: `execute_es_query({ index, query })`
- When the LLM generates an ES query, the tool call hits the ES cluster
- ES client configured with read-only credentials
- Parse and return results to the LLM for summarization
- Safety: validate index names, reject write operations

**Step 8 — Response formatting**
- LLM summarizes ES results into human-readable answers
- Support for tables (markdown), lists, and key metrics
- Show the ES query used (collapsible, for transparency)
- Handle errors gracefully (invalid query, timeout, no results)

### Phase 4: Polish & Ship (Step 9-10)

**Step 9 — Error handling & UX**
- Rate limiting (simple in-memory counter)
- Request timeout handling (ES + LLM)
- Empty state / welcome message with example questions
- Model-specific error messages
- Mobile responsive layout

**Step 10 — Deployment**
- Dockerfile for containerized deployment
- `docker-compose.yml` with env vars
- README with setup instructions
- Health check endpoint

---

## File Structure

```
rubick-web/
├── .env.local                    # API keys, ES config, auth password
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout with providers
│   │   ├── page.tsx              # Chat page (main)
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   └── api/
│   │       ├── auth/
│   │       │   └── route.ts      # Auth endpoint
│   │       └── chat/
│   │           └── route.ts      # Chat streaming endpoint
│   ├── components/
│   │   ├── chat/
│   │   │   ├── chat-messages.tsx  # Message list
│   │   │   ├── chat-input.tsx     # Input box
│   │   │   └── message-bubble.tsx # Individual message
│   │   ├── model-selector.tsx     # Model picker dropdown
│   │   ├── login-form.tsx         # Login form
│   │   └── ui/                    # shadcn components
│   ├── lib/
│   │   ├── es-client.ts           # Elasticsearch client
│   │   ├── es-context.ts          # Load & cache .md context files
│   │   ├── auth.ts                # Auth helpers
│   │   └── models.ts              # Model configuration & routing
│   └── middleware.ts              # Auth middleware
├── context/                       # Copy of the 37 .md files
│   ├── _overview.md
│   ├── business-context.md
│   ├── enquiries.md
│   └── ... (all 37 files)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Environment Variables

```env
# Auth
AUTH_PASSWORD=your-shared-password

# LLM API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Elasticsearch
ES_HOST=http://43.173.29.240:9200
ES_USERNAME=portal-r123
ES_PASSWORD=k3OzEuSF0Oot7lCW

# Optional
NODE_ENV=production
```

---

## Key Design Decisions

1. **Vercel AI SDK** — handles streaming, tool calls, and multi-model support out of the box. No need to build custom streaming or model abstraction.

2. **Tool calls for ES queries** — instead of parsing LLM output for JSON queries, use structured tool calls. The LLM calls `execute_es_query(index, query)`, we run it, feed results back. This is more reliable than regex parsing.

3. **Pre-loaded context** — the 37 .md files are bundled into the app (in `/context/` directory). Loaded once at startup, cached in memory. No vector DB needed for MVP.

4. **No chat persistence** — MVP doesn't save conversation history. Conversations live in browser state only. Can add DB later if needed.

5. **Shared password** — simplest auth for internal tool. Single env var, httpOnly cookie. No user management overhead.

---

## Phase Weights

```
DISCOVER ████ 10%        — Already done (we know the data, stack, approach)
DEFINE   ██████ 15%      — This plan covers it
DEVELOP  ████████████████████ 55%  — Main effort: build the app
DELIVER  ████████ 20%    — Testing, deployment, polish
```

---

## Execution Commands

To execute this plan:
```
/octo:embrace "Build Rubick Web MVP"
```

Or execute phases individually:
- Step 1-3: Project scaffold, auth, layout
- Step 4-5: Chat UI and API
- Step 6-8: ES integration with tool calls
- Step 9-10: Polish and deploy

## Success Criteria Checklist
- [ ] User can log in with shared password
- [ ] User can select LLM model (Claude, GPT, Gemini)
- [ ] User can type a question and get a streamed response
- [ ] Backend queries Elasticsearch using LLM-generated queries
- [ ] Results are formatted as readable text/tables
- [ ] ES query is shown for transparency
- [ ] Works on desktop browser

## Next Steps
1. Review this plan
2. Adjust if needed (re-run /octo:plan)
3. Execute with /octo:embrace when ready
