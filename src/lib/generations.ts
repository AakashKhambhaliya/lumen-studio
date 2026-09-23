import type { GenerationInput } from "./catalog/payload";
import type { StudioId } from "./catalog/types";
import type { GenerationOutput, GenerationStatus } from "./higgsfield/status";
import { isTerminal } from "./higgsfield/status";

/** Local history entry for one Higgsfield request. */
export interface GenerationRecord {
  /** Higgsfield request ID (`local-…` while the submission is in flight). */
  id: string;
  studio: StudioId;
  modelId: string;
  modelName: string;
  output: "image" | "video";
  /** What was submitted, so the settings can be reused. */
  input: GenerationInput;
  status: GenerationStatus | "submitting" | "lost";
  outputs: GenerationOutput[];
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export const MAX_RECORDS = 200;

/** Higgsfield keeps outputs for at least seven days. */
export const OUTPUT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecordList(value: unknown): value is GenerationRecord[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "object" && item !== null &&
    typeof (item as GenerationRecord).id === "string" &&
    typeof (item as GenerationRecord).studio === "string" &&
    Array.isArray((item as GenerationRecord).outputs));
}

/** Requests the poller should keep checking. */
export function isPollable(record: GenerationRecord): boolean {
  return record.status !== "submitting" && record.status !== "lost" && !isTerminal(record.status);
}
