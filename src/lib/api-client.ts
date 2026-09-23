import type { GenerationInput, ValidationIssue } from "./catalog/payload";
import type { GenerationState } from "./higgsfield/status";
import type { SessionState } from "./session";

// Browser client for this app's /api routes. Higgsfield is only ever called
// from the server; the browser never sees the API key after connecting.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  get needsCredentials(): boolean {
    return this.code === "credentials_required" || this.code === "credentials_invalid";
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; issues?: ValidationIssue[] };
}

function toApiError(status: number, body: ErrorBody | null, fallback: string): ApiError {
  return new ApiError(
    status,
    body?.error?.code ?? "unknown",
    body?.error?.message ?? fallback,
    body?.error?.issues ?? [],
  );
}

async function request<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network_error", "Network error. Check your connection and try again.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, body, `Request failed (${response.status}).`);
  return body as T;
}

export const api = {
  getSession: () => request<SessionState>("/api/session"),
  connect: (apiKey: string) =>
    request<SessionState>("/api/session", { method: "POST", json: { apiKey } }),
  disconnect: () => request<SessionState>("/api/session", { method: "DELETE" }),

  submitGeneration: (modelId: string, input: GenerationInput) =>
    request<{ id: string }>("/api/generations", { method: "POST", json: { modelId, ...input } }),
  getGeneration: (id: string) => request<GenerationState>(`/api/generations/${encodeURIComponent(id)}`),
  cancelGeneration: (id: string) =>
    request<{ id: string }>(`/api/generations/${encodeURIComponent(id)}/cancel`, { method: "POST" }),

  /** Uploads a file with progress (fetch cannot report upload progress). */
  uploadFile(file: File, contentType: string, onProgress?: (fraction: number) => void, signal?: AbortSignal) {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads");
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.responseType = "json";
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      xhr.onload = () => {
        const body = xhr.response as ({ url?: string } & ErrorBody) | null;
        if (xhr.status >= 200 && xhr.status < 300 && body?.url) resolve(body.url);
        else reject(toApiError(xhr.status, body, `Upload failed (${xhr.status}).`));
      };
      xhr.onerror = () => reject(new ApiError(0, "network_error", "Upload failed. Check your connection."));
      xhr.onabort = () => reject(new ApiError(0, "aborted", "Upload canceled."));
      signal?.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.send(file);
    });
  },
};
