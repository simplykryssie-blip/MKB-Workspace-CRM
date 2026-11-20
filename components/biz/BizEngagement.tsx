"use client";

import { useEffect } from "react";
import { ServiceEngagementCard } from "@/components/engagement/ServiceEngagement";
import type { SigItem } from "@/components/signatures/LiveSignatures";
import type { ServiceRequest } from "@/lib/biz/config";
import { useBiz } from "@/lib/store/biz-store";
import { BACKEND, call } from "@/lib/sync/remote";

/** The business-services engagement letter: accepted before work starts (in the office, on paper, or signed online). */
export function EngagementCard({ r }: { r: ServiceRequest }) {
  const biz = useBiz();
  // A Business Services engagement letter the client signed online (Signatures) counts as accepted here.
  useEffect(() => {
    if (!BACKEND || !r.clientId || r.engagement) return;
    call<{ requests: (SigItem & { letter?: string })[] }>("GET", `/api/clients/${encodeURIComponent(r.clientId)}/signatures`).then((x) => {
      const s = x.requests.find((q) => q.status === "signed" && q.kind === "engagement" && q.letter?.startsWith("biz:"));
      const [, v, tv] = (s?.letter ?? "").split(":");
      if (s && v && tv) biz.acceptEngagement(r.id, { name: s.signedName ?? "", version: Number(v), termsVersion: Number(tv), method: "online" });
    }).catch(() => {});
  }, [r.id, r.clientId, !!r.engagement]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r.clientId) return null;
  return <ServiceEngagementCard e={r.engagement} letterName="Business services letter" letterUrl={`/api/biz/requests/${encodeURIComponent(r.id)}/letter`} when="The client accepts the letter before MKB starts work — or send it from the client's Signatures tab to sign online" onAccept={(a) => biz.acceptEngagement(r.id, a)} />;
}
