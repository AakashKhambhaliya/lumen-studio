import { NextResponse } from "next/server";
import { cancelGeneration } from "@/lib/higgsfield/client";
import { REQUEST_ID_PATTERN } from "@/lib/higgsfield/status";
import { jsonError, withHiggsfield } from "@/lib/http";

// Higgsfield only cancels requests that are still queued; once processing
// starts it answers 400, which is passed through to the client.
export const POST = withHiggsfield<RouteContext<"/api/generations/[id]/cancel">>(async (_request, credentials, { params }) => {
  const { id } = await params;
  if (!REQUEST_ID_PATTERN.test(id)) return jsonError(400, "invalid_request", "Invalid request ID.");
  await cancelGeneration(credentials, id);
  return NextResponse.json({ id, status: "canceled" });
}, { mutation: true });
