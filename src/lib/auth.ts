import { cookies } from "next/headers";
import crypto from "crypto";

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

export function getAuthToken(): string {
  const password = getPassword();
  return crypto
    .createHmac("sha256", "rubick-session-key")
    .update(password)
    .digest("hex");
}

export function validatePassword(input: string): boolean {
  return input === getPassword();
}

export async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  return token === getAuthToken();
}

export function verifyAuthToken(token: string | undefined): boolean {
  if (!token) return false;
  return token === getAuthToken();
}

export function getAuthCookieConfig() {
  return {
    name: AUTH_COOKIE,
    value: getAuthToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  };
}

export const AUTH_COOKIE_NAME = AUTH_COOKIE;
