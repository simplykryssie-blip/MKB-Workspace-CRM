import type { Metadata } from "next";
import { SetPasswordFlow } from "@/components/auth/AuthScreens";

export const metadata: Metadata = { title: "Accept invitation" };

export default function Page() {
  return <SetPasswordFlow mode="invite" />;
}
