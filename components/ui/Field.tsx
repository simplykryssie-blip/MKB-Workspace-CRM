"use client";

const input =
  "w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

export function Label({ children, required, hint }: { children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
      <span>
        {children} {required && <span className="text-danger">*</span>}
      </span>
      {hint && <span className="text-[11.5px] font-normal text-muted">{hint}</span>}
    </span>
  );
}

export function TextField({ label, required, hint, ...rest }: { label: string; required?: boolean; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <Label required={required} hint={hint}>{label}</Label>
      <input required={required} className={`${input} h-10`} {...rest} />
    </label>
  );
}

export function TextArea({ label, required, ...rest }: { label: string; required?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <textarea required={required} className={`${input} resize-none py-2.5`} rows={3} {...rest} />
    </label>
  );
}

export function SelectField({ label, required, options, ...rest }: { label: string; required?: boolean; options: [string, string][] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <select required={required} className={`${input} h-10 pr-8`} {...rest}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({ label, hint, ...rest }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 hover:bg-surface-hover">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" {...rest} />
      <span>
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {hint && <span className="block text-[12.5px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}
