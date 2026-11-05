import { CreditCard, FileUp, History, MessageSquare, PenLine, ClipboardCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { activity } from "@/lib/sample-data";

const kindMeta = {
  upload: { icon: FileUp, cls: "bg-accent-soft text-accent", label: "Document" },
  payment: { icon: CreditCard, cls: "bg-success-soft text-success", label: "Payment" },
  signature: { icon: PenLine, cls: "bg-svc-books-soft text-svc-books", label: "Signature" },
  message: { icon: MessageSquare, cls: "bg-svc-expunge-soft text-svc-expunge", label: "Message" },
  intake: { icon: ClipboardCheck, cls: "bg-svc-biz-soft text-svc-biz", label: "Intake" },
} as const;

export function Activity() {
  return (
    <Card>
      <CardHeader icon={History} title="Recent client activity" subtitle="Portal uploads, payments & signatures" href="/clients" hrefLabel="All activity" />
      <ol className="relative px-5 pb-4 sm:px-6">
        {activity.map((a, i) => {
          const m = kindMeta[a.kind];
          return (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-1">
              {i < activity.length - 1 && <span className="absolute left-[17px] top-10 h-[calc(100%-32px)] w-px bg-line" aria-hidden="true" />}
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${m.cls}`} title={m.label}>
                <m.icon size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13.5px] leading-snug text-ink-2">
                  <span className="font-semibold text-ink">{a.who}</span> {a.action}{" "}
                  <span className="font-medium text-ink">{a.target}</span>
                </p>
                <p className="mt-0.5 text-[12px] text-muted">{a.when}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
