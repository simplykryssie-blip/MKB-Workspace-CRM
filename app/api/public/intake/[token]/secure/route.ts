import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSecureIntake } from "@/lib/server/books-intake";

/** { key, value } — saves a full EIN or bank number encrypted; returns only the last 4. There is no way to read it back here. */
export const PUT = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSecureIntake(env, token, clientIp(req), await body(req))));
