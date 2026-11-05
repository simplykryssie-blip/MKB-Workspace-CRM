"use client";

import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { Label } from "@/components/ui/Field";
import {
  RESPONSIBLE_PARTY_TITLES,
  US_STATES,
  detectTaxIdType,
  formatDOB,
  formatEIN,
  formatPhone,
  formatTaxId,
  formatZip,
  normalizeEmail,
  tidyLine,
  validateAddress,
  validateDOB,
  validateEIN,
  validateEmail,
  validatePhone,
  validateTaxId,
  type Address,
  type TaxIdType,
} from "@/lib/validation";

const base =
  "h-10 w-full rounded-xl border bg-surface px-3 text-[14px] text-ink placeholder:text-faint focus:outline-none focus:ring-4";
const ok = "border-line focus:border-accent focus:ring-accent/15";
const err = "border-danger focus:border-danger focus:ring-danger/15";

/**
 * Error line with a reserved slot: the space is always there, so an error
 * appearing on blur never shifts the layout (a shift mid-click makes the
 * user's next click land on the wrong element).
 */
function ErrorText({ id, msg }: { id: string; msg?: string | null }) {
  return (
    <p id={id} className="mt-1 flex min-h-4 items-start gap-1 text-[12px] leading-4 text-danger-ink" role={msg ? "alert" : undefined}>
      {msg && (
        <>
          <AlertCircle size={12} className="mt-0.5 shrink-0" /> {msg}
        </>
      )}
    </p>
  );
}

type Common = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
  /** Force errors visible (e.g. after a submit attempt). */
  showErrors?: boolean;
};

function useTouched(showErrors?: boolean) {
  const [touched, setTouched] = useState(false);
  return { show: touched || !!showErrors, touch: () => setTouched(true) };
}

/** Generic masked text input: formats on every keystroke, validates on blur. */
function MaskedInput({
  id, label, value, onChange, required, hint, showErrors, format, validate, placeholder, inputMode = "numeric", autoComplete = "off", type = "text", onBlurValue, children, sensitive,
}: Common & {
  format: (v: string) => string;
  validate: (v: string) => string | null;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  type?: string;
  onBlurValue?: (v: string) => string;
  children?: React.ReactNode;
  sensitive?: boolean;
}) {
  const { show, touch } = useTouched(showErrors);
  const e = show ? validate(value) : null;
  return (
    <div>
      <label htmlFor={id}>
        <Label required={required} hint={hint}>
          <span className="inline-flex items-center gap-1">{sensitive && <Lock size={12} className="text-muted" />}{label}</span>
        </Label>
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          inputMode={inputMode}
          autoComplete={autoComplete}
          spellCheck={false}
          placeholder={placeholder}
          aria-invalid={!!e}
          aria-describedby={`${id}-err`}
          onChange={(ev) => onChange(format(ev.target.value))}
          onBlur={() => {
            touch();
            if (onBlurValue) onChange(onBlurValue(value));
          }}
          className={`${base} ${e ? err : ok} ${children ? "pr-10" : ""} tabular-nums`}
        />
        {children}
      </div>
      <ErrorText id={`${id}-err`} msg={e} />
    </div>
  );
}

