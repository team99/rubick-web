# Conversation History & Compaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-user conversation history with per-conversation context windows, Google OAuth (invite-only), Postgres persistence, and provider-agnostic compaction via a single summarization LLM call.

**Architecture:** Next.js 16 App Router. Postgres is source of truth (3 tables: `users`, `conversations`, `messages`). Compaction is an in-band `messages` row with `role='compaction'` and sectioned-markdown content. Chat route persists each streamed step so disconnects are durable. Summarizer pinned to `claude-haiku-4-5` with fallback. Route changes: chat UI moves from `/` to `/c/[id]`; `/` becomes a "new chat" launcher.

**Tech Stack:** Next.js 16, React 19, ai-sdk v6, Auth.js v5 (NextAuth), `postgres` (postgres.js), `@anthropic-ai/tokenizer`, `nanoid`, Vitest for pure-logic tests.

**Spec reference:** `docs/superpowers/specs/2026-04-22-conversation-history-design.md`

---

## File Structure

**Create:**
- `db/migrations/0001_init.sql`
- `scripts/migrate.ts`
- `src/lib/db.ts` — postgres client singleton
- `src/lib/tokens.ts` — token estimation wrapper
- `src/lib/conversation.ts` — CRUD + post-compaction slice loader
- `src/lib/compaction.ts` — threshold check, atomic cut, summarizer call
- `src/lib/title.ts` — async title generation
- `src/lib/auth.config.ts` — NextAuth config (Google + invite gate)
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handlers
- `src/app/api/conversations/route.ts` — POST create, GET list
- `src/app/api/conversations/[id]/messages/route.ts` — GET history
- `src/app/api/admin/invites/route.ts` — admin-only invite creation
- `src/app/c/[id]/page.tsx` — chat UI for a conversation
- `src/components/chat/sidebar.tsx` — conversation list
- `src/components/chat/compaction-divider.tsx` — "Earlier context summarized"
- `src/lib/__tests__/compaction.test.ts`
- `src/lib/__tests__/conversation.test.ts`
- `vitest.config.ts`

**Modify:**
- `src/app/page.tsx` — becomes new-chat launcher
- `src/app/login/page.tsx` — replaced with Google sign-in
- `src/app/api/auth/route.ts` — deleted (old shared-password endpoint)
- `src/app/api/chat/route.ts` — rewrite to accept `{ conversationId, message, model }`
- `src/components/chat/message-bubble.tsx` — render compaction divider
- `src/lib/auth.ts` — replaced with NextAuth helpers (re-export `auth()` from config)
- `src/middleware.ts` — NextAuth middleware (create if absent)
- `package.json` — add deps, add test script
- `.env.local` (document required vars)

---

## Env vars required

```
# Existing
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
DASHSCOPE_API_KEY=...
ES_ENDPOINT=...
ES_API_KEY=...

# New
DATABASE_URL=postgres://user:pass@host:5432/rubick
AUTH_SECRET=<openssl rand -base64 32>
AUTH_GOOGLE_ID=<from Google Cloud console>
AUTH_GOOGLE_SECRET=<from Google Cloud console>
ADMIN_EMAIL=erwin@99.co
```

---

## Task 1: Install dependencies and scaffold test runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime deps**

```bash
npm install postgres @anthropic-ai/tokenizer nanoid next-auth@beta
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest @vitest/ui dotenv tsx
```

- [ ] **Step 3: Add scripts to package.json**

Edit `package.json` `scripts` block to:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:migrate": "tsx scripts/migrate.ts"
}
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 5: Run vitest to confirm wiring**

Run: `npm test`
Expected: exits successfully with "No test files found, exiting with code 0" or similar — we have no tests yet.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add postgres, next-auth, tokenizer, nanoid, vitest"
```

---

## Task 2: Write database migration

**Files:**
- Create: `db/migrations/0001_init.sql`

- [ ] **Step 1: Write the migration**

```sql
-- db/migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT,
  image_url    TEXT,
  role         TEXT NOT NULL CHECK (role IN ('admin','member')),
  status       TEXT NOT NULL CHECK (status IN ('invited','active','disabled')),
  invited_by   TEXT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS invites (
  email        TEXT PRIMARY KEY,
  invited_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New chat',
  model      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_user_updated
  ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool','compaction')),
  content         TEXT,
  tool_calls      JSONB,
  tool_call_id    TEXT,
  tool_name       TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role = 'tool') = (tool_call_id IS NOT NULL AND tool_name IS NOT NULL)),
  CHECK (tool_calls IS NULL OR role = 'assistant'),
  CHECK (pg_column_size(tool_calls) < 64 * 1024),
  CHECK (pg_column_size(metadata)   < 16 * 1024)
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_tool_result
  ON messages(conversation_id, tool_call_id)
  WHERE tool_call_id IS NOT NULL;

-- Admin bootstrap: idempotent. Id will be a stable deterministic value.
INSERT INTO users (id, email, role, status, invited_by)
VALUES ('u_admin_bootstrap', 'erwin@99.co', 'admin', 'active', NULL)
ON CONFLICT (email) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add db/migrations/0001_init.sql
git commit -m "feat(db): add initial schema migration"
```

---

## Task 3: Write migration runner

**Files:**
- Create: `scripts/migrate.ts`

- [ ] **Step 1: Write the migration runner**

```ts
// scripts/migrate.ts
import "dotenv/config";
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const sql = postgres(url, { max: 1 });

  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   TEXT PRIMARY KEY,
      ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const dir = path.resolve("db/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const [{ exists } = { exists: false }] = await sql`
      SELECT EXISTS (SELECT 1 FROM _migrations WHERE id = ${file}) AS exists
    `;
    if (exists) {
      console.log(`[skip] ${file}`);
      continue;
    }
    const body = readFileSync(path.join(dir, file), "utf8");
    console.log(`[run]  ${file}`);
    await sql.unsafe(body);
    await sql`INSERT INTO _migrations (id) VALUES (${file})`;
  }

  await sql.end();
  console.log("migrations complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Ensure local Postgres has a rubick db**

Run (user action): create a local database or point `DATABASE_URL` at a Neon dev branch. Confirm by running `psql "$DATABASE_URL" -c '\l'`.

- [ ] **Step 3: Run the migration**

Run: `npm run db:migrate`
Expected output:
```
[run]  0001_init.sql
migrations complete
```

- [ ] **Step 4: Verify admin row exists**

Run: `psql "$DATABASE_URL" -c "SELECT email, role, status FROM users;"`
Expected:
```
   email    | role  | status
------------+-------+--------
 erwin@99.co| admin | active
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate.ts
git commit -m "feat(db): add migration runner"
```

---

## Task 4: DB client singleton

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Write the client**

```ts
// src/lib/db.ts
import postgres from "postgres";

declare global {
  var __rubickSql: ReturnType<typeof postgres> | undefined;
}

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });
}

