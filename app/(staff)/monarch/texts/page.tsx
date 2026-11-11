import type { Metadata } from "next";
import { Suspense } from "react";
import { TextInbox } from "@/components/campaigns/TextInbox";

export const metadata: Metadata = { title: "Monarch text inbox" };

export default function Page() {
  return <Suspense><TextInbox brand="monarch" /></Suspense>;
}
