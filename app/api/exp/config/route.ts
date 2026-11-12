import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveExpConfig, type ExpConfig } from "@/lib/server/exp";

export const PUT = handle(async (req, env) => jsonResponse(await saveExpConfig(env, await authenticate(env, req), await body<{ config?: Partial<ExpConfig>; updatedAt?: string | null }>(req, 450_000))));
