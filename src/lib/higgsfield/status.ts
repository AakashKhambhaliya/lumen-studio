// Shared between the server client and the browser: the normalized shape of a
// Higgsfield request as exposed by this app's /api/generations routes.

export type GenerationStatus = "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";

export const TERMINAL_STATUSES: ReadonlySet<GenerationStatus> = new Set(["completed", "failed", "nsfw", "canceled"]);

export interface GenerationOutput {
  url: string;
  kind: "image" | "video" | "audio" | "file";
}

export interface GenerationState {
  id: string;
  status: GenerationStatus;
  outputs: GenerationOutput[];
  error?: string;
}

export const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTerminal(status: GenerationStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
