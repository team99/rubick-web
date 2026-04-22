// src/app/api/admin/invites/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  // B2: JWT role is up to 12h stale; re-read from DB to handle demotion.
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Forbidden", { status: 403 });
  const [row] = await sql<Array<{ role: string; status: string }>>`
    SELECT role, status FROM users WHERE id = ${session.user.id}
  `;
  if (row?.role !== "admin" || row?.status !== "active") {
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
