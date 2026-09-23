import { getMediaFields, getParameterFields, humanize } from "./schema";
import type { InputSchema, MediaValues, ModelSpec, ParameterValues } from "./types";

/** What the studio collects; the payload itself is always derived from the model schema. */
export interface GenerationInput {
  prompt?: string;
  parameters?: ParameterValues;
  media?: MediaValues;
}

export interface ValidationIssue {
  key: string;
  message: string;
}

export interface BuiltPayload {
  payload: Record<string, unknown>;
  issues: ValidationIssue[];
}

type Coerced = { value: unknown } | { issue: string } | null;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Coerces a form value to the schema type. `null` means "not provided". */
export function coerceValue(schema: InputSchema, value: unknown): Coerced {
  if (value === undefined || value === null || value === "") return null;

  switch (schema.type) {
    case "integer":
    case "number": {
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(number)) return { issue: "must be a number" };
      if (schema.type === "integer" && !Number.isInteger(number)) return { issue: "must be a whole number" };
      if (schema.enum && !schema.enum.includes(number)) return { issue: `must be one of ${schema.enum.join(", ")}` };
      if (schema.minimum !== undefined && number < schema.minimum) return { issue: `must be at least ${schema.minimum}` };
      if (schema.maximum !== undefined && number > schema.maximum) return { issue: `must be at most ${schema.maximum}` };
      return { value: number };
    }
    case "boolean": {
      if (typeof value === "boolean") return { value };
      if (value === "true" || value === "false") return { value: value === "true" };
      return { issue: "must be on or off" };
    }
    case "string": {
      const text = String(value);
      if (schema.enum && !schema.enum.map(String).includes(text)) return { issue: `must be one of ${schema.enum.join(", ")}` };
      if (schema.maxLength !== undefined && text.length > schema.maxLength) {
        return { issue: `must be at most ${schema.maxLength} characters` };
      }
      return text.trim() ? { value: text } : null;
    }
    case "array": {
      if (!Array.isArray(value)) return { issue: "must be a list" };
      const items: unknown[] = [];
      for (const item of value) {
        const coerced = schema.items ? coerceValue(schema.items, item) : { value: item };
        if (coerced === null) continue;
        if ("issue" in coerced) return { issue: `item ${items.length + 1} ${coerced.issue}` };
        items.push(coerced.value);
      }
      if (items.length === 0) return null;
      if (schema.minItems !== undefined && items.length < schema.minItems) return { issue: `needs at least ${schema.minItems} items` };
      if (schema.maxItems !== undefined && items.length > schema.maxItems) return { issue: `allows at most ${schema.maxItems} items` };
      return { value: items };
    }
    case "object": {
      if (!isPlainObject(value)) return { issue: "must be an object" };
      const result: Record<string, unknown> = {};
      for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
        const coerced = coerceValue(propertySchema, value[key]);
        if (coerced === null) continue;
        if ("issue" in coerced) return { issue: `${humanize(key)} ${coerced.issue}` };
        result[key] = coerced.value;
      }
      const missing = (schema.required ?? []).filter((key) => result[key] === undefined);
      if (Object.keys(result).length === 0) return null;
      if (missing.length > 0) return { issue: `needs ${missing.map(humanize).join(", ")}` };
      return { value: result };
    }
  }
}

/**
 * Builds the Higgsfield request body for a model from studio input. Only
 * inputs the workflow declares are sent (Higgsfield rejects unknown fields),
 * and every value is checked against the published schema.
 */
export function buildPayload(model: ModelSpec, input: GenerationInput): BuiltPayload {
  const payload: Record<string, unknown> = {};
  const issues: ValidationIssue[] = [];

  const promptSchema = model.inputs.prompt;
  if (promptSchema) {
    const prompt = (input.prompt ?? "").trim();
    if (prompt) {
      if (promptSchema.maxLength !== undefined && prompt.length > promptSchema.maxLength) {
        issues.push({ key: "prompt", message: `Prompt must be at most ${promptSchema.maxLength} characters.` });
      }
      payload.prompt = prompt;
    } else if (model.required.includes("prompt")) {
      issues.push({ key: "prompt", message: "Enter a prompt." });
    }
  }

  for (const field of getMediaFields(model)) {
    const urls = (input.media?.[field.key] ?? []).filter(isHttpUrl);
    if (urls.length === 0) {
      if (field.required) {
        const label = field.label.toLowerCase();
        const article = field.multiple ? "at least one" : /^[aeiou]/.test(label) ? "an" : "a";
        issues.push({ key: field.key, message: `Add ${article} ${label}.` });
      }
      continue;
    }
    if (urls.length > field.maxItems) {
      issues.push({ key: field.key, message: `${field.label} allows at most ${field.maxItems} files.` });
    }
    payload[field.key] = field.multiple ? urls.slice(0, field.maxItems) : urls[0];
  }

  if (model.requiresOneOf && !model.requiresOneOf.some((key) => payload[key] !== undefined)) {
    const labels = getMediaFields(model)
      .filter((field) => model.requiresOneOf!.includes(field.key))
      .map((field) => field.label.toLowerCase());
    issues.push({ key: model.requiresOneOf[0], message: `Add at least one of: ${labels.join(", ")}.` });
  }

  for (const field of getParameterFields(model)) {
    const coerced = coerceValue(field.schema, input.parameters?.[field.key]);
    if (coerced === null) {
      if (field.required) issues.push({ key: field.key, message: `${field.label} is required.` });
      continue;
    }
    if ("issue" in coerced) {
      issues.push({ key: field.key, message: `${field.label} ${coerced.issue}.` });
      continue;
    }
    payload[field.key] = coerced.value;
  }

  return { payload, issues };
}
