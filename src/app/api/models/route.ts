import { NextResponse } from "next/server";
import { MODELS } from "@/lib/models";

const PROVIDER_KEY_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

export async function GET() {
  const available = MODELS.filter((m) => {
    const envKey = PROVIDER_KEY_MAP[m.provider];
    return envKey && !!process.env[envKey];
  });

  return NextResponse.json(available.map((m) => ({ id: m.id, name: m.name, provider: m.provider })));
}
