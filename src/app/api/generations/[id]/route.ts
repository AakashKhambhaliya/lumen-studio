import { NextResponse } from "next/server";
import { getGeneration } from "@/lib/higgsfield/client";
import { REQUEST_ID_PATTERN } from "@/lib/higgsfield/status";
import { jsonError, withHiggsfield } from "@/lib/http";

export const GET = withHiggsfield<RouteContext<"/api/generations/[id]">>(async (_request, credentials, { params }) => {
  const { id } = await params;
  if (!REQUEST_ID_PATTERN.test(id)) return jsonError(400, "invalid_request", "Invalid request ID.");
  return NextResponse.json(await getGeneration(credentials, id), {
    headers: { "Cache-Control": "no-store" },
  });
});
