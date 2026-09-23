import type { GenerationInput } from "./catalog/payload";
import { carryOverParameters, defaultParameterValues, getMediaFields, type MediaField } from "./catalog/schema";
import type { MediaValues, ModelSpec, ParameterValues } from "./catalog/types";

/** Everything a studio's composer holds; persisted per studio. */
export interface StudioDraft {
  modelId: string;
  prompt: string;
  parameters: ParameterValues;
  media: MediaValues;
}

export function createDraft(model: ModelSpec): StudioDraft {
  return { modelId: model.id, prompt: "", parameters: defaultParameterValues(model), media: {} };
}

export function isDraft(value: unknown): value is StudioDraft {
  const draft = value as StudioDraft | null;
  return typeof draft === "object" && draft !== null &&
    typeof draft.modelId === "string" &&
    typeof draft.prompt === "string" &&
    typeof draft.parameters === "object" && draft.parameters !== null &&
    typeof draft.media === "object" && draft.media !== null &&
    Object.values(draft.media).every((urls) => Array.isArray(urls));
}

/**
 * Moves attached media to the new model's inputs: same input first, then an
 * input with the same role and kind (start frame → start frame), then any
 * input of the same kind. Media the new model cannot take is dropped.
 */
export function remapMedia(from: ModelSpec | undefined, to: ModelSpec, media: MediaValues): MediaValues {
  const result: MediaValues = {};
  const consumed = new Set<string>();
  const targets = getMediaFields(to);
  const sources: MediaField[] = from ? getMediaFields(from) : [];
  const roleOf = (model: ModelSpec | undefined, key: string) => model?.inputs[key]?.media?.role;

  const assign = (target: MediaField, sourceKey: string) => {
    result[target.key] = media[sourceKey].slice(0, target.maxItems);
    consumed.add(sourceKey);
  };

  for (const target of targets) {
    if (media[target.key]?.length) assign(target, target.key);
  }
  const passes: Array<(source: MediaField, target: MediaField) => boolean> = [
    (source, target) => source.kind === target.kind && roleOf(from, source.key) === roleOf(to, target.key),
    (source, target) => source.kind === target.kind,
  ];
  for (const matches of passes) {
    for (const target of targets) {
      if (result[target.key]) continue;
      const source = sources.find((candidate) =>
        !consumed.has(candidate.key) && media[candidate.key]?.length && matches(candidate, target));
      if (source) assign(target, source.key);
    }
  }
  return result;
}

export function switchModel(draft: StudioDraft, from: ModelSpec | undefined, to: ModelSpec): StudioDraft {
  return {
    modelId: to.id,
    prompt: draft.prompt,
    parameters: carryOverParameters(to, draft.parameters),
    media: remapMedia(from, to, draft.media),
  };
}

/** Restores a past generation's settings into the composer. */
export function draftFromInput(model: ModelSpec, input: GenerationInput): StudioDraft {
  return {
    modelId: model.id,
    prompt: input.prompt ?? "",
    parameters: carryOverParameters(model, input.parameters ?? {}),
    media: remapMedia(model, model, input.media ?? {}),
  };
}

export function toGenerationInput(draft: StudioDraft): GenerationInput {
  return { prompt: draft.prompt, parameters: draft.parameters, media: draft.media };
}
