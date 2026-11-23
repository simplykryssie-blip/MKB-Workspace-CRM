"use client";

import { useEffect } from "react";
import { reportError } from "@/components/system/report-error";

/** A staff page crashed: say so plainly, report it, and offer a way back. The menu and the rest of the app keep working. */
export default function StaffError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error); }, [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div className="max-w-md">
        <h1 className="text-[20px] font-bold text-ink">Something went wrong on this page</h1>
        <p className="mt-2 text-[14px] text-muted">It&rsquo;s been reported so it can be fixed. Your other work is safe. Try again, or reload the page.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={() => reset()} className="rounded-xl border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:bg-surface-hover">Try again</button>
          <button onClick={() => window.location.reload()} className="rounded-xl bg-accent px-4 py-2 text-[14px] font-semibold text-white">Reload page</button>
          <a href="/dashboard" className="rounded-xl px-4 py-2 text-[14px] font-semibold text-accent hover:underline">Go to the dashboard</a>
        </div>
        {error?.message && <p className="mt-4 break-words text-[12px] text-muted">Details: {error.message.slice(0, 200)}</p>}
      </div>
    </div>
  );
}
