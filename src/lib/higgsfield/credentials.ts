import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

// Higgsfield credentials are a key ID and secret, sent as
// `Authorization: Key <id>:<secret>`. They come from the server environment
// (recommended) or from an httpOnly cookie set via Settings; they are never
// readable by browser JavaScript.

export const CREDENTIALS_COOKIE = "lumen_hf";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const CREDENTIALS_PATTERN = /^[^\s:]+:[^\s]+$/;

export interface Credentials {
  keyId: string;
  secret: string;
  source: "env" | "cookie";
}

export function parseCredentials(value: string | undefined | null): Omit<Credentials, "source"> | null {
  if (!value || !CREDENTIALS_PATTERN.test(value)) return null;
  const separator = value.indexOf(":");
  return { keyId: value.slice(0, separator), secret: value.slice(separator + 1) };
}

function envCredentials(): Credentials | null {
  const { HF_API_KEY_ID, HF_API_KEY_SECRET, HF_CREDENTIALS } = process.env;
  const parsed = HF_API_KEY_ID && HF_API_KEY_SECRET
    ? parseCredentials(`${HF_API_KEY_ID}:${HF_API_KEY_SECRET}`)
    : parseCredentials(HF_CREDENTIALS);
  return parsed ? { ...parsed, source: "env" } : null;
}

// When LUMEN_SESSION_SECRET is set, the cookie is sealed with AES-256-GCM so a
// copied cookie file does not reveal the Higgsfield secret.
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
  const fromEnv = envCredentials();
  if (fromEnv) return fromEnv;
  const cookie = (await cookies()).get(CREDENTIALS_COOKIE)?.value;
  const parsed = cookie ? parseCredentials(unsealCookieValue(cookie)) : null;
  return parsed ? { ...parsed, source: "cookie" } : null;
}

export function hasEnvCredentials(): boolean {
  return envCredentials() !== null;
}

export async function storeCredentials(keyId: string, secret: string, secure: boolean): Promise<void> {
  (await cookies()).set(CREDENTIALS_COOKIE, sealCookieValue(`${keyId}:${secret}`), {
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
