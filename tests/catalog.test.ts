import { describe, expect, it } from "vitest";
import { STUDIOS, STUDIO_ORDER } from "@/config/studios";
import { getModel, getModelCount, getStudioModels } from "@/lib/catalog";
import { getMediaFields, getParameterFields } from "@/lib/catalog/schema";

const allModels = STUDIO_ORDER.flatMap((studio) => getStudioModels(studio));

describe("catalog", () => {
  it("has unique ids and an endpoint for every workflow", () => {
    expect(new Set(allModels.map((model) => model.id)).size).toBe(allModels.length);
    expect(getModelCount()).toBe(allModels.length);
    for (const model of allModels) {
      expect(model.endpoint, model.id).toMatch(/^[a-z0-9.-]+(\/[a-z0-9.-]+)+$/);
      expect(model.docsUrl).toContain(model.id);
    }
  });

  it("assigns every model to the studio that lists it", () => {
    for (const studio of STUDIO_ORDER) {
      for (const model of getStudioModels(studio)) expect(model.studio).toBe(studio);
    }
  });

  it("resolves every studio's default model", () => {
    for (const studio of STUDIO_ORDER) {
      expect(getModel(STUDIOS[studio].defaultModelId)?.studio).toBe(studio);
    }
  });

  it("puts Cinema Studio 4.0 and the motion-control models in their own studios", () => {
    expect(getModel("cinema-studio-4/generate")?.studio).toBe("cinema");
    expect(getModel("kling-3-motion-control/pro")?.studio).toBe("motion");
    expect(getModel("genjutsu/motion-transfer")?.studio).toBe("motion");
    expect(getModel("seedance-2-5/text-to-video")?.studio).toBe("video");
  });

  it("exposes Cinema director controls as featured parameters", () => {
    const cinema = getModel("cinema-studio-4/generate")!;
    const keys = getParameterFields(cinema).map((field) => field.key);
    for (const key of STUDIOS.cinema.featured!.keys) expect(keys).toContain(key);
  });

  it("labels start and end frames", () => {
    const labels = getMediaFields(getModel("seedance-2-5/image-to-video")!).map((field) => field.label);
    expect(labels).toEqual(["Start frame", "End frame"]);
  });

  it("labels the motion-control image as the character", () => {
    const labels = getMediaFields(getModel("kling-3-motion-control/pro")!).map((field) => field.label);
    expect(labels).toEqual(["Character image", "Source video"]);
  });
});
