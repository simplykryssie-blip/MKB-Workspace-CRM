import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { book, bookingPage } from "@/lib/server/booking";

/** Public (no sign-in): what can be booked (?brand=mkb|monarch). */
export const GET = handle(async (req, env) => jsonResponse(await bookingPage(env, { brand: new URL(req.url).searchParams.get("brand") ?? undefined })));
/** Public: book a time. Rate-limited; paid types return a payment page. */
export const POST = handle(async (req, env) => jsonResponse(await book(env, await body(req), clientIp(req))));
