import type { Metadata } from "next";
import { LoginFlow } from "@/components/auth/AuthScreens";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <LoginFlow portal />;
}
