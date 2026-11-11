import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deletePage, savePage, unpublishPage, siteParam } from "@/lib/server/website";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await savePage(env, await authenticate(env, req), id, await body(req, 600_000), siteParam(req))));
/** { action: "delete" | "unpublish" } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  const action = str((await body(req)).action, 20);
  const a = await authenticate(env, req);
  if (action === "delete") await deletePage(env, a, id, siteParam(req));
  else if (action === "unpublish") await unpublishPage(env, a, id, siteParam(req));
  else return jsonResponse({ error: "Unknown action." }, 400);
  return jsonResponse({ ok: true });
});
