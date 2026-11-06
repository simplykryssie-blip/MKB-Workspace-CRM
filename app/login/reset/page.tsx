import type { Metadata } from "next";
import { SetPasswordFlow } from "@/components/auth/AuthScreens";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return <SetPasswordFlow mode="reset" />;
}
