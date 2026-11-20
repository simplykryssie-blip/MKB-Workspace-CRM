import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** The first Black Friday link now goes to the Tax Prize page (the Vault itself stays at /credit-comeback/kit). */
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const own = (await headers()).get("x-mkb-site") === "1";
  const q = new URLSearchParams(await searchParams).toString();
  redirect(`${own ? "" : "/site"}/black-friday${q ? `?${q}` : ""}`);
}
