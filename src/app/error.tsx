"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center bg-[#FAFAF8] dark:bg-[#1A1A1A]">
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-[#6B6B6B] dark:text-[#999999] mb-4">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-[#1A1A1A] dark:bg-[#E8E8E8] text-white dark:text-[#1A1A1A] text-sm hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
