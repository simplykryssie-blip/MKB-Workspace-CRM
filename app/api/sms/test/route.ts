import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { testText } from "@/lib/server/sms";

/** { brand, to } — a test text from that brand's number. */
export const POST = handle(async (req, env) => jsonResponse(await testText(env, await authenticate(env, req), await body(req))));
