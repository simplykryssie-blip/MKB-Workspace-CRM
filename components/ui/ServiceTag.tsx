import { SERVICES, type ServiceKey } from "@/lib/sample-data";

const soft: Record<ServiceKey, string> = {
  tax: "bg-svc-tax-soft",
  books: "bg-svc-books-soft",
  biz: "bg-svc-biz-soft",
  expunge: "bg-svc-expunge-soft",
};
const dot: Record<ServiceKey, string> = {
  tax: "bg-svc-tax",
  books: "bg-svc-books",
  biz: "bg-svc-biz",
  expunge: "bg-svc-expunge",
};

/** Service identity chip — color dot carries identity, text stays in ink. */
export function ServiceTag({ service, short = false }: { service: ServiceKey; short?: boolean }) {
  const s = SERVICES[service];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium text-ink-2 ${soft[service]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[service]}`} />
      {short ? s.short : s.label}
    </span>
  );
}

export const serviceDotClass = dot;
