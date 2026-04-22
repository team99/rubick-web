// src/app/login/page.tsx
import { signIn } from "@/lib/auth";

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
