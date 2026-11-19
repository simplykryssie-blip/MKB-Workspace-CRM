import type { Metadata } from "next";
import { StaffOnboarding } from "@/components/team/StaffOnboarding";

export const metadata: Metadata = { title: "Welcome — onboarding" };

export default function Page() {
  return <StaffOnboarding />;
}
