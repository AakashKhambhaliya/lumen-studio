import { NextResponse } from "next/server";
import { uploadFile } from "@/lib/higgsfield/client";
import { jsonError, withHiggsfield } from "@/lib/http";
import { MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES } from "@/lib/uploads";

// Receives the raw file bytes (Content-Type = the file's MIME type) and
// uploads them to Higgsfield storage server-side, so the browser needs no
// storage CORS access and never sees Higgsfield credentials.
export const POST = withHiggsfield(async (request, credentials) => {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (!UPLOAD_CONTENT_TYPES.includes(contentType)) {
    return jsonError(415, "invalid_request", `Unsupported file type ${contentType || "(none)"}.`);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES) {
    return jsonError(413, "invalid_request", `Files must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`);
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return jsonError(400, "invalid_request", "The file is empty.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return jsonError(413, "invalid_request", `Files must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`);
  }
  const url = await uploadFile(credentials, bytes, contentType);
  return NextResponse.json({ url }, { status: 201 });
}, { mutation: true });
