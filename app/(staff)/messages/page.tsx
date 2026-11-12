import type { Metadata } from "next";
import { MessagesCenter } from "@/components/workspace/MessagesCenter";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return <MessagesCenter />;
}
