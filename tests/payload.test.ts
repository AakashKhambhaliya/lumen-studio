import { describe, expect, it } from "vitest";
import { getModel } from "@/lib/catalog";
import { buildPayload, coerceValue } from "@/lib/catalog/payload";

const sunburst = getModel("marketing-studio-image/sunburst")!;
const reference = getModel("seedance-2-5/reference-to-video")!;
const motion = getModel("kling-3-motion-control/pro")!;

describe("buildPayload", () => {
  it("sends only declared inputs with schema-valid values", () => {
    const { payload, issues } = buildPayload(sunburst, {
      prompt: "  A ceramic vase  ",
      parameters: { quality: "max", resolution: "4k", aspect_ratio: "16:9", unknown_field: "x" },
      media: { image_urls: ["https://cdn.test/a.png"], not_an_input: ["https://cdn.test/b.png"] },
    });
    expect(issues).toEqual([]);
    expect(payload).toEqual({
      prompt: "A ceramic vase",
      quality: "max",
      resolution: "4k",
      aspect_ratio: "16:9",
      image_urls: ["https://cdn.test/a.png"],
    });
  });

  it("reports values outside the schema instead of sending them", () => {
    const { payload, issues } = buildPayload(sunburst, { prompt: "x", parameters: { resolution: "8k" } });
    expect(payload.resolution).toBeUndefined();
    expect(issues.map((issue) => issue.key)).toEqual(["resolution"]);
  });

  it("requires the prompt and required media", () => {
    const { issues } = buildPayload(motion, {});
    expect(issues.map((issue) => issue.key).sort()).toEqual(["image_url", "video_url"]);
    expect(buildPayload(sunburst, {}).issues[0]).toMatchObject({ key: "prompt", message: "Enter a prompt." });
  });

  it("enforces at-least-one-reference rules", () => {
    expect(buildPayload(reference, { prompt: "x" }).issues[0].message).toMatch(/at least one of/);
    expect(buildPayload(reference, { prompt: "x", media: { audio_urls: ["https://cdn.test/a.wav"] } }).issues).toEqual([]);
  });

  it("drops media that is not an http(s) URL", () => {
    const { payload } = buildPayload(sunburst, { prompt: "x", media: { image_urls: ["javascript:alert(1)", "blob:abc"] } });
    expect(payload.image_urls).toBeUndefined();
  });

  it("maps a single-file input to a string", () => {
    const { payload } = buildPayload(motion, {
      media: { image_url: ["https://cdn.test/face.png"], video_url: ["https://cdn.test/dance.mp4"] },
    });
    expect(payload).toMatchObject({ image_url: "https://cdn.test/face.png", video_url: "https://cdn.test/dance.mp4" });
  });
});

describe("coerceValue", () => {
  it("coerces and range-checks integers", () => {
    expect(coerceValue({ type: "integer", minimum: 4, maximum: 30 }, "8")).toEqual({ value: 8 });
    expect(coerceValue({ type: "integer", minimum: 4, maximum: 30 }, 31)).toEqual({ issue: "must be at most 30" });
    expect(coerceValue({ type: "integer" }, 1.5)).toEqual({ issue: "must be a whole number" });
  });

  it("treats empty values as not provided", () => {
    expect(coerceValue({ type: "string" }, "")).toBeNull();
    expect(coerceValue({ type: "array", items: { type: "string" } }, [])).toBeNull();
  });

  it("validates nested objects", () => {
    const schema = {
      type: "object" as const,
      required: ["rgb"],
      properties: { rgb: { type: "array" as const, items: { type: "integer" as const, minimum: 0, maximum: 255 }, minItems: 3, maxItems: 3 } },
    };
    expect(coerceValue(schema, { rgb: [1, 2, 3] })).toEqual({ value: { rgb: [1, 2, 3] } });
    expect(coerceValue(schema, { rgb: [1, 2, 300] })).toEqual({ issue: "Rgb item 3 must be at most 255" });
  });
});