export const sql = global.__rubickSql ?? makeClient();
if (process.env.NODE_ENV !== "production") {
  global.__rubickSql = sql;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(db): add postgres client singleton"
```

---

## Task 5: NextAuth configuration with invite gate

**Files:**
- Create: `src/lib/auth.config.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Delete: `src/app/api/auth/route.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Write auth config**

```ts
// src/lib/auth.config.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { sql } from "@/lib/db";
import { nanoid } from "nanoid";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async signIn({ user, profile }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      // Already an active user?
      const [existing] = await sql<
        { id: string; status: string }[]
      >`SELECT id, status FROM users WHERE email = ${email} LIMIT 1`;

      if (existing) {
        if (existing.status === "disabled") return false;
        await sql`
          UPDATE users
          SET name = ${user.name ?? null},
              image_url = ${user.image ?? null},
              last_seen_at = now(),
              status = CASE WHEN status = 'invited' THEN 'active' ELSE status END
          WHERE id = ${existing.id}
        `;
        // Consume invite if present
        await sql`
          UPDATE invites SET consumed_at = now()
          WHERE email = ${email} AND consumed_at IS NULL
        `;
        return true;
      }

      // New user: must have an unconsumed invite
      const [invite] = await sql<
        { invited_by: string }[]
      >`SELECT invited_by FROM invites WHERE email = ${email} AND consumed_at IS NULL LIMIT 1`;

      if (!invite) return false;

      const id = `u_${nanoid(16)}`;
      await sql`
        INSERT INTO users (id, email, name, image_url, role, status, invited_by, last_seen_at)
        VALUES (${id}, ${email}, ${user.name ?? null}, ${user.image ?? null},
                'member', 'active', ${invite.invited_by}, now())
      `;
      await sql`
        UPDATE invites SET consumed_at = now() WHERE email = ${email}
      `;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const [row] = await sql<
          { id: string; role: string }[]
        >`SELECT id, role FROM users WHERE email = ${user.email.toLowerCase()} LIMIT 1`;
        if (row) {
          token.userId = row.id;
          token.role = row.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user = { ...session.user, id: token.userId as string };
      if (token.role) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
```

- [ ] **Step 2: Write the NextAuth route handler**

```ts
// src/app/api/auth/[...nextauth]/route.ts
export { GET, POST } from "@/lib/auth.config";
```

Wait — NextAuth v5 exports `handlers` not `GET`/`POST` directly. Correct version:

```ts
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth.config";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Delete the old auth API route**

```bash
rm src/app/api/auth/route.ts
```

- [ ] **Step 4: Replace src/lib/auth.ts with a re-export**

Overwrite `src/lib/auth.ts` with:

```ts
// src/lib/auth.ts
export { auth, signIn, signOut } from "@/lib/auth.config";

export async function requireSession() {
  const { auth } = await import("@/lib/auth.config");
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}
```

- [ ] **Step 5: Run type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to the new auth files. Existing references to `verifyAuth` / `validatePassword` / `getAuthCookieConfig` will error — we fix those in Task 6 and Task 11.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.config.ts src/app/api/auth
git commit -m "feat(auth): add NextAuth v5 with Google + invite gate"
```

---

## Task 6: Replace login page and wire old callers

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Read the existing login page for layout cues**

Run: `cat src/app/login/page.tsx`

- [ ] **Step 2: Replace login page with Google sign-in**

```tsx
// src/app/login/page.tsx
import { signIn } from "@/lib/auth.config";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="h-full flex items-center justify-center bg-[#FAFAF8] dark:bg-[#1A1A1A]">
      <div className="w-full max-w-sm px-6 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">Rubick</h1>
          <p className="text-sm text-[#6B6B6B]">Sign in to continue.</p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full px-4 py-2 rounded-lg border border-[#E5E3DC] dark:border-[#333333] text-sm text-[#1A1A1A] dark:text-[#E8E8E8] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors"
          >
            Continue with Google
          </button>
        </form>

        <ErrorBanner searchParams={searchParams} />
      </div>
    </main>
  );
}

async function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p className="text-xs text-red-600 dark:text-red-400 text-center">
      This app is invite-only. Ask erwin@99.co for access.
    </p>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): replace login page with Google sign-in"
```

---

## Task 7: Middleware gate

**Files:**
- Create or modify: `src/middleware.ts`

- [ ] **Step 1: Check if middleware exists**

Run: `ls src/middleware.ts 2>/dev/null && cat src/middleware.ts`

- [ ] **Step 2: Write middleware**

Overwrite `src/middleware.ts`:

```ts
// src/middleware.ts
import { auth } from "@/lib/auth.config";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!isLoggedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): route gate via NextAuth middleware"
```

---

## Task 8: Token estimation wrapper

**Files:**
- Create: `src/lib/tokens.ts`

- [ ] **Step 1: Write the wrapper**

```ts
// src/lib/tokens.ts
// @ts-expect-error – no bundled types
import { countTokens } from "@anthropic-ai/tokenizer";

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return countTokens(text);
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string | null; tool_name?: string | null }>
): number {
  let total = 0;
  for (const m of messages) {
    total += 4; // role framing overhead
    if (m.content) total += estimateTokens(m.content);
    if (m.tool_calls) total += estimateTokens(JSON.stringify(m.tool_calls));
    if (m.tool_name) total += estimateTokens(m.tool_name);
  }
  return total;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tokens.ts
git commit -m "feat: add token estimation helper"
```

---

## Task 9: Conversation helpers (DB layer) — tests first

**Files:**
- Create: `src/lib/__tests__/conversation.test.ts`
- Create: `src/lib/conversation.ts`

- [ ] **Step 1: Write the failing test for `sliceFromLatestCompaction`**

```ts
// src/lib/__tests__/conversation.test.ts
import { describe, it, expect } from "vitest";
import { sliceFromLatestCompaction, type DbMessage } from "@/lib/conversation";

const mk = (id: number, role: DbMessage["role"], extra: Partial<DbMessage> = {}): DbMessage => ({
  id,
  conversation_id: "c1",
  role,
  content: `msg-${id}`,
  tool_calls: null,
  tool_call_id: null,
  tool_name: null,
  metadata: null,
  created_at: new Date(),
  ...extra,
});

describe("sliceFromLatestCompaction", () => {
  it("returns all messages when no compaction present", () => {
    const rows = [mk(1, "user"), mk(2, "assistant"), mk(3, "user")];
    expect(sliceFromLatestCompaction(rows).map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("returns from the latest compaction onward (inclusive)", () => {
    const rows = [
      mk(1, "user"),
      mk(2, "assistant"),
      mk(3, "compaction"),
      mk(4, "user"),
      mk(5, "assistant"),
    ];
    expect(sliceFromLatestCompaction(rows).map((m) => m.id)).toEqual([3, 4, 5]);
  });

  it("picks the latest compaction when multiple exist", () => {
    const rows = [
      mk(1, "compaction"),
      mk(2, "user"),
      mk(3, "compaction"),
      mk(4, "user"),
    ];
    expect(sliceFromLatestCompaction(rows).map((m) => m.id)).toEqual([3, 4]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '@/lib/conversation'".

- [ ] **Step 3: Implement conversation.ts**

```ts
// src/lib/conversation.ts
import { sql } from "@/lib/db";
import { nanoid } from "nanoid";

export type DbMessage = {
  id: number;
  conversation_id: string;
  role: "user" | "assistant" | "tool" | "compaction";
  content: string | null;
  tool_calls: unknown | null;
  tool_call_id: string | null;
  tool_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

export type DbConversation = {
  id: string;
  user_id: string;
  title: string;
  model: string;
  created_at: Date;
  updated_at: Date;
};

export async function createConversation(userId: string, model: string): Promise<DbConversation> {
  const id = `c_${nanoid(16)}`;
  const [row] = await sql<DbConversation[]>`
    INSERT INTO conversations (id, user_id, model)
    VALUES (${id}, ${userId}, ${model})
    RETURNING *
  `;
  return row;
}

export async function listConversations(userId: string): Promise<DbConversation[]> {
  return sql<DbConversation[]>`
    SELECT * FROM conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 200
  `;
}

export async function getConversation(
  id: string,
  userId: string
): Promise<DbConversation | null> {
  const [row] = await sql<DbConversation[]>`
    SELECT * FROM conversations WHERE id = ${id} AND user_id = ${userId} LIMIT 1
  `;
  return row ?? null;
}

export async function loadMessages(conversationId: string): Promise<DbMessage[]> {
  return sql<DbMessage[]>`
    SELECT * FROM messages WHERE conversation_id = ${conversationId} ORDER BY id ASC
  `;
}

/** Returns messages from the most recent `compaction` row onward (inclusive). */
export function sliceFromLatestCompaction(rows: DbMessage[]): DbMessage[] {
  let cutIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].role === "compaction") {
      cutIdx = i;
      break;
    }
  }
  return cutIdx === -1 ? rows : rows.slice(cutIdx);
}

export async function appendMessage(m: {
  conversation_id: string;
  role: DbMessage["role"];
  content?: string | null;
  tool_calls?: unknown;
  tool_call_id?: string | null;
  tool_name?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<DbMessage> {
  const [row] = await sql<DbMessage[]>`
    INSERT INTO messages (conversation_id, role, content, tool_calls, tool_call_id, tool_name, metadata)
    VALUES (${m.conversation_id}, ${m.role}, ${m.content ?? null},
            ${m.tool_calls ? sql.json(m.tool_calls) : null},
            ${m.tool_call_id ?? null}, ${m.tool_name ?? null},
            ${m.metadata ? sql.json(m.metadata) : null})
    RETURNING *
  `;
  await sql`UPDATE conversations SET updated_at = now() WHERE id = ${m.conversation_id}`;
  return row;
}

export async function setTitle(conversationId: string, title: string): Promise<void> {
  await sql`
    UPDATE conversations SET title = ${title}
    WHERE id = ${conversationId} AND title = 'New chat'
  `;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversation.ts src/lib/__tests__/conversation.test.ts
git commit -m "feat: conversation CRUD + post-compaction slicing"
```

---

## Task 10: Compaction module — atomic tool-pair preservation (TDD)

**Files:**
- Create: `src/lib/__tests__/compaction.test.ts`
- Create: `src/lib/compaction.ts`

- [ ] **Step 1: Write the failing test for `splitForCompaction`**

The function takes an ordered message list and a proposed cut index, and returns a `{ toSummarize, toKeep }` split that never separates an `assistant(tool_calls)` row from its matching `tool(tool_call_id)` rows.

```ts
// src/lib/__tests__/compaction.test.ts
import { describe, it, expect } from "vitest";
import { splitForCompaction } from "@/lib/compaction";
import type { DbMessage } from "@/lib/conversation";

const mk = (id: number, role: DbMessage["role"], extra: Partial<DbMessage> = {}): DbMessage => ({
  id, conversation_id: "c1", role, content: `m${id}`,
  tool_calls: null, tool_call_id: null, tool_name: null, metadata: null,
  created_at: new Date(), ...extra,
});

describe("splitForCompaction", () => {
  it("splits cleanly when cut falls between turns", () => {
    const rows = [mk(1, "user"), mk(2, "assistant"), mk(3, "user"), mk(4, "assistant")];
    const { toSummarize, toKeep } = splitForCompaction(rows, 2);
    expect(toSummarize.map((m) => m.id)).toEqual([1, 2]);
    expect(toKeep.map((m) => m.id)).toEqual([3, 4]);
  });

  it("pushes cut forward to after tool result when cut falls between tool_call and tool", () => {
    const rows = [
      mk(1, "user"),
      mk(2, "assistant", { tool_calls: [{ id: "tc_1", name: "get_schema" }] }),
      mk(3, "tool", { tool_call_id: "tc_1", tool_name: "get_schema" }),
      mk(4, "assistant"),
      mk(5, "user"),
    ];
    // Proposed cut is 3, which would leave tool_call (id=2) orphaned in toSummarize
    // while tool result (id=3) stays in toKeep — wait, 3 means "first 3 rows".
    // We cut after 2 items, which separates tool_call from its tool result.
    const { toSummarize, toKeep } = splitForCompaction(rows, 2);
    // Should be pushed forward to include the tool result AND the final assistant response
    // for that tool use (assistant row 4). Minimal safe extension: through row 4.
    expect(toSummarize.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(toKeep.map((m) => m.id)).toEqual([5]);
  });

  it("handles multiple tool_calls in one assistant message", () => {
    const rows = [
      mk(1, "assistant", { tool_calls: [{ id: "tc_a" }, { id: "tc_b" }] }),
      mk(2, "tool", { tool_call_id: "tc_a", tool_name: "f" }),
      mk(3, "tool", { tool_call_id: "tc_b", tool_name: "g" }),
      mk(4, "assistant"),
      mk(5, "user"),
    ];
    const { toSummarize, toKeep } = splitForCompaction(rows, 1);
    expect(toSummarize.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(toKeep.map((m) => m.id)).toEqual([5]);
  });

  it("returns empty toSummarize when cut is 0", () => {
    const rows = [mk(1, "user"), mk(2, "assistant")];
    const { toSummarize, toKeep } = splitForCompaction(rows, 0);
    expect(toSummarize).toEqual([]);
    expect(toKeep.map((m) => m.id)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '@/lib/compaction'".

- [ ] **Step 3: Implement compaction.ts (splitForCompaction only)**

```ts
// src/lib/compaction.ts
import type { DbMessage } from "@/lib/conversation";
import { appendMessage, loadMessages, sliceFromLatestCompaction } from "@/lib/conversation";
import { estimateMessagesTokens, estimateTokens } from "@/lib/tokens";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { getModelConfig, type ModelConfig } from "@/lib/models";

export const COMPACTION_THRESHOLD: Record<ModelConfig["provider"], number> = {
  anthropic: 150_000,
  openai: 150_000,
  google: 700_000,
  qwen: 700_000,
};

export function thresholdFor(modelId: string): number {
  const cfg = getModelConfig(modelId);
  if (cfg.modelId.includes("qwen-long")) return Infinity;
  return COMPACTION_THRESHOLD[cfg.provider];
}

/**
 * Split messages at `cutAfter` (number of items to summarize), pushing the cut
 * forward if it would separate an assistant(tool_calls) row from any of its
 * corresponding tool result rows, or from the immediately following assistant
 * response that interpreted those results.
 */
export function splitForCompaction(
  rows: DbMessage[],
  cutAfter: number
): { toSummarize: DbMessage[]; toKeep: DbMessage[] } {
  let idx = Math.max(0, Math.min(cutAfter, rows.length));

  // Walk forward past any open tool-call/tool-result pairs or incomplete
  // assistant turn. A "safe" cut boundary is one where all tool_call ids
  // issued in toSummarize have matching tool results in toSummarize, AND
  // the next message is not a tool result referencing a call in toSummarize.
  while (idx < rows.length) {
    const left = rows.slice(0, idx);
    const right = rows.slice(idx);

    const openCallIds = new Set<string>();
    for (const m of left) {
      if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls as Array<{ id?: string }>) {
          if (tc.id) openCallIds.add(tc.id);
        }
      }
      if (m.role === "tool" && m.tool_call_id) {
        openCallIds.delete(m.tool_call_id);
      }
    }

    // If any tool call in `left` is unmatched, extend forward to include
    // its tool result AND the next assistant response (which interprets it).
    if (openCallIds.size > 0) {
      idx++;
      continue;
    }
    // If the next message is a tool result of a call in left (can't happen
    // because we cleared the set above), same thing. Otherwise we're safe.
    // Also: if the message right before `idx` is a tool result, include the
    // following assistant turn so the summary is semantically complete.
    const last = left[left.length - 1];
    if (last?.role === "tool" && right[0]?.role === "assistant") {
      idx++;
      continue;
    }
    break;
  }

  return { toSummarize: rows.slice(0, idx), toKeep: rows.slice(idx) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 4 tests in compaction.test.ts.

- [ ] **Step 5: Commit the split logic**

```bash
git add src/lib/compaction.ts src/lib/__tests__/compaction.test.ts
git commit -m "feat: atomic tool-pair preserving split for compaction"
```

---

## Task 11: Compaction module — summarizer call

**Files:**
- Modify: `src/lib/compaction.ts`

- [ ] **Step 1: Extend compaction.ts with the summarizer**

Append to `src/lib/compaction.ts`:

```ts
export const COMPACTION_PROMPT_VERSION = "compaction_prompt_v1";

const SUMMARIZER_SYSTEM = `You are summarizing an Elasticsearch data-analysis conversation so it can continue with fewer tokens. Produce a markdown summary using EXACTLY these headings, in this order:

## Conversation summary
### Current task
### Data focus
### Established findings
### Decisions made
### Open items

Rules:
- Preserve Elasticsearch index names, field paths (dot notation), and enum values VERBATIM.
- Preserve exact numbers the assistant reported (counts, percentages, IDR/SGD amounts). Do not round.
- Preserve user preferences or scoping decisions (market, date range, currency format) as bullet points under "Decisions made".
- Under "Data focus", list which schemas have been loaded via get_schema.
- Under "Open items", list what the user asked next or asked to follow up on.
- Omit pleasantries, apologies, and retries. Do NOT include raw tool payloads.
- If a section has nothing to record, write "None." — do not skip the heading.
- Target length: 300–600 tokens. Hard cap 1,500 tokens.`;

function formatMessagesForSummary(msgs: DbMessage[]): string {
  return msgs
    .map((m) => {
      if (m.role === "compaction") return `[PRIOR SUMMARY]\n${m.content ?? ""}`;
      if (m.role === "user") return `[USER]\n${m.content ?? ""}`;
      if (m.role === "assistant") {
        const tc = m.tool_calls
          ? `\n[TOOL CALLS] ${JSON.stringify(m.tool_calls)}`
          : "";
        return `[ASSISTANT]\n${m.content ?? ""}${tc}`;
      }
      if (m.role === "tool") return `[TOOL ${m.tool_name}]\n${(m.content ?? "").slice(0, 2000)}`;
      return "";
    })
    .join("\n\n");
}

type Summarizer = { provider: "anthropic" | "openai" | "google"; modelId: string };

const SUMMARIZER_CHAIN: Summarizer[] = [
  { provider: "anthropic", modelId: "claude-haiku-4-5" },
  { provider: "openai", modelId: "gpt-4.1-mini" },
  { provider: "google", modelId: "gemini-2.5-flash" },
];

function pickSummarizer(): Summarizer {
  for (const s of SUMMARIZER_CHAIN) {
    if (s.provider === "anthropic" && process.env.ANTHROPIC_API_KEY) return s;
    if (s.provider === "openai" && process.env.OPENAI_API_KEY) return s;
    if (s.provider === "google" && process.env.GOOGLE_GENERATIVE_AI_API_KEY) return s;
  }
  throw new Error("No summarizer API key configured");
}

function summarizerModel(s: Summarizer) {
  switch (s.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })(s.modelId);
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })(s.modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })(s.modelId);
  }
}

/**
 * Compact the conversation if estimated tokens exceed threshold.
 * Inserts a new `compaction` message covering everything up to a safe cut
 * point. Returns true if compaction occurred.
 */
export async function maybeCompact(
  conversationId: string,
  chatModelId: string
): Promise<boolean> {
  const all = await loadMessages(conversationId);
  const effective = sliceFromLatestCompaction(all);

  const tokens = estimateMessagesTokens(effective);
  const threshold = thresholdFor(chatModelId);
  if (tokens < threshold) return false;

  // Keep ~25% of the window as "recent context", summarize the rest.
  const keepBudget = Math.floor(threshold * 0.25);
  let runningTokens = 0;
  let keepFromIdx = effective.length;
  for (let i = effective.length - 1; i >= 0; i--) {
    runningTokens += estimateMessagesTokens([effective[i]]);
    if (runningTokens > keepBudget) {
      keepFromIdx = i + 1;
      break;
    }
    keepFromIdx = i;
  }

  const { toSummarize } = splitForCompaction(effective, keepFromIdx);
  if (toSummarize.length === 0) return false;

  const s = pickSummarizer();
  const prompt = formatMessagesForSummary(toSummarize);

  const t0 = Date.now();
  const { text } = await generateText({
    model: summarizerModel(s),
    system: SUMMARIZER_SYSTEM,
    prompt,
  });
  const ms = Date.now() - t0;

  const preTokens = estimateMessagesTokens(toSummarize);
  const postTokens = estimateTokens(text);

  await appendMessage({
    conversation_id: conversationId,
    role: "compaction",
    content: text,
    metadata: {
      summarized_through_message_id: toSummarize[toSummarize.length - 1].id,
      pre_tokens: preTokens,
      post_tokens: postTokens,
      summarizer_model: `${s.provider}:${s.modelId}`,
      prompt_version: COMPACTION_PROMPT_VERSION,
      ms,
    },
  });
  return true;
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/compaction.ts
git commit -m "feat: summarizer call + maybeCompact orchestration"
```

---

## Task 12: Title generation

**Files:**
- Create: `src/lib/title.ts`

- [ ] **Step 1: Write title.ts**

```ts
// src/lib/title.ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { setTitle } from "@/lib/conversation";

const TITLE_SYSTEM = `You name chat conversations. Rules:
- Max 60 characters.
- Title Case.
- No quotes, no trailing punctuation.
- Describe the DATA question, not the chat itself (e.g. "April Enquiries by Agent" not "Asking About Enquiries").
- Output ONLY the title, nothing else.`;

function pickTitler() {
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })("claude-haiku-4-5");
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })("gpt-4.1-mini");
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(
      "gemini-2.5-flash"
    );
  }
  return null;
}

function sanitize(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .slice(0, 60);
}

/** Fire-and-forget. Safe to call without awaiting. */
export async function generateTitle(params: {
  conversationId: string;
  firstUserMessage: string;
  firstAssistantMessage: string;
}): Promise<void> {
  const model = pickTitler();
  if (!model) return;
  try {
    const { text } = await generateText({
      model,
      system: TITLE_SYSTEM,
      prompt: `User asked:\n${params.firstUserMessage.slice(0, 1500)}\n\nAssistant answered:\n${params.firstAssistantMessage.slice(0, 1500)}\n\nTitle:`,
    });
    const title = sanitize(text);
    if (title) await setTitle(params.conversationId, title);
  } catch (err) {
    console.error("[title] failed", err);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/title.ts
git commit -m "feat: async auto-title generation"
```

---

## Task 13: Conversations API

**Files:**
- Create: `src/app/api/conversations/route.ts`
- Create: `src/app/api/conversations/[id]/messages/route.ts`

- [ ] **Step 1: Write POST/GET /api/conversations**

```ts
// src/app/api/conversations/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth.config";
import { MODELS } from "@/lib/models";
import { createConversation, listConversations } from "@/lib/conversation";

const validModelIds = new Set(MODELS.map((m) => m.id));
const createSchema = z.object({
  model: z.string().refine((id) => validModelIds.has(id), "Invalid model ID"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const rows = await listConversations(session.user.id);
  return NextResponse.json(
    rows.map((r) => ({ id: r.id, title: r.title, model: r.model, updated_at: r.updated_at }))
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const conv = await createConversation(session.user.id, parsed.data.model);
  return NextResponse.json({ id: conv.id, title: conv.title, model: conv.model });
}
```

- [ ] **Step 2: Write GET /api/conversations/[id]/messages**

```ts
// src/app/api/conversations/[id]/messages/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth.config";
import {
  getConversation,
  loadMessages,
  sliceFromLatestCompaction,
  type DbMessage,
} from "@/lib/conversation";

type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "compaction"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown };

type UIMessage = { id: string; role: "user" | "assistant"; parts: UIMessagePart[] };

function toUIMessages(rows: DbMessage[]): UIMessage[] {
  const out: UIMessage[] = [];
  for (const r of rows) {
    if (r.role === "compaction") {
      out.push({
        id: `m_${r.id}`,
        role: "assistant",
        parts: [{ type: "compaction", text: r.content ?? "" }],
      });
      continue;
    }
    if (r.role === "user") {
      out.push({
        id: `m_${r.id}`,
        role: "user",
        parts: [{ type: "text", text: r.content ?? "" }],
      });
      continue;
    }
    if (r.role === "assistant") {
      const parts: UIMessagePart[] = [];
      if (r.content) parts.push({ type: "text", text: r.content });
      if (Array.isArray(r.tool_calls)) {
        for (const tc of r.tool_calls as Array<{ id: string; name: string; args: unknown }>) {
          parts.push({
            type: "tool-call",
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.args,
          });
        }
      }
      out.push({ id: `m_${r.id}`, role: "assistant", parts });
      continue;
    }
    if (r.role === "tool") {
      // Attach to most recent assistant message
      const last = out[out.length - 1];
      if (last?.role === "assistant") {
        last.parts.push({
          type: "tool-result",
          toolCallId: r.tool_call_id!,
          toolName: r.tool_name!,
          result: r.content ? JSON.parse(r.content) : null,
        });
      }
    }
  }
  return out;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const conv = await getConversation(id, session.user.id);
  if (!conv) return new NextResponse("Not found", { status: 404 });
  const all = await loadMessages(id);
  const slice = sliceFromLatestCompaction(all);
  return NextResponse.json({
    conversation: { id: conv.id, title: conv.title, model: conv.model },
    messages: toUIMessages(slice),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/conversations
git commit -m "feat(api): conversations list/create/history endpoints"
```

---

## Task 14: Rewrite chat route

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Rewrite chat route**

Overwrite `src/app/api/chat/route.ts`:

```ts
// src/app/api/chat/route.ts
import { streamText, stepCountIs, convertToModelMessages, type UIMessage, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { auth } from "@/lib/auth.config";
import { getModelConfig, MODELS } from "@/lib/models";
import { getSlimContext, getSchemaFiles, getSchemaFileList } from "@/lib/es-context";
import { executeESQuery } from "@/lib/es-client";
import {
  getConversation,
  loadMessages,
  sliceFromLatestCompaction,
  appendMessage,
  type DbMessage,
} from "@/lib/conversation";
import { maybeCompact } from "@/lib/compaction";
import { generateTitle } from "@/lib/title";

export const maxDuration = 120;

const validModelIds = new Set(MODELS.map((m) => m.id));
const requestSchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1),
  model: z.string().refine((id) => validModelIds.has(id), "Invalid model ID"),
});

const PROVIDER_KEY_MAP = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  qwen: "DASHSCOPE_API_KEY",
} as const;

function getLanguageModel(modelId: string) {
  const config = getModelConfig(modelId);
  const envKey = PROVIDER_KEY_MAP[config.provider];
  const apiKey = process.env[envKey];
  if (!apiKey) throw new Error(`API key not configured for ${config.name}. Set ${envKey} in .env.local`);

  switch (config.provider) {
    case "anthropic": return createAnthropic({ apiKey })(config.modelId);
    case "openai": return createOpenAI({ apiKey })(config.modelId);
    case "google": return createGoogleGenerativeAI({ apiKey })(config.modelId);
    case "qwen":
      return createOpenAI({
        apiKey,
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      })(config.modelId);
  }
}

function buildSystemPrompt(compaction: DbMessage | null): string {
  const schemaIds = getSchemaFileList();
  const base = `You are Rubick, a data assistant for Rumah123 and iProperty. You help users query and analyze data from Elasticsearch indices.

You have two tools:
1. **get_schema** — Load detailed field documentation for specific indices. Call this FIRST before querying to learn exact field names, types, and enum values. Available schemas: ${schemaIds.join(", ")}
2. **execute_es_query** — Execute an Elasticsearch query.

Workflow:
1. Read the index overview below to identify which indices you need
2. Call get_schema to load their detailed schemas (typically 1-3 indices)
3. Call execute_es_query with accurate field names from the schema
4. Present results clearly with tables, bold numbers, and concise summaries

For simple queries using only fields listed in the "Key Fields per Index" table below (e.g., count by date, filter by status), you may skip get_schema and query directly.

Important guidelines:
- Always briefly explain your plan before calling tools.
- Between tool calls, briefly explain what you found and what you'll do next.
- Use "filter" context in bool queries for exact matches (faster, cacheable).
- Always exclude deleted records with instance_info.is_removed: false where applicable.
- For active listings, filter by status: "1".
- For agents, filter by type.value: 1.
- Use .keyword suffix for exact string matches on text fields.
- Prices are in IDR (Indonesian Rupiah) for Rumah123, SGD for iProperty.
- When showing prices, format them readably (e.g., "1.5B IDR" instead of "1500000000").
- Keep your answers concise and data-driven.
- ALWAYS use markdown pipe table syntax for tabular data.

---

${getSlimContext()}`;

  if (!compaction) return base;

  return `${base}

---

## Earlier conversation summary

${compaction.content}`;
}

/** Build ai-sdk ModelMessages from DB rows (excluding the compaction). */
function dbToModelMessages(rows: DbMessage[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const r of rows) {
    if (r.role === "compaction") continue;
    if (r.role === "user") {
      out.push({ role: "user", content: r.content ?? "" });
      continue;
    }
    if (r.role === "assistant") {
      const content: Array<
        { type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
      > = [];
      if (r.content) content.push({ type: "text", text: r.content });
      if (Array.isArray(r.tool_calls)) {
        for (const tc of r.tool_calls as Array<{ id: string; name: string; args: unknown }>) {
          content.push({ type: "tool-call", toolCallId: tc.id, toolName: tc.name, input: tc.args });
        }
      }
      out.push({ role: "assistant", content });
      continue;
    }
    if (r.role === "tool") {
      out.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: r.tool_call_id!,
            toolName: r.tool_name!,
            output: { type: "json", value: r.content ? JSON.parse(r.content) : null },
          },
        ],
      });
    }
  }
  return out;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const { conversationId, message, model: modelId } = parsed.data;

  const conv = await getConversation(conversationId, session.user.id);
  if (!conv) return new Response("Conversation not found", { status: 404 });

  // Persist the incoming user message first
  await appendMessage({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  // Compact if over threshold
  await maybeCompact(conversationId, modelId);

  // Reload effective window
  const all = await loadMessages(conversationId);
  const effective = sliceFromLatestCompaction(all);
  const compaction = effective[0]?.role === "compaction" ? effective[0] : null;
  const tail = compaction ? effective.slice(1) : effective;

  let languageModel;
  try {
    languageModel = getLanguageModel(modelId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Model not available";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const modelMessages = dbToModelMessages(tail);

  const result = streamText({
    model: languageModel,
    system: buildSystemPrompt(compaction),
    messages: modelMessages,
    tools: {
      get_schema: {
        description:
          "Load detailed schema documentation for specific Elasticsearch indices. Call this BEFORE execute_es_query to learn exact field names, types, .keyword suffixes, and enum values. Request only the indices you need (typically 1-3).",
        inputSchema: z.object({
          indices: z.array(z.string()).describe(
            "Array of index identifiers, e.g. ['enquiries', 'users']. Valid values: " +
              getSchemaFileList().join(", ")
          ),
        }),
        execute: async ({ indices }: { indices: string[] }) => {
          const content = getSchemaFiles(indices);
          return { schemas: content };
        },
      },
      execute_es_query: {
        description:
          "Execute an Elasticsearch query against the Rumah123/iProperty cluster.",
        inputSchema: z.object({
          index: z.string(),
          query: z.record(z.string(), z.unknown()),
        }),
        execute: async ({ index, query }: { index: string; query: Record<string, unknown> }) => {
          try {
            const esResult = await executeESQuery(index, query);
            const hits = (esResult.hits as Record<string, unknown>) || {};
            const total = hits.total;
            const hitsArray = (hits.hits as Array<Record<string, unknown>>) || [];
            return {
              total,
              hits_count: hitsArray.length,
              hits: hitsArray.slice(0, 20).map((h) => ({ _id: h._id, _source: h._source })),
              aggregations: esResult.aggregations || null,
            };
          } catch (error) {
            const esError = error instanceof Error ? error.message : String(error);
            const isPermission = esError.includes("not permitted");
            return {
              error: isPermission
                ? "That index is not available for querying."
                : "Failed to execute Elasticsearch query. Please try a different query.",
            };
          }
        },
      },
    },
    stopWhen: stepCountIs(20),
    onStepFinish: async ({ text, toolCalls, toolResults, finishReason }) => {
      // Persist assistant step (text + tool_calls) if there is anything
      if (text || (toolCalls && toolCalls.length > 0)) {
        const formattedCalls = toolCalls?.map((tc) => ({
          id: tc.toolCallId,
          name: tc.toolName,
          args: tc.input,
        }));
        await appendMessage({
          conversation_id: conversationId,
          role: "assistant",
          content: text || null,
          tool_calls: formattedCalls && formattedCalls.length > 0 ? formattedCalls : null,
          metadata: { model: modelId, finishReason },
        });
      }
      // Persist each tool result
      if (toolResults) {
        for (const tr of toolResults) {
          await appendMessage({
            conversation_id: conversationId,
            role: "tool",
            content: JSON.stringify(tr.output),
            tool_call_id: tr.toolCallId,
            tool_name: tr.toolName,
          });
        }
      }
    },
    onFinish: async () => {
      // Kick title generation on first complete turn
      if (conv.title === "New chat") {
        const rows = await loadMessages(conversationId);
        const firstUser = rows.find((r) => r.role === "user");
        const firstAssistant = rows.find((r) => r.role === "assistant" && r.content);
        if (firstUser && firstAssistant) {
          // fire-and-forget; do not await
          void generateTitle({
            conversationId,
            firstUserMessage: firstUser.content ?? "",
            firstAssistantMessage: firstAssistant.content ?? "",
          });
        }
      }
    },
  });

  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 0 };
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "finish-step") {
        const input = part.usage.inputTokens ?? 0;
        const output = part.usage.outputTokens ?? 0;
        usage.inputTokens += input;
        usage.outputTokens += output;
        usage.totalTokens += input + output;
        usage.steps += 1;
        return { usage: { ...usage }, model: modelId };
      }
      if (part.type === "start") return { usage: null, model: modelId };
      return undefined;
    },
  });
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors in `src/app/api/chat/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(chat): conversationId-based route with DB persistence and compaction"
```

---

## Task 15: Route restructure — move chat UI to /c/[id]

**Files:**
- Create: `src/app/c/[id]/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the conversation page**

```tsx
// src/app/c/[id]/page.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ModelSelector } from "@/components/model-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Sidebar } from "@/components/chat/sidebar";
import { DEFAULT_MODEL } from "@/lib/models";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const router = useRouter();

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelsReady, setModelsReady] = useState(false);
  const [input, setInput] = useState("");
  const [initialMessages, setInitialMessages] = useState<unknown[] | null>(null);
  const [title, setTitle] = useState("New chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  // Load history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) {
        router.push("/");
        return;
      }
      const body = await res.json();
      if (cancelled) return;
      setInitialMessages(body.messages);
      setTitle(body.conversation.title);
      setModel(body.conversation.model);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, router]);

  const modelRef = useRef(model);
  modelRef.current = model;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId,
          model: modelRef.current,
          // useChat passes the latest user message automatically via `messages` in body;
          // we override to send only the new user text via a custom fetch path below.
        }),
        prepareSendMessagesRequest({ messages, body }) {
          const last = messages[messages.length - 1];
          const text = last?.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") ?? "";
          return { body: { ...body, message: text } };
        },
      }),
    [conversationId]
  );

  const { messages, sendMessage, stop, status, error, setMessages } = useChat({
    transport,
  });

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages as Parameters<typeof setMessages>[0]);
  }, [initialMessages, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUp.current = distanceFromBottom > 100;
  }, []);

  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUp.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function onSubmit() {
    if (!modelsReady) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="h-full flex">
      <Sidebar activeId={conversationId} />
      <div className="flex-1 flex flex-col">
        <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#E5E3DC] dark:border-[#333333] bg-[#FAFAF8] dark:bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-base font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] hover:opacity-70 transition-opacity"
            >
              Rubick
            </button>
            <span className="text-sm text-[#6B6B6B] truncate max-w-[320px]">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector value={model} onChange={setModel} onModelsLoaded={() => setModelsReady(true)} />
            <ThemeToggle />
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-lg text-[#6B6B6B] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors"
              >
                Logout
              </button>
            </form>
          </div>
        </header>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isLoading && idx === messages.length - 1}
              />
            ))}
            {isLoading &&
              messages.length > 0 &&
              messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
                    <div className="animate-spin h-3 w-3 border border-[#D97706] border-t-transparent rounded-full" />
                    Thinking...
                  </div>
                </div>
              )}
            {error && (
              <div className="flex justify-start">
                <div className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
                  {error.message || "Something went wrong"}
                </div>
              </div>
            )}
          </div>
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
          isLoading={isLoading}
          onStop={stop}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite src/app/page.tsx as new-chat launcher**

Overwrite `src/app/page.tsx`:

```tsx
// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ModelSelector } from "@/components/model-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatInput } from "@/components/chat/chat-input";
import { Welcome } from "@/components/chat/welcome";
import { Sidebar } from "@/components/chat/sidebar";
import { DEFAULT_MODEL } from "@/lib/models";

export default function NewChatPage() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelsReady, setModelsReady] = useState(false);
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("rubick-model");
    if (stored) setModel(stored);
  }, []);

  function handleModelChange(newModel: string) {
    setModel(newModel);
    localStorage.setItem("rubick-model", newModel);
  }

  async function startConversation(text: string) {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const { id } = await res.json();
      // Stash the first message so /c/[id] can send it immediately
      sessionStorage.setItem(`rubick-first-message:${id}`, text);
      router.push(`/c/${id}`);
    } catch (err) {
      setCreating(false);
      alert(err instanceof Error ? err.message : "Failed to start chat");
    }
  }

  async function onSubmit() {
    if (!modelsReady) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    await startConversation(text);
  }

  async function handleExampleSelect(question: string) {
    if (!modelsReady) return;
    await startConversation(question);
  }

  return (
    <div className="h-full flex">
      <Sidebar activeId={null} />
      <div className="flex-1 flex flex-col">
        <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#E5E3DC] dark:border-[#333333] bg-[#FAFAF8] dark:bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Rubick
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector value={model} onChange={handleModelChange} onModelsLoaded={() => setModelsReady(true)} />
            <ThemeToggle />
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-lg text-[#6B6B6B] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors"
              >
                Logout
              </button>
            </form>
          </div>
        </header>

        <Welcome onSelect={handleExampleSelect} />

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
          isLoading={creating}
          onStop={() => {}}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add first-message handoff effect in /c/[id]**

In `src/app/c/[id]/page.tsx`, *add* a second `useEffect` immediately after the history-load effect created in Step 1 (do not modify or remove the first one):

```tsx
  // Auto-send first message if handed off from /
  useEffect(() => {
    if (!modelsReady || !initialMessages) return;
    const key = `rubick-first-message:${conversationId}`;
    const pending = sessionStorage.getItem(key);
    if (pending && initialMessages.length === 0) {
      sessionStorage.removeItem(key);
      sendMessage({ text: pending });
    }
  }, [modelsReady, initialMessages, conversationId, sendMessage]);
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/c
git commit -m "feat(ui): route chat UI to /c/[id], new-chat launcher at /"
```

---

## Task 16: Sidebar component

**Files:**
- Create: `src/components/chat/sidebar.tsx`

- [ ] **Step 1: Write the sidebar**

```tsx
// src/components/chat/sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Conv = { id: string; title: string; model: string; updated_at: string };

export function Sidebar({ activeId }: { activeId: string | null }) {
  const [items, setItems] = useState<Conv[]>([]);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, [activeId]);

  return (
    <aside className="w-60 shrink-0 border-r border-[#E5E3DC] dark:border-[#333333] bg-[#FAFAF8] dark:bg-[#1A1A1A] flex flex-col">
      <div className="p-3">
        <Link
          href="/"
          className="block text-sm px-3 py-2 rounded-lg border border-[#E5E3DC] dark:border-[#333333] text-[#1A1A1A] dark:text-[#E8E8E8] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors text-center"
        >
          + New chat
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.id}`}
            className={`block text-sm px-3 py-2 rounded-md truncate transition-colors ${
              c.id === activeId
                ? "bg-[#F0EDE8] dark:bg-[#333333] text-[#1A1A1A] dark:text-[#E8E8E8]"
                : "text-[#6B6B6B] hover:bg-[#F0EDE8]/60 dark:hover:bg-[#333333]/60"
            }`}
          >
            {c.title}
          </Link>
        ))}
        {items.length === 0 && (
          <div className="px-3 py-2 text-xs text-[#6B6B6B]">No conversations yet.</div>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/sidebar.tsx
git commit -m "feat(ui): conversation sidebar"
```

---

## Task 17: Compaction divider + MessageBubble integration

**Files:**
- Create: `src/components/chat/compaction-divider.tsx`
- Modify: `src/components/chat/message-bubble.tsx`

- [ ] **Step 1: Read current message-bubble.tsx to understand the part-rendering shape**

Run: `cat src/components/chat/message-bubble.tsx`

- [ ] **Step 2: Write the divider component**

```tsx
// src/components/chat/compaction-divider.tsx
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function CompactionDivider({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E5E3DC] dark:bg-[#333333]" />
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors"
        >
          {open ? "Hide" : "View"} earlier context summary
        </button>
        <div className="flex-1 h-px bg-[#E5E3DC] dark:bg-[#333333]" />
      </div>
      {open && (
        <div className="mt-4 p-4 rounded-lg bg-[#F0EDE8] dark:bg-[#1F1F1F] text-sm text-[#1A1A1A] dark:text-[#E8E8E8] prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into MessageBubble**

In `src/components/chat/message-bubble.tsx`, add an import and a branch for `part.type === "compaction"`. Locate where parts are rendered and add:

```tsx
import { CompactionDivider } from "@/components/chat/compaction-divider";

// ...inside the parts map:
if (part.type === "compaction") {
  return <CompactionDivider key={i} summary={part.text} />;
}
```

(Exact placement depends on the existing render switch — keep it in the same if/else chain as other part types.)

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/compaction-divider.tsx src/components/chat/message-bubble.tsx
git commit -m "feat(ui): compaction divider in transcript"
```

---

## Task 18: Admin invite endpoint

**Files:**
- Create: `src/app/api/admin/invites/route.ts`

- [ ] **Step 1: Write the endpoint**

```ts
// src/app/api/admin/invites/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth.config";
import { sql } from "@/lib/db";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  await sql`
    INSERT INTO invites (email, invited_by)
    VALUES (${email}, ${session.user.id})
    ON CONFLICT (email) DO NOTHING
  `;
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/invites
git commit -m "feat(auth): admin-only invite creation endpoint"
```

---

## Task 19: Manual E2E verification

**Files:** none

- [ ] **Step 1: Start dev server with required env**

Ensure `.env.local` has all vars from the header of this plan. Then:

```bash
npm run dev
```

- [ ] **Step 2: Sign in as admin**

Open `http://localhost:3000`. Expected: redirects to `/login`. Click "Continue with Google" as `erwin@99.co`. Expected: returns to `/` with the new-chat launcher.

- [ ] **Step 3: Start a new conversation**

Type "How many enquiries in April 2026?" and submit. Expected: redirects to `/c/<id>`, streams assistant response, shows sidebar with new entry.

- [ ] **Step 4: Verify DB persistence**

```bash
psql "$DATABASE_URL" -c "SELECT id, role, LEFT(content, 60) AS preview FROM messages ORDER BY id;"
```

Expected: user row + assistant row(s) + any tool rows, each with content populated.

- [ ] **Step 5: Verify title generated**

Refresh sidebar. Expected: title is no longer "New chat" but a descriptive title (e.g. "April 2026 Enquiry Volume").

- [ ] **Step 6: Verify resume**

Close the tab, reopen `/c/<id>`. Expected: full history rehydrates from the API; next question continues in-context.

- [ ] **Step 7: Verify invite gate rejects a non-invited user**

In an incognito window, visit `/login` and sign in with a Google account that is neither `erwin@99.co` nor in `invites`. Expected: redirect back to `/login?error=...` with "This app is invite-only" banner.

- [ ] **Step 8: Verify invite flow**

```bash
psql "$DATABASE_URL" -c "INSERT INTO invites (email, invited_by) VALUES ('colleague@99.co', 'u_admin_bootstrap');"
```

Sign in as `colleague@99.co`. Expected: succeeds, row appears in `users` with `role='member'`, invite `consumed_at` set.

- [ ] **Step 9: Verify compaction fires (optional stress test)**

Lower `COMPACTION_THRESHOLD.qwen` temporarily to `3000` in `src/lib/compaction.ts`, restart dev, send a few turns, then check:

```bash
psql "$DATABASE_URL" -c "SELECT id, role, LEFT(content, 80) FROM messages WHERE role='compaction';"
```

Expected: at least one compaction row exists with the sectioned markdown skeleton. Revert the threshold. Commit revert.

- [ ] **Step 10: Run unit tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 12: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 13: Tag the milestone**

```bash
git tag v0.2.0-conversation-history
```

---

## Done criteria

- [ ] A logged-in user can start a conversation, reload, and continue it.
- [ ] Sidebar lists all of that user's conversations, most recent first.
- [ ] Titles auto-generate after the first assistant turn.
- [ ] Compaction inserts a `messages` row with `role='compaction'` once the token threshold is crossed, without breaking tool-pair atomicity.
- [ ] Non-invited Google sign-ins are rejected with a friendly message.
- [ ] `erwin@99.co` has admin role and can create invites via `POST /api/admin/invites`.
- [ ] All unit tests pass; type-check passes; lint passes.
