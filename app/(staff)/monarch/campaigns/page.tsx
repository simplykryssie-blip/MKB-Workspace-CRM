import type { Metadata } from "next";
import { CampaignsCenter } from "@/components/campaigns/CampaignsCenter";

export const metadata: Metadata = { title: "Monarch campaigns" };

export default function Page() {
  return <CampaignsCenter brand="monarch" />;
}
