"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { currentUser } from "@/lib/sample-data";

export function Greeting() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const h = now?.getHours() ?? 9;
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[30px]">
          Good {part}, {currentUser.name}
        </h1>
        <p className="mt-1 text-[14px] text-muted sm:text-[15px]">Here&rsquo;s what&rsquo;s happening at MKB Financial Group today.</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px] font-medium text-ink-2 shadow-soft">
        <CalendarDays size={16} className="text-accent" />
        <span suppressHydrationWarning>
          {now ? now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : " "}
        </span>
      </div>
    </div>
  );
}
