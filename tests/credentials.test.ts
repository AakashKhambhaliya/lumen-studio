import { afterEach, describe, expect, it, vi } from "vitest";
import { keyHint, parseApiKey, sealCookieValue, unsealCookieValue } from "@/lib/higgsfield/credentials";

afterEach(() => vi.unstubAllEnvs());

describe("API keys", () => {
  it("accepts the key exactly as the Higgsfield console copies it", () => {
    expect(parseApiKey("  793c1a2b:9f8e7d6c5b4a767f \n")).toBe("793c1a2b:9f8e7d6c5b4a767f");
    expect(parseApiKey("793c1a2b9f8e7d6c5b4a767f")).toBe("793c1a2b9f8e7d6c5b4a767f");
  });

  it("rejects empty, short or whitespace-containing values", () => {
    expect(parseApiKey("")).toBeNull();
    expect(parseApiKey("short")).toBeNull();
    expect(parseApiKey("793c1a2b 9f8e7d6c")).toBeNull();
  });

  it("shows a console-style hint without revealing the key", () => {
    expect(keyHint("793c1a2b:9f8e7d6c5b4a767f")).toBe("793c…767f");
  });
});

describe("credential cookie", () => {
  it("encrypts the cookie when LUMEN_SESSION_SECRET is set", () => {
    vi.stubEnv("LUMEN_SESSION_SECRET", "test-secret");
    const sealed = sealCookieValue("793c1a2b:9f8e7d6c5b4a767f");
    expect(sealed.startsWith("e.")).toBe(true);
    expect(sealed).not.toContain(Buffer.from("9f8e7d6c").toString("base64url"));
    expect(unsealCookieValue(sealed)).toBe("793c1a2b:9f8e7d6c5b4a767f");
  });

  it("rejects tampered or foreign-key cookies", () => {
    vi.stubEnv("LUMEN_SESSION_SECRET", "test-secret");
    const sealed = sealCookieValue("793c1a2b:9f8e7d6c5b4a767f");
    expect(unsealCookieValue(`${sealed.slice(0, -2)}AA`)).toBeNull();
    vi.stubEnv("LUMEN_SESSION_SECRET", "other-secret");
    expect(unsealCookieValue(sealed)).toBeNull();
  });

  it("falls back to an unencrypted httpOnly value without a session secret", () => {
    vi.stubEnv("LUMEN_SESSION_SECRET", "");
    expect(unsealCookieValue(sealCookieValue("793c1a2b:9f8e7d6c5b4a767f"))).toBe("793c1a2b:9f8e7d6c5b4a767f");
  });
});
