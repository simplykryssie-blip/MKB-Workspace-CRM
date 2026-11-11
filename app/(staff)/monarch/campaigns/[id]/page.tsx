import type { Metadata } from "next";
import { CampaignEditor } from "@/components/campaigns/CampaignEditor";

export const metadata: Metadata = { title: "Campaign" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignEditor key={id} id={id} brand="monarch" />;
}
