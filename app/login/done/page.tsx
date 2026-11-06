import type { Metadata } from "next";
import { ClientSignedIn } from "@/components/auth/AuthScreens";

export const metadata: Metadata = { title: "Signed in" };

export default function Page() {
  return <ClientSignedIn />;
}
