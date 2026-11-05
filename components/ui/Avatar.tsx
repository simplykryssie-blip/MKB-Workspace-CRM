import { initials as toInitials } from "@/lib/format";
import { STAFF } from "@/lib/sample/clients";

// Staff have defined initials (e.g. "MKB Owner" → MK); everyone else is derived from the name.
const initialsFor = (name: string) => STAFF.find((s) => s.name === name)?.initials ?? toInitials(name);

// Neutral-to-brand tints; picked by a stable hash so a name always gets the same color.
const TINTS = [
  "bg-accent-soft text-accent-ink",
  "bg-svc-books-soft text-ink-2",
  "bg-svc-biz-soft text-success-ink",
  "bg-svc-expunge-soft text-warning-ink",
  "bg-surface-2 text-ink-2 ring-1 ring-line",
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ name, size = 36, square = false, label }: { name: string; size?: number; square?: boolean; label?: string }) {
  return (
    <span
      title={label ?? name}
      className={`grid shrink-0 place-items-center font-semibold ${square ? "rounded-xl" : "rounded-full"} ${TINTS[hash(name) % TINTS.length]}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {initialsFor(name)}
    </span>
  );
}

export function AvatarStack({ names, size = 26 }: { names: string[]; size?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {names.map((n) => (
        <span key={n} className="rounded-full ring-2 ring-surface">
          <Avatar name={n} size={size} />
        </span>
      ))}
    </span>
  );
}