export function PhoneInput(p: Common) {
  return <MaskedInput {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 010-0000" format={formatPhone} validate={(v) => validatePhone(v, p.required)} />;
}

export function EmailInput(p: Common) {
  return (
    <MaskedInput
      {...p}
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder="name@example.com"
      format={(v) => v.replace(/\s/g, "")}
      onBlurValue={normalizeEmail}
      validate={(v) => validateEmail(v, p.required)}
    />
  );
}

export function DOBInput(p: Common) {
  return <MaskedInput {...p} sensitive placeholder="MM/DD/YYYY" autoComplete="bday" format={formatDOB} validate={(v) => validateDOB(v, p.required)} />;
}

export function EINInput(p: Common) {
  const [visible, setVisible] = useState(false);
  return (
    <MaskedInput {...p} sensitive type={visible ? "text" : "password"} placeholder="12-3456789" format={formatEIN} validate={(v) => validateEIN(v, p.required)}>
      <RevealToggle visible={visible} onToggle={() => setVisible((x) => !x)} label="EIN" />
    </MaskedInput>
  );
}

/** SSN / ITIN with type selector; auto-switches to ITIN when the number starts with 9. */
export function TaxIdInput(p: Common & { type: TaxIdType; onTypeChange: (t: TaxIdType) => void }) {
  const [visible, setVisible] = useState(false);
  const { type, onTypeChange, ...rest } = p;
  return (
    <div>
      <MaskedInput
        {...rest}
        sensitive
        label={rest.label}
        type={visible ? "text" : "password"}
        placeholder={type === "ITIN" ? "9XX-XX-XXXX" : "123-45-6789"}
        format={(v) => {
          const f = formatTaxId(v);
          if (f.length >= 1) {
            const t = detectTaxIdType(f);
            if (t !== type) onTypeChange(t);
          }
          return f;
        }}
        validate={(v) => validateTaxId(v, type, rest.required)}
      >
        <RevealToggle visible={visible} onToggle={() => setVisible((x) => !x)} label={type} />
      </MaskedInput>
      <div role="radiogroup" aria-label="Taxpayer ID type" className="flex gap-1.5">
        {(["SSN", "ITIN"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => onTypeChange(t)}
            className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${type === t ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted hover:bg-surface-hover"}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function RevealToggle({ visible, onToggle, label }: { visible: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label}` : `Show ${label}`} title={visible ? "Hide" : "Show while typing"} className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink">
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

/* ------------------------ Responsible party ------------------------ */

/** IRS "responsible party" for a business: the individual who controls the entity. */
export function ResponsiblePartyFields({
  idPrefix, required, name, onName, title, onTitle, taxId, onTaxId, taxIdType, onTaxIdType, showErrors, taxIdHint, onCopyContact,
}: {
  idPrefix: string;
  required?: boolean;
  name: string;
  onName: (v: string) => void;
  title: string;
  onTitle: (v: string) => void;
  taxId: string;
  onTaxId: (v: string) => void;
  taxIdType: TaxIdType;
  onTaxIdType: (t: TaxIdType) => void;
  showErrors?: boolean;
  taxIdHint?: string;
  onCopyContact?: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const nameErr = (touched || showErrors) && required && !name.trim() ? "Responsible party name is required" : null;
  return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-1 text-[13px] font-semibold text-ink-2">Responsible party</legend>
      <p className="mb-3 text-[12.5px] text-muted">
        The individual who owns or controls the business (IRS Form SS-4).{" "}
        {onCopyContact && (
          <button type="button" onClick={onCopyContact} className="font-semibold text-accent">
            Same as primary contact
          </button>
        )}
      </p>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-name`}>
            <Label required={required}>Full legal name</Label>
          </label>
          <input
            id={`${idPrefix}-name`}
            value={name}
            autoComplete="off"
            aria-invalid={!!nameErr}
            onChange={(e) => onName(e.target.value)}
            onBlur={() => {
              setTouched(true);
              onName(name.replace(/\s+/g, " ").trim());
            }}
            className={`${base} ${nameErr ? err : ok}`}
          />
          <ErrorText id={`${idPrefix}-name-err`} msg={nameErr} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-title`}>
            <Label>Title</Label>
          </label>
          <select id={`${idPrefix}-title`} value={title} onChange={(e) => onTitle(e.target.value)} className={`${base} ${ok} pr-8`}>
            {RESPONSIBLE_PARTY_TITLES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <ErrorText id={`${idPrefix}-title-err`} />
        </div>
        <TaxIdInput id={`${idPrefix}-taxid`} label={`${taxIdType}`} hint={taxIdHint} required={required} value={taxId} onChange={onTaxId} type={taxIdType} onTypeChange={onTaxIdType} showErrors={showErrors} />
      </div>
    </fieldset>
  );
}

/* ----------------------------- Address ----------------------------- */

export function AddressFields({
  idPrefix,
  value,
  onChange,
  required,
  showErrors,
}: {
  idPrefix: string;
  value: Address;
  onChange: (a: Address) => void;
  required?: boolean;
  showErrors?: boolean;
}) {
  const [touched, setTouched] = useState<Partial<Record<keyof Address, boolean>>>({});
  const errors = validateAddress(value, required);
  const showErr = (k: keyof Address) => (touched[k] || showErrors ? errors[k] : undefined);
  const set = (k: keyof Address, v: string) => onChange({ ...value, [k]: v });
  const blur = (k: keyof Address, tidy = false) => {
    setTouched((t) => ({ ...t, [k]: true }));
    if (tidy) onChange({ ...value, [k]: tidyLine(value[k] ?? "") });
  };
  const field = (k: keyof Address, label: string, opts: { placeholder?: string; autoComplete?: string; req?: boolean; tidy?: boolean } = {}) => (
    <div>
      <label htmlFor={`${idPrefix}-${k}`}>
        <Label required={opts.req}>{label}</Label>
      </label>
      <input
        id={`${idPrefix}-${k}`}
        value={value[k] ?? ""}
        autoComplete={opts.autoComplete}
        placeholder={opts.placeholder}
        aria-invalid={!!showErr(k)}
        onChange={(e) => set(k, e.target.value)}
        onBlur={() => blur(k, opts.tidy)}
        className={`${base} ${showErr(k) ? err : ok}`}
      />
      <ErrorText id={`${idPrefix}-${k}-err`} msg={showErr(k)} />
    </div>
  );
  return (
    <div className="grid gap-x-4 gap-y-1 sm:grid-cols-6">
      <div className="sm:col-span-4">{field("line1", "Street address", { placeholder: "123 Example St", autoComplete: "address-line1", req: required, tidy: true })}</div>
      <div className="sm:col-span-2">{field("line2", "Apt / suite", { placeholder: "Apt 4", autoComplete: "address-line2", tidy: true })}</div>
      <div className="sm:col-span-3">{field("city", "City", { autoComplete: "address-level2", req: required, tidy: true })}</div>
      <div className="sm:col-span-1">
        <label htmlFor={`${idPrefix}-state`}>
          <Label required={required}>State</Label>
        </label>
        <select
          id={`${idPrefix}-state`}
          value={value.state}
          autoComplete="address-level1"
          aria-invalid={!!showErr("state")}
          onChange={(e) => set("state", e.target.value)}
          onBlur={() => blur("state")}
          className={`${base} ${showErr("state") ? err : ok} pr-6`}
        >
          <option value="">—</option>
          {US_STATES.map(([code, name]) => (
            <option key={code} value={code} title={name}>
              {code}
            </option>
          ))}
        </select>
        <ErrorText id={`${idPrefix}-state-err`} msg={showErr("state")} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-zip`}>
          <Label required={required}>ZIP</Label>
        </label>
        <input
          id={`${idPrefix}-zip`}
          value={value.zip}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="12345"
          aria-invalid={!!showErr("zip")}
          onChange={(e) => set("zip", formatZip(e.target.value))}
          onBlur={() => blur("zip")}
          className={`${base} ${showErr("zip") ? err : ok} tabular-nums`}
        />
        <ErrorText id={`${idPrefix}-zip-err`} msg={showErr("zip")} />
      </div>
    </div>
  );
}
