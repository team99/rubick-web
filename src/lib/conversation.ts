// src/lib/conversation.ts
import { sql, type Db } from "@/lib/db";
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

export async function createConversation(
  userId: string,
  model: string,
  db: Db = sql
): Promise<DbConversation> {
  const id = `c_${nanoid(16)}`;
  const [row] = await db<DbConversation[]>`
    INSERT INTO conversations (id, user_id, model)
    VALUES (${id}, ${userId}, ${model})
    RETURNING *
  `;
  return row;
}

export async function listConversations(
  userId: string,
  db: Db = sql
): Promise<DbConversation[]> {
  return db<DbConversation[]>`
    SELECT * FROM conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 200
  `;
}

export async function getConversation(
  id: string,
  userId: string,
  db: Db = sql
): Promise<DbConversation | null> {
  const [row] = await db<DbConversation[]>`
    SELECT * FROM conversations WHERE id = ${id} AND user_id = ${userId} LIMIT 1
  `;
  return row ?? null;
}

export async function loadMessages(
  conversationId: string,
  db: Db = sql
): Promise<DbMessage[]> {
  return db<DbMessage[]>`
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

export async function appendMessage(
  m: {
    conversation_id: string;
    role: DbMessage["role"];
    content?: string | null;
    tool_calls?: unknown;
    tool_call_id?: string | null;
    tool_name?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  db: Db = sql
): Promise<DbMessage | null> {
  // ON CONFLICT handles SDK retries re-inserting the same tool result row.
  // idx_msg_tool_result is a UNIQUE partial index on (conversation_id, tool_call_id)
  // WHERE tool_call_id IS NOT NULL.
  const rows = await db<DbMessage[]>`
    INSERT INTO messages (conversation_id, role, content, tool_calls, tool_call_id, tool_name, metadata)
    VALUES (${m.conversation_id}, ${m.role}, ${m.content ?? null},
            ${m.tool_calls ? db.json(m.tool_calls as never) : null},
            ${m.tool_call_id ?? null}, ${m.tool_name ?? null},
            ${m.metadata ? db.json(m.metadata as never) : null})
    ON CONFLICT (conversation_id, tool_call_id)
      WHERE tool_call_id IS NOT NULL
      DO NOTHING
    RETURNING *
  `;
  if (rows.length === 0) return null; // duplicate tool result suppressed
  await db`UPDATE conversations SET updated_at = now() WHERE id = ${m.conversation_id}`;
  return rows[0];
}

export async function setTitle(
  conversationId: string,
  title: string,
  db: Db = sql
): Promise<void> {
  await db`
    UPDATE conversations SET title = ${title}
    WHERE id = ${conversationId} AND title = 'New chat'
  `;
}
