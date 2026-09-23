import "server-only";

import { NextResponse } from "next/server";
import { getCredentials, type Credentials } from "./higgsfield/credentials";
import { HiggsfieldError } from "./higgsfield/client";

export type ErrorCode =
  | "credentials_required"
  | "credentials_invalid"
  | "forbidden_origin"
  | "invalid_request"
  | "not_found"
  | "upstream_error";

export function jsonError(status: number, code: ErrorCode, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * Rejects cross-site state-changing requests. Browsers always send Origin on
 * POST/DELETE fetches; it must match the host this app is served from.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  return (forwarded ?? new URL(request.url).protocol.replace(":", "")) === "https";
}

interface HandlerOptions {
  /** Require a same-origin request (state-changing routes). */
  mutation?: boolean;
}

/**
 * Wraps a route handler that talks to Higgsfield: resolves credentials,
 * enforces same-origin for mutations, and maps upstream errors to JSON.
 */
export function withHiggsfield<Context>(
  handler: (request: Request, credentials: Credentials, context: Context) => Promise<Response>,
  { mutation = false }: HandlerOptions = {},
) {
  return async (request: Request, context: Context): Promise<Response> => {
    if (mutation && !isSameOrigin(request)) {
      return jsonError(403, "forbidden_origin", "Cross-origin requests are not allowed.");
    }
    const credentials = await getCredentials();
    if (!credentials) {
      return jsonError(401, "credentials_required", "Connect your Higgsfield API key in Settings.");
    }
    try {
      return await handler(request, credentials, context);
    } catch (error) {
      if (error instanceof HiggsfieldError) {
        if (error.status === 401) {
          return jsonError(401, "credentials_invalid", "Higgsfield rejected the API key. Update it in Settings.");
        }
        const status = error.status >= 400 && error.status < 600 ? error.status : 502;
        return jsonError(status, "upstream_error", error.message, error.correlationId ? { correlationId: error.correlationId } : {});
      }
      console.error("[higgsfield]", error);
      return jsonError(500, "upstream_error", "Unexpected server error.");
    }
  };
}
