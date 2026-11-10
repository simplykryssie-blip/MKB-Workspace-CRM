/**
 * Drawn signatures (intakes and engagement letters). The browser sends a PNG
 * data URL from the signature box; the server checks it, stores it privately in
 * R2 with the client's files, and prints it on the signed PDFs. Server-only.
 */
import { badRequest } from "./core";

export const sha256Bytes = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", b as BufferSource))].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Checks a drawn signature: a real PNG of a sensible size. Returns the image bytes. */
export function signatureFrom(v: unknown): Uint8Array {
  const prefix = "data:image/png;base64,";
  if (typeof v !== "string" || !v.startsWith(prefix)) throw badRequest("Please sign in the signature box to submit.");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(v.slice(prefix.length)), (c) => c.charCodeAt(0)); } catch { throw badRequest("The signature couldn't be read. Please clear it and sign again."); }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 400 || bytes.length > 400_000 || !png.every((b, i) => bytes[i] === b)) throw badRequest("The signature couldn't be read. Please clear it and sign again.");
  return bytes;
}
