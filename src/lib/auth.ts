// src/lib/auth.ts
// NODE-ONLY: imports postgres via @/lib/db. Do NOT import this from middleware.
import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { sql } from "@/lib/db";
import { nanoid } from "nanoid";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, profile }) {
      // B6: require Google-verified email
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
      if (verified === false) return false;

      const email = user.email?.toLowerCase();
      if (!email) return false;

      // B5: run invite consumption in a transaction with row-level lock.
      return await sql.begin(async (tx) => {
        const [existing] = await tx<
          { id: string; status: string }[]
        >`SELECT id, status FROM users WHERE email = ${email} LIMIT 1`;

        if (existing) {
          if (existing.status === "disabled") return false;
          await tx`
            UPDATE users
            SET name = ${user.name ?? null},
                image_url = ${user.image ?? null},
                last_seen_at = now(),
                status = CASE WHEN status = 'invited' THEN 'active' ELSE status END
            WHERE id = ${existing.id}
          `;
          await tx`
            UPDATE invites SET consumed_at = now()
            WHERE email = ${email} AND consumed_at IS NULL
          `;
          return true;
        }

        // New user path: lock the invite row to serialize concurrent sign-ins.
        const [invite] = await tx<
          { invited_by: string }[]
        >`SELECT invited_by FROM invites
          WHERE email = ${email} AND consumed_at IS NULL
          LIMIT 1 FOR UPDATE`;

        if (!invite) return false;

        const id = `u_${nanoid(16)}`;
        await tx`
          INSERT INTO users (id, email, name, image_url, role, status, invited_by, last_seen_at)
          VALUES (${id}, ${email}, ${user.name ?? null}, ${user.image ?? null},
                  'member', 'active', ${invite.invited_by}, now())
        `;
        await tx`
          UPDATE invites SET consumed_at = now() WHERE email = ${email}
        `;
        return true;
      });
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
  },
});

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}
