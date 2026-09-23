import { beforeEach, describe, expect, it, vi } from "vitest";

const submitGeneration = vi.fn();
const getCredentials = vi.fn();

vi.mock("@/lib/higgsfield/credentials", () => ({ getCredentials: () => getCredentials() }));
vi.mock("@/lib/higgsfield/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/higgsfield/client")>()),
  submitGeneration: (...args: unknown[]) => submitGeneration(...args),
}));

const { POST } = await import("@/app/api/generations/route");

function submit(body: unknown, origin = "http://localhost:3000") {
  return POST(
    new Request("http://localhost:3000/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", host: "localhost:3000", origin },
      body: JSON.stringify(body),
    }),
    undefined,
  );
}

beforeEach(() => {
  submitGeneration.mockReset().mockResolvedValue("d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff");
  getCredentials.mockReset().mockResolvedValue({ keyId: "id", secret: "secret", source: "env" });
});

describe("POST /api/generations", () => {
  it("submits the schema-built payload to the model's endpoint", async () => {
    const response = await submit({
      modelId: "seedance-2-5/text-to-video",
      prompt: "a lighthouse at dusk",
      parameters: { duration: 5, injected: "nope" },
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ id: "d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff", status: "queued" });
    const [, endpoint, payload] = submitGeneration.mock.calls[0];
    expect(endpoint).toBe("bytedance/seedance-2.5/text-to-video");
    expect(payload).toMatchObject({ prompt: "a lighthouse at dusk", duration: 5 });
    expect(payload).not.toHaveProperty("injected");
  });

  it("rejects cross-origin requests", async () => {
    const response = await submit({ modelId: "seedance-2-5/text-to-video", prompt: "x" }, "https://evil.example");
    expect(response.status).toBe(403);
    expect(submitGeneration).not.toHaveBeenCalled();
  });

  it("only calls catalog models", async () => {
    const response = await submit({ modelId: "../../files/generate-upload-url", prompt: "x" });
    expect(response.status).toBe(404);
  });

  it("returns validation issues without calling Higgsfield", async () => {
    const response = await submit({ modelId: "kling-3-motion-control/pro" });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.issues.map((issue: { key: string }) => issue.key).sort()).toEqual(["image_url", "video_url"]);
    expect(submitGeneration).not.toHaveBeenCalled();
  });

  it("asks for credentials when none are configured", async () => {
    getCredentials.mockResolvedValue(null);
    const response = await submit({ modelId: "seedance-2-5/text-to-video", prompt: "x" });
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("credentials_required");
  });
});
