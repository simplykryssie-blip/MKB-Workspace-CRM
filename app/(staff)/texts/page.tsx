import { redirect } from "next/navigation";

/** The text inbox is part of Messages now (texts, portal messages and emails together). */
export default async function Page({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams;
  redirect(phone ? `/messages?phone=${encodeURIComponent(phone)}` : "/messages");
}
