import { NextResponse } from "next/server";
import {
  clearCredentials,
  getCredentials,
  hasEnvCredentials,
  parseCredentials,
  storeCredentials,
} from "@/lib/higgsfield/credentials";
import { HiggsfieldError, verifyCredentials } from "@/lib/higgsfield/client";
import { isSameOrigin, isSecureRequest, jsonError } from "@/lib/http";
import type { SessionState } from "@/lib/session";

async function currentSession(): Promise<SessionState> {
  const credentials = await getCredentials();
  return {
    connected: Boolean(credentials),
    source: credentials?.source ?? null,
    keyIdHint: credentials ? `${credentials.keyId.slice(0, 6)}…` : null,
  };
}

export async function GET() {
  return NextResponse.json(await currentSession());
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "forbidden_origin", "Cross-origin requests are not allowed.");
  if (hasEnvCredentials()) {
    return jsonError(409, "invalid_request", "Credentials are configured on the server and cannot be changed here.");
  }
  const body = (await request.json().catch(() => null)) as { keyId?: unknown; secret?: unknown } | null;
  const parsed = parseCredentials(`${String(body?.keyId ?? "").trim()}:${String(body?.secret ?? "").trim()}`);
  if (!parsed) return jsonError(400, "invalid_request", "Enter both the API key ID and secret.");

  try {
    const valid = await verifyCredentials({ ...parsed, source: "cookie" });
    if (!valid) return jsonError(401, "credentials_invalid", "Higgsfield rejected this API key ID and secret.");
  } catch (error) {
    const message = error instanceof HiggsfieldError ? error.message : "Could not verify the API key.";
    return jsonError(502, "upstream_error", message);
  }
  await storeCredentials(parsed.keyId, parsed.secret, isSecureRequest(request));
  return NextResponse.json(await currentSession());
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "forbidden_origin", "Cross-origin requests are not allowed.");
  await clearCredentials();
  return NextResponse.json(await currentSession());
}
