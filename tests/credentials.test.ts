import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCredentials, sealCookieValue, unsealCookieValue } from "@/lib/higgsfield/credentials";

afterEach(() => vi.unstubAllEnvs());

describe("credentials", () => {
  it("parses key ID and secret, allowing ':' in the secret", () => {
    expect(parseCredentials("id:sec:ret")).toEqual({ keyId: "id", secret: "sec:ret" });
    expect(parseCredentials("missing-secret")).toBeNull();
    expect(parseCredentials("id: spaced")).toBeNull();
  });

  it("encrypts the cookie when LUMEN_SESSION_SECRET is set", () => {
    vi.stubEnv("LUMEN_SESSION_SECRET", "test-secret");
    const sealed = sealCookieValue("id:secret");
    expect(sealed.startsWith("e.")).toBe(true);
    expect(sealed).not.toContain(Buffer.from("secret").toString("base64url"));
    expect(unsealCookieValue(sealed)).toBe("id:secret");
  });

  it("rejects tampered or foreign-key cookies", () => {
    vi.stubEnv("LUMEN_SESSION_SECRET", "test-secret");
    const sealed = sealCookieValue("id:secret");
    expect(unsealCookieValue(`${sealed.slice(0, -2)}AA`)).toBeNull();
    vi.stubEnv("LUMEN_SESSION_SECRET", "other-secret");
    expect(unsealCookieValue(sealed)).toBeNull();
  });

  it("falls back to an unencrypted httpOnly value without a session secret", () => {
    vi.stubEnv("LUMEN_SESSION_SECRET", "");
    expect(unsealCookieValue(sealCookieValue("id:secret"))).toBe("id:secret");
  });
});
