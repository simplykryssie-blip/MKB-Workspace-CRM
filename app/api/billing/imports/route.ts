import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { uploadBankCsv } from "@/lib/server/bank-import";

/** { fileName, text } — a bank CSV; returns deposits with suggested invoice matches (nothing is applied yet). */
export const POST = handle(async (req, env) => jsonResponse(await uploadBankCsv(env, await authenticate(env, req), await body(req, 2_200_000))));
