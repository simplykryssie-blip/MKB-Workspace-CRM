import type { Metadata } from "next";
import { MemberPage } from "@/components/team/MemberPage";
import { MEMBERS } from "@/lib/sample/team-seed";

// Sample members are pre-rendered; members invited during a preview session render on demand.
export function generateStaticParams() {
  return MEMBERS.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: MEMBERS.find((m) => m.id === id)?.name ?? "Team member" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberPage key={id} id={id} />;
}
