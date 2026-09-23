import { describe, expect, it } from "vitest";
import { getModel } from "@/lib/catalog";
import { createDraft, isDraft, remapMedia, switchModel } from "@/lib/draft";

const seedanceImage = getModel("seedance-2-5/image-to-video")!;
const klingImage = getModel("kling-3/pro-image-to-video")!;
const seedanceText = getModel("seedance-2-5/text-to-video")!;
const reference = getModel("seedance-2-5/reference-to-video")!;

describe("drafts", () => {
  it("starts from the model defaults", () => {
    const draft = createDraft(seedanceText);
    expect(draft.parameters.duration).toBe(seedanceText.inputs.duration.default);
    expect(isDraft(draft)).toBe(true);
    expect(isDraft({ modelId: 1 })).toBe(false);
  });

  it("maps start and end frames by role when switching models", () => {
    const media = remapMedia(seedanceImage, klingImage, {
      image_url: ["https://cdn.test/start.png"],
      end_image_url: ["https://cdn.test/end.png"],
    });
    expect(media).toEqual({ image_url: ["https://cdn.test/start.png"], last_image_url: ["https://cdn.test/end.png"] });
  });

  it("moves a start frame into reference images when that is all the model takes", () => {
    const media = remapMedia(seedanceImage, reference, { image_url: ["https://cdn.test/start.png"] });
    expect(media).toEqual({ image_urls: ["https://cdn.test/start.png"] });
  });

  it("keeps the prompt and compatible settings, and drops unsupported values", () => {
    const draft = { ...createDraft(seedanceText), prompt: "a shot", parameters: { duration: 12, resolution: "4K" } };
    const next = switchModel(draft, seedanceText, klingImage);
    expect(next.prompt).toBe("a shot");
    expect(next.modelId).toBe(klingImage.id);
    for (const [key, value] of Object.entries(next.parameters)) {
      const schema = klingImage.inputs[key];
      expect(schema, key).toBeDefined();
      if (schema.enum) expect(schema.enum.map(String)).toContain(String(value));
    }
  });
});
