import { cookies } from "next/headers";

const AUTH_COOKIE = "rubick-auth";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

function getPassword(): string {
  const password = process.env.AUTH_PASSWORD;
  if (!password) {
    throw new Error(
      "AUTH_PASSWORD environment variable is required. Set it in .env.local"
    );
  }
  return password;
}

async function computeAuthToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode("rubick-session-key"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(password)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getAuthToken(): Promise<string> {
  return computeAuthToken(getPassword());
}

export function validatePassword(input: string): boolean {
  return input === getPassword();
}

export async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  return token === (await getAuthToken());
}

export async function verifyAuthToken(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  return token === (await getAuthToken());
}

export async function getAuthCookieConfig() {
  return {
    name: AUTH_COOKIE,
    value: await getAuthToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  };
}

export const AUTH_COOKIE_NAME = AUTH_COOKIE;
