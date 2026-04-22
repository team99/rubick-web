// src/app/api/conversations/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
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
