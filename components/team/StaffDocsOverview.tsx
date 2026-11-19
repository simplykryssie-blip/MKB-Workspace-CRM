"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Settings } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { BACKEND, call } from "@/lib/sync/remote";
import type { StaffOnboarding } from "@/lib/staff/onboarding-docs";

type Data = { docs: { key: string; title: string; kind: "sign" | "upload"; required: boolean }[]; members: { id: string; name: string; email: string; status: string; onboarding: StaffOnboarding }[] };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Team → Staff documents: who has signed what, with every signed PDF one tap away. */
export function StaffDocsOverview() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (BACKEND) call<Data>("GET", "/api/team/staff-documents").then(setD).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load")); }, []);
  if (!BACKEND) return <Card className="p-8 text-center text-muted">Staff documents need the live CRM.</Card>;
  if (err) return <Card className="p-8 text-center text-muted">{err}</Card>;
  if (!d) return <Card className="p-8 text-center text-muted">Loading…</Card>;
  return (
    <Card>
      <CardHeader title="Staff documents" subtitle="Everything each team member signed or uploaded when they joined — open any signed PDF. Access stays blocked until every required document is done and their identity is confirmed." action={<Button size="sm" icon={Settings} href="/settings#staff">Edit documents</Button>} />
      {d.members.length ? (
        <ul className="border-t border-line">
          {d.members.map((m) => {
            const o = m.onboarding;
            const done = o.docs.filter((x) => x.done).length;
            return (
              <li key={m.id} className="border-b border-line px-5 py-4 last:border-0 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/team/members/${m.id}`} className="text-[15px] font-semibold text-ink hover:text-accent">{m.name}</Link>
                  <span className="text-[12.5px] text-muted">{m.email}</span>
                  <span className="ml-auto flex gap-1.5">
                    {o.complete ? <Badge tone="success">Complete</Badge> : <Badge tone="warning">{done} of {o.docs.length} done</Badge>}
                    {o.identity.verifiedAt ? <Badge tone="success">ID confirmed</Badge> : <Badge tone="neutral">ID not confirmed</Badge>}
                  </span>
                </div>
                <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {o.docs.map((x) => (
                    <li key={x.key} className="flex items-center gap-2 text-[13px]">
                      {x.done ? <CheckCircle2 size={14} className="shrink-0 text-success" /> : <Circle size={14} className="shrink-0 text-faint" />}
                      <span className="min-w-0 flex-1 truncate text-ink-2">{x.title}</span>
                      {x.done ? <a href={`/api/staff-onboarding/file/${x.done.id}`} target="_blank" rel="noreferrer" className="shrink-0 text-[12.5px] font-semibold text-accent hover:underline" title={`${x.kind === "upload" ? "Uploaded" : "Signed"} ${day(x.done.at)}`}>{day(x.done.at)}</a> : <span className="shrink-0 text-[12px] text-muted">{x.required ? "Not done" : "Optional"}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : <p className="border-t border-line px-5 py-6 text-[13.5px] text-muted sm:px-6">No team members yet besides you. When you invite someone, their signed documents show up here.</p>}
    </Card>
  );
}
