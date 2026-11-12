"use client";

import { ServiceEngagementCard } from "@/components/engagement/ServiceEngagement";
import type { ServiceRequest } from "@/lib/biz/config";
import { useBiz } from "@/lib/store/biz-store";

/** The business-services engagement letter: accepted before work starts. */
export function EngagementCard({ r }: { r: ServiceRequest }) {
  const biz = useBiz();
  if (!r.clientId) return null;
  return <ServiceEngagementCard e={r.engagement} letterName="Business services letter" letterUrl={`/api/biz/requests/${encodeURIComponent(r.id)}/letter`} when="The client accepts the letter before MKB starts work" onAccept={(a) => biz.acceptEngagement(r.id, a)} />;
}
