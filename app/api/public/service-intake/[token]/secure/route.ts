import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSecureServiceIntake } from "@/lib/server/service-intake";

/** { key, value } — saves the client's SSN encrypted on their profile; returns only the last 4. Nothing here reads it back. */
export const PUT = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSecureServiceIntake(env, token, clientIp(req), await body(req))));
