import { serveSite } from "@/lib/server/site-public";

export const dynamic = "force-dynamic";

/** MKB Financial Group's public website (published pages, as plain HTML). */
export async function GET(req: Request, ctx: { params: Promise<{ slug?: string[] }> }) {
  return serveSite(req, "mkb", (await ctx.params).slug);
}
