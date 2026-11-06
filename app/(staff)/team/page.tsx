import type { Metadata } from "next";
import { TeamCenter } from "@/components/team/TeamCenter";

export const metadata: Metadata = { title: "Team & Permissions" };

export default function Page() {
  return <TeamCenter />;
}
