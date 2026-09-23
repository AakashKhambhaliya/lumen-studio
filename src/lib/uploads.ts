import type { MediaKind } from "./catalog/types";

// Content types accepted by Higgsfield's presigned uploads
// (https://docs.higgsfield.ai/docs/concepts/file-uploads).
export const UPLOAD_TYPES_BY_KIND: Record<MediaKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4"],
  audio: ["audio/wav", "audio/x-wav"],
};

export const UPLOAD_CONTENT_TYPES = Object.values(UPLOAD_TYPES_BY_KIND).flat();

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function uploadAccept(kind: MediaKind): string {
  return UPLOAD_TYPES_BY_KIND[kind].join(",");
}

/** Normalizes the browser-reported type (image/jpg, audio/wave, …). */
export function normalizeUploadType(type: string): string {
  const lower = type.toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  if (lower === "audio/wave" || lower === "audio/vnd.wave") return "audio/wav";
  return lower;
}
