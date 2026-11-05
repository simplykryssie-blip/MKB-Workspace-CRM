export function Progress({ value, color = "var(--accent)", label }: { value: number; color?: string; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-[11.5px] font-medium text-muted tabular-nums">{value}%</span>
    </div>
  );
}
