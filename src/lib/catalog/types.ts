export type StudioId = "image" | "video" | "cinema" | "motion";

export type MediaKind = "image" | "video" | "audio";

/** How a media input is used by the workflow. */
export type MediaRole = "primary" | "references" | "reference" | "start" | "end" | "source";

export interface MediaAnnotation {
  kind: MediaKind;
  role: MediaRole;
}

/** The JSON Schema subset published by Higgsfield, after normalization. */
export interface InputSchema {
  type: "string" | "integer" | "number" | "boolean" | "array" | "object";
  title?: string;
  description?: string;
  enum?: Array<string | number>;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  format?: string;
  required?: string[];
  items?: InputSchema;
  properties?: Record<string, InputSchema>;
  media?: MediaAnnotation;
}

export type ModelMode =
  | "generate"
  | "generate-edit"
  | "edit"
  | "text"
  | "image"
  | "frames"
  | "reference"
  | "extend";

export interface MentionSyntax {
  /** `at` → @image1, `angle` → <<<image_1>>> */
  format: "at" | "angle";
  kinds: MediaKind[];
}

export interface ModelSpec {
  /** `family/workflow`, stable across catalog syncs. */
  id: string;
  /** Higgsfield endpoint ID, e.g. `bytedance/seedance-2.5/text-to-video`. */
  endpoint: string;
  family: string;
  familyName: string;
  workflow: string;
  workflowName: string;
  creator: string;
  description: string;
  output: "image" | "video";
  studio: StudioId;
  mode: ModelMode;
  required: string[];
  /** At least one of these inputs must be provided. */
  requiresOneOf?: string[];
  mentions?: MentionSyntax;
  notes: string[];
  docsUrl: string;
  inputs: Record<string, InputSchema>;
}

export type ParameterValue = string | number | boolean | unknown[] | Record<string, unknown>;
export type ParameterValues = Record<string, ParameterValue | undefined>;

/** Media attached per input key; arrays keep upload order. */
export type MediaValues = Record<string, string[]>;
