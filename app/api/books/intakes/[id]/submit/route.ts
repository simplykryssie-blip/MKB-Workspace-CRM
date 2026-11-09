import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { submitIntake } from "@/lib/server/books-intake";

/** { answers, rev, consentName, engagement: { version, termsVersion }, enteredBy } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await submitIntake(env, await authenticate(env, req), id, await body(req, 250_000))));
