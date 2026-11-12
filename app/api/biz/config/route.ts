import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveBizConfig, type BizConfig } from "@/lib/server/biz";

export const PUT = handle(async (req, env) => jsonResponse(await saveBizConfig(env, await authenticate(env, req), await body<{ config?: Partial<BizConfig>; updatedAt?: string | null }>(req, 450_000))));
