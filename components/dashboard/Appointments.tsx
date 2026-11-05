import { CalendarDays, MapPin, Phone, Video } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ServiceTag, serviceDotClass } from "@/components/ui/ServiceTag";
import { appointments } from "@/lib/sample-data";

const modeIcon = { Video, Phone, "In person": MapPin } as const;

export function Appointments() {
  return (
    <Card>
      <CardHeader icon={CalendarDays} title="Upcoming appointments" subtitle={`Today · ${appointments.length} scheduled`} href="/appointments" hrefLabel="Calendar" />
      <ul className="px-3 pb-3 sm:px-4">
        {appointments.map((a) => {
          const ModeIcon = modeIcon[a.mode];
          return (
            <li key={a.time} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-hover sm:gap-4">
              <span className={`h-10 w-1 shrink-0 rounded-full ${serviceDotClass[a.service]}`} />
              <div className="w-[68px] shrink-0">
                <div className="text-[13.5px] font-semibold text-ink tabular-nums">{a.time}</div>
                <div className="flex items-center gap-1 text-[11.5px] text-muted">
                  <ModeIcon size={12} /> {a.mode}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">{a.title}</div>
                <div className="truncate text-[12.5px] text-muted">{a.client}</div>
              </div>
              <div className="hidden sm:block">
                <ServiceTag service={a.service} short />
              </div>
              <span className="hidden h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-2 ring-1 ring-line md:grid" title={`Assigned: ${a.staff}`}>
                {a.staff}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
