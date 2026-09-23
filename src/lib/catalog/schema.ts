import type { InputSchema, MediaKind, ModelMode, ModelSpec, ParameterValues } from "./types";

export interface MediaField {
  key: string;
  kind: MediaKind;
  label: string;
  multiple: boolean;
  maxItems: number;
  required: boolean;
}

export interface ParameterField {
  key: string;
  schema: InputSchema;
  label: string;
  required: boolean;
}

/** Parameters surfaced directly in the prompt bar, in display order. */
export const PRIMARY_PARAMETERS = ["aspect_ratio", "resolution", "duration", "quality"] as const;

const KIND_ORDER: MediaKind[] = ["image", "video", "audio"];

const ROLE_LABELS: Record<string, (kind: MediaKind) => string> = {
  start: () => "Start frame",
  end: () => "End frame",
  source: () => "Source video",
  reference: () => "Reference image",
  references: (kind) => `Reference ${kind === "audio" ? "audio" : `${kind}s`}`,
  primary: (kind) => (kind === "image" ? "Image" : kind === "video" ? "Video" : "Audio"),
};

export function humanize(value: string | number): string {
  const text = String(value).replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isMediaKey(model: ModelSpec, key: string): boolean {
  return Boolean(model.inputs[key]?.media);
}

function primaryImageLabel(model: ModelSpec): string | null {
  const roles = Object.values(model.inputs).map((input) => input.media?.role);
  // With a separate end frame, a single primary image is the start frame;
  // next to a source video (motion control) it is the character to animate.
  if (roles.includes("end")) return "Start frame";
  if (roles.includes("source")) return "Character image";
  return null;
}

export function getMediaFields(model: ModelSpec): MediaField[] {
  const primaryLabel = primaryImageLabel(model);
  return Object.entries(model.inputs)
    .filter(([, schema]) => schema.media)
    .map(([key, schema]) => {
      const { kind, role } = schema.media!;
      const multiple = schema.type === "array";
      const label = role === "primary" && kind === "image" && primaryLabel ? primaryLabel : ROLE_LABELS[role](kind);
      return {
        key,
        kind,
        label,
        multiple,
        maxItems: multiple ? schema.maxItems ?? 10 : 1,
        required: model.required.includes(key),
      };
    })
    // Required inputs first, then images, videos, audio; end frames last.
    .sort((a, b) =>
      Number(b.required) - Number(a.required) ||
      Number(a.label === "End frame") - Number(b.label === "End frame") ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export function getParameterFields(model: ModelSpec): ParameterField[] {
  return Object.entries(model.inputs)
    .filter(([key]) => key !== "prompt" && !isMediaKey(model, key))
    .map(([key, schema]) => ({
      key,
      schema,
      label: schema.title && schema.title !== key ? schema.title : humanize(key),
      required: model.required.includes(key),
    }));
}

export function defaultParameterValues(model: ModelSpec): ParameterValues {
  const values: ParameterValues = {};
  for (const { key, schema } of getParameterFields(model)) {
    if (schema.default !== undefined) values[key] = schema.default as ParameterValues[string];
  }
  return values;
}

/**
 * Carries values across a model switch when the new model accepts them;
 * everything else falls back to the new model's defaults.
 */
export function carryOverParameters(model: ModelSpec, previous: ParameterValues): ParameterValues {
  const values = defaultParameterValues(model);
  for (const { key, schema } of getParameterFields(model)) {
    const value = previous[key];
    if (value === undefined) continue;
    if (schema.enum && !schema.enum.some((option) => String(option) === String(value))) continue;
    if (typeof value === "number" && schema.maximum !== undefined && value > schema.maximum) continue;
    if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) continue;
    values[key] = value;
  }
  return values;
}

/** Discrete options for a numeric range, for compact selects (e.g. duration 4–30s). */
export function rangeOptions(schema: InputSchema, limit = 40): number[] | null {
  if (schema.enum) return schema.enum.map(Number);
  if (schema.type !== "integer" || schema.minimum === undefined || schema.maximum === undefined) return null;
  const count = schema.maximum - schema.minimum + 1;
  if (count > limit) return null;
  return Array.from({ length: count }, (_, index) => schema.minimum! + index);
}

/** Enum-valued creative controls with no default can be left to the model. */
export function allowsAuto(field: ParameterField): boolean {
  return !field.required && field.schema.default === undefined;
}

export function modeLabel(mode: ModelMode): string {
  switch (mode) {
    case "generate": return "Generate";
    case "generate-edit": return "Generate · Edit";
    case "edit": return "Edit";
    case "text": return "Text";
    case "image": return "Image";
    case "frames": return "Frames";
    case "reference": return "Reference";
    case "extend": return "Extend";
  }
}
