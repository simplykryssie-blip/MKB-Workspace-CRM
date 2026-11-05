import type { Metadata } from "next";
import { BizCenter } from "@/components/biz/BizCenter";

export const metadata: Metadata = { title: "Business Services" };

export default function Page() {
  return <BizCenter />;
}
