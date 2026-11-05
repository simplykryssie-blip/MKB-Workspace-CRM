"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type MenuItem = { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; disabled?: boolean } | "divider";

/** Dropdown menu with keyboard support (Escape closes, arrow keys move). */
export function Menu({ trigger, items, align = "right", label }: { trigger: (p: { open: boolean; toggle: () => void }) => React.ReactNode; items: MenuItem[]; align?: "left" | "right"; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        btns[(i + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length]?.focus();
      }
    };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", key);
    setTimeout(() => ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus(), 10);
    return () => {
      document.removeEventListener("mousedown", off);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div role="menu" aria-label={label} className={`absolute z-50 mt-1.5 min-w-[210px] rounded-xl border border-line bg-surface p-1.5 shadow-pop ${align === "right" ? "right-0" : "left-0"}`}>
          {items.map((it, i) =>
            it === "divider" ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] disabled:opacity-40 ${it.danger ? "text-danger hover:bg-danger-soft" : "text-ink-2 hover:bg-surface-hover hover:text-ink"} focus:bg-surface-hover focus:outline-none`}
              >
                {it.icon && <it.icon size={16} />}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
