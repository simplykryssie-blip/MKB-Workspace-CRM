import { getEnv } from "@/lib/server/core";
import { getMedia } from "@/lib/server/website";

/** Public website images (only files uploaded in the website editor). */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  try {
    const obj = await getMedia(await getEnv(), key);
    if (!obj) return new Response("Not found", { status: 404 });
    return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", etag: obj.httpEtag } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
