import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

// A Higgsfield API key is a single credential string, as shown by "Copy API
// Key" in the console (the official SDKs call it KEY_ID:KEY_SECRET). It is
// sent verbatim as `Authorization: Key <api key>`. It comes from the server
// environment (recommended) or from an httpOnly cookie set via Settings, and
// is never readable by browser JavaScript.

export const CREDENTIALS_COOKIE = "lumen_hf";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const API_KEY_PATTERN = /^\S{8,512}$/;

export interface Credentials {
  apiKey: string;
  source: "env" | "cookie";
}

/** Returns the trimmed key, or null when it cannot be a Higgsfield API key. */
export function parseApiKey(value: string | undefined | null): string | null {
  const key = value?.trim();
  return key && API_KEY_PATTERN.test(key) ? key : null;
}

/** Console-style hint, e.g. `793c…767f`; never enough to reconstruct the key. */
export function keyHint(apiKey: string): string {
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}

function envApiKey(): string | null {
  const { HF_KEY, HF_CREDENTIALS, HF_API_KEY_ID, HF_API_KEY_SECRET } = process.env;
  // HF_KEY / HF_CREDENTIALS match the official SDKs; the separate ID and
  // secret variables are the older documented form.
  return parseApiKey(HF_KEY) ?? parseApiKey(HF_CREDENTIALS) ??
    (HF_API_KEY_ID && HF_API_KEY_SECRET ? parseApiKey(`${HF_API_KEY_ID}:${HF_API_KEY_SECRET}`) : null);
}

// When LUMEN_SESSION_SECRET is set, the cookie is sealed with AES-256-GCM so a
// copied cookie file does not reveal the API key.
function sessionKey(): Buffer | null {
  const secret = process.env.LUMEN_SESSION_SECRET;
  return secret ? createHash("sha256").update(secret).digest() : null;
}

export function sealCookieValue(value: string): string {
  const key = sessionKey();
  if (!key) return `p.${Buffer.from(value).toString("base64url")}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `e.${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
}

export function unsealCookieValue(sealed: string): string | null {
  try {
    const [scheme, body] = [sealed.slice(0, 2), Buffer.from(sealed.slice(2), "base64url")];
    if (scheme === "p.") return body.toString("utf8");
    const key = sessionKey();
    if (scheme !== "e." || !key) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, body.subarray(0, 12));
    decipher.setAuthTag(body.subarray(12, 28));
    return Buffer.concat([decipher.update(body.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function getCredentials(): Promise<Credentials | null> {
  const fromEnv = envApiKey();
  if (fromEnv) return { apiKey: fromEnv, source: "env" };
  const cookie = (await cookies()).get(CREDENTIALS_COOKIE)?.value;
  const apiKey = cookie ? parseApiKey(unsealCookieValue(cookie)) : null;
  return apiKey ? { apiKey, source: "cookie" } : null;
}

export function hasEnvCredentials(): boolean {
  return envApiKey() !== null;
}

export async function storeCredentials(apiKey: string, secure: boolean): Promise<void> {
  (await cookies()).set(CREDENTIALS_COOKIE, sealCookieValue(apiKey), {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearCredentials(): Promise<void> {
  (await cookies()).delete({ name: CREDENTIALS_COOKIE, path: "/api" });
}
