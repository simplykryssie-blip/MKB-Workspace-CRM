import type { Metadata } from "next";
import { SetPasswordFlow } from "@/components/auth/AuthScreens";

export const metadata: Metadata = { title: "Set up your portal" };

export default function Page() {
  return <SetPasswordFlow mode="invite" portal />;
}
