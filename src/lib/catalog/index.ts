import "server-only";

import { models as cinema } from "./generated/cinema";
import { models as image } from "./generated/image";
import { models as motion } from "./generated/motion";
import { models as video } from "./generated/video";
import type { ModelSpec, StudioId } from "./types";

// Server-only: pages pass their studio's models to the client as props, so
// the full catalog never ships in the browser bundle.
const CATALOG: Record<StudioId, ModelSpec[]> = { image, video, cinema, motion };

const MODELS_BY_ID = new Map(Object.values(CATALOG).flat().map((model) => [model.id, model]));

export function getStudioModels(studio: StudioId): ModelSpec[] {
  return CATALOG[studio];
}

export function getModel(id: string): ModelSpec | undefined {
  return MODELS_BY_ID.get(id);
}

export function getModelCount(): number {
  return MODELS_BY_ID.size;
}
