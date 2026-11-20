import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { manualSecureServiceIntake } from "@/lib/server/service-intake";

/** { key, value } — staff entering the client's SSN during a manual intake (edit-SSN permission). */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await manualSecureServiceIntake(env, await authenticate(env, req), id, await body(req))));
