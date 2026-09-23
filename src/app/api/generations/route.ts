import { NextResponse } from "next/server";
import { getModel } from "@/lib/catalog";
import { buildPayload, type GenerationInput } from "@/lib/catalog/payload";
import { submitGeneration } from "@/lib/higgsfield/client";
import { jsonError, withHiggsfield } from "@/lib/http";

interface SubmitBody extends GenerationInput {
  modelId?: string;
}

// Only catalog models can be called, and the request body is rebuilt from the
// model's schema, so a client cannot reach arbitrary Higgsfield endpoints or
// send undeclared fields.
export const POST = withHiggsfield(async (request, credentials) => {
  const body = (await request.json().catch(() => null)) as SubmitBody | null;
  const model = body?.modelId ? getModel(body.modelId) : undefined;
  if (!model) return jsonError(404, "not_found", "Unknown model.");

  const { payload, issues } = buildPayload(model, body ?? {});
  if (issues.length > 0) {
    return jsonError(422, "invalid_request", issues.map((issue) => issue.message).join(" "), { issues });
  }
  const id = await submitGeneration(credentials, model.endpoint, payload);
  return NextResponse.json({ id, status: "queued" }, { status: 202 });
}, { mutation: true });
