import "server-only";

import { randomUUID } from "node:crypto";
import type { Credentials } from "./credentials";
import type { GenerationOutput, GenerationState, GenerationStatus } from "./status";

// Server-side Higgsfield API client (https://docs.higgsfield.ai/docs).
// HIGGSFIELD_API_BASE can point at scripts/mock-higgsfield.mjs for local work.

const API_BASE = (process.env.HIGGSFIELD_API_BASE ?? "https://api.higgsfield.ai").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 60_000;

export class HiggsfieldError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "HiggsfieldError";
  }
}

interface RawStatus {
  status: GenerationStatus;
  request_id: string;
  error?: string | null;
  images?: Array<{ url: string }>;
  video?: { url: string } | null;
  audio?: { url: string } | null;
  audios?: Array<{ url: string }>;
}

interface UploadTarget {
  public_url: string;
  upload_url: string;
  upload_headers: Record<string, string>;
}

function formatDetail(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc: ["body", "duration"], msg: "..." }]
    return detail
      .map((item: { loc?: unknown[]; msg?: string }) => {
        const field = item.loc?.filter((part) => part !== "body").join(".");
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join("; ");
  }
  return typeof detail === "string" && detail ? detail : fallback;
}

async function request<T>(credentials: Credentials, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Key ${credentials.apiKey}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new HiggsfieldError(502, `Could not reach Higgsfield: ${(error as Error).message}`);
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { detail: text.slice(0, 300) };
  }
  if (!response.ok) {
    throw new HiggsfieldError(
      response.status,
      formatDetail(body, response.statusText),
      response.headers.get("x-correlation-id") ?? undefined,
    );
  }
  return body as T;
}

function normalizeStatus(raw: RawStatus): GenerationState {
  const outputs: GenerationOutput[] = [
    ...(raw.images ?? []).map(({ url }) => ({ url, kind: "image" as const })),
    ...(raw.video?.url ? [{ url: raw.video.url, kind: "video" as const }] : []),
    ...(raw.audios?.length ? raw.audios : raw.audio?.url ? [raw.audio] : []).map(({ url }) => ({ url, kind: "audio" as const })),
  ];
  return {
    id: raw.request_id,
    status: raw.status,
    outputs,
    ...(raw.error ? { error: raw.error } : {}),
  };
}

/** Submits a generation to a catalog endpoint; returns the request ID. */
export async function submitGeneration(credentials: Credentials, endpoint: string, payload: Record<string, unknown>): Promise<string> {
  const result = await request<{ request_id?: string }>(credentials, `/${endpoint}`, { method: "POST", body: payload });
  if (!result?.request_id) throw new HiggsfieldError(502, "Higgsfield did not return a request ID.");
  return result.request_id;
}

export async function getGeneration(credentials: Credentials, requestId: string): Promise<GenerationState> {
  return normalizeStatus(await request<RawStatus>(credentials, `/requests/${requestId}/status`));
}

export async function cancelGeneration(credentials: Credentials, requestId: string): Promise<void> {
  await request(credentials, `/requests/${requestId}/cancel`, { method: "POST" });
}

/** Uploads bytes through a presigned URL and returns the public URL models accept. */
export async function uploadFile(credentials: Credentials, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const target = await request<UploadTarget>(credentials, "/files/generate-upload-url", {
    method: "POST",
    body: { content_type: contentType },
  });
  // The presigned storage URL must not receive the Higgsfield credentials.
  const response = await fetch(target.upload_url, {
    method: "PUT",
    headers: target.upload_headers,
    body: bytes,
    signal: AbortSignal.timeout(5 * 60_000),
  });
  if (!response.ok) throw new HiggsfieldError(502, `File upload failed with status ${response.status}.`);
  return target.public_url;
}

/**
 * Checks credentials without starting a generation: an unknown request ID
 * returns 404 for a valid key and 401 for an invalid one.
 */
export async function verifyCredentials(credentials: Credentials): Promise<boolean> {
  try {
    await request(credentials, `/requests/${randomUUID()}/status`);
    return true;
  } catch (error) {
    if (error instanceof HiggsfieldError && error.status === 404) return true;
    if (error instanceof HiggsfieldError && error.status === 401) return false;
    throw error;
  }
}
