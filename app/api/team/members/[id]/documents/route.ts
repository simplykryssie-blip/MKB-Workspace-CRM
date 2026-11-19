import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { confirmIdentity, memberOnboarding } from "@/lib/server/staff-onboarding";

/** A team member's onboarding documents and identity confirmation (managers). */
export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await memberOnboarding(env, await authenticate(env, req), String(id))));
/** { verified, note } — confirm (or undo) their identity. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await confirmIdentity(env, await authenticate(env, req), String(id), await body(req))));
