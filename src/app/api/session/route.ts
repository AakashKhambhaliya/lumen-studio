import { NextResponse } from "next/server";
import {
  clearCredentials,
  getCredentials,
  hasEnvCredentials,
  keyHint,
  parseApiKey,
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
    keyHint: credentials ? keyHint(credentials.apiKey) : null,
  };
}

export async function GET() {
  return NextResponse.json(await currentSession());
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "forbidden_origin", "Cross-origin requests are not allowed.");
  if (hasEnvCredentials()) {
    return jsonError(409, "invalid_request", "An API key is configured on the server and cannot be changed here.");
  }
  const body = (await request.json().catch(() => null)) as { apiKey?: unknown } | null;
  const apiKey = parseApiKey(typeof body?.apiKey === "string" ? body.apiKey : null);
  if (!apiKey) return jsonError(400, "invalid_request", "Paste the full API key from the Higgsfield console.");

  try {
    const valid = await verifyCredentials({ apiKey, source: "cookie" });
    if (!valid) return jsonError(401, "credentials_invalid", "Higgsfield rejected this API key.");
  } catch (error) {
    const message = error instanceof HiggsfieldError ? error.message : "Could not verify the API key.";
    return jsonError(502, "upstream_error", message);
  }
  await storeCredentials(apiKey, isSecureRequest(request));
  return NextResponse.json(await currentSession());
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "forbidden_origin", "Cross-origin requests are not allowed.");
  await clearCredentials();
  return NextResponse.json(await currentSession());
}
