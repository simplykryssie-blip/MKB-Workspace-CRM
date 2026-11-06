/**
 * Security primitives (Web Crypto — runs on Cloudflare Workers and Node 20+).
 * Server-only: never import this from a client component.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Cryptographically random URL-safe token (default 32 bytes = 256 bits). */
export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return b64(a).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const randomId = (prefix: string) => `${prefix}_${randomToken(12)}`;
export async function sha256(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Constant-time comparison of two strings. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------------------------------------------------------------- passwords */
// PBKDF2-SHA256. 100,000 iterations is the maximum Cloudflare Workers allows.
// Format: pbkdf2$<iterations>$<salt b64>$<hash b64> — the iteration count is
// stored so it can be raised later without breaking existing passwords.
const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}
export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) {
    // Spend the same time as a real check so missing accounts can't be detected by timing.
    await pbkdf2(password, new Uint8Array(16), PBKDF2_ITERATIONS);
    return false;
  }
  const [alg, it, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2") return false;
  const bits = await pbkdf2(password, unb64(salt), Number(it));
  return safeEqual(b64(bits), hash);
}

/** Password rules from the security policy (length; mixed character types when required). */
export function passwordProblem(pw: string, rules: { passwordMinLength: number; passwordComplexity: boolean }) {
  if (pw.length < rules.passwordMinLength) return `Use at least ${rules.passwordMinLength} characters.`;
  if (pw.length > 256) return "That password is too long.";
  if (rules.passwordComplexity && [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length < 3) return "Use at least three of: lowercase, uppercase, numbers, symbols.";
  return null;
}

/* ---------------------------------------------------------------- field encryption */
// AES-256-GCM. The key comes from the ENCRYPTION_KEY secret (32 random bytes,
// base64). `aad` binds ciphertext to its record (e.g. "client:c-1001:tax_id")
// so an encrypted value copied onto another record fails to decrypt.
async function aesKey(secretB64: string) {
  const raw = unb64(secretB64);
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptField(secretB64: string, plaintext: string, aad: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, await aesKey(secretB64), enc.encode(plaintext));
  return { ciphertext: b64(ct), iv: b64(iv) };
}
export async function decryptField(secretB64: string, v: { ciphertext: string; iv: string }, aad: string) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(v.iv) as BufferSource, additionalData: enc.encode(aad) }, await aesKey(secretB64), unb64(v.ciphertext) as BufferSource);
  return dec.decode(pt);
}

/* ---------------------------------------------------------------- TOTP (authenticator apps) */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes: Uint8Array) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(s: string) {
  const clean = s.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error("bad base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
export const newTotpSecret = () => base32(crypto.getRandomValues(new Uint8Array(20)));

async function hotp(secret: string, counter: number) {
  const key = await crypto.subtle.importKey("raw", unbase32(secret) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8);
  new DataView(msg).setBigUint64(0, BigInt(counter));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = mac[mac.length - 1] & 15;
  const n = ((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}
export const totpStep = (ms = Date.now()) => Math.floor(ms / 30_000);
export const totpCode = (secret: string, step = totpStep()) => hotp(secret, step);

/**
 * Checks a 6-digit code (allowing one step of clock drift). Returns the matched
 * step, which the caller stores so the same code can't be used twice.
 */
export async function verifyTotp(secret: string, code: string, lastUsedStep: number, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const step = totpStep(now);
  for (const s of [step, step - 1, step + 1]) {
    if (s <= lastUsedStep) continue;
    if (safeEqual(await hotp(secret, s), code)) return s;
  }
  return null;
}
export const otpauthUrl = (secret: string, account: string, issuer = "MKB Business Suite") =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
