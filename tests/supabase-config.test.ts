import { getPublicSupabaseConfig } from "../src/config/supabase";

describe("public Supabase configuration", () => {
  it("reads the Expo public process environment by default", () => {
    const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const previousPublishableKey =
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://default.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_default";

    try {
      expect(getPublicSupabaseConfig()).toEqual({
        url: "https://default.supabase.co",
        publishableKey: "sb_publishable_default",
      });
    } finally {
      if (previousUrl === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
      }

      if (previousPublishableKey === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
          previousPublishableKey;
      }
    }
  });

  it("reads and trims the Expo public values", () => {
    expect(
      getPublicSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_example ",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("reports missing variables without exposing configured values", () => {
    const configuredValue = "sb_publishable_do-not-print";

    expect(() =>
      getPublicSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configuredValue,
      }),
    ).toThrow(
      "KC3 configuration error: Missing EXPO_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and set the public Supabase values.",
    );

    try {
      getPublicSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configuredValue,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(configuredValue);
    }
  });

  it("reports all missing or blank variables", () => {
    expect(() =>
      getPublicSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: "  ",
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toThrow(
      "Missing EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it("rejects malformed URLs without echoing the value", () => {
    const malformedUrl = "not-a-supabase-url";

    expect(() =>
      getPublicSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: malformedUrl,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toThrow(
      "KC3 configuration error: EXPO_PUBLIC_SUPABASE_URL must be a valid HTTP or HTTPS URL.",
    );

    try {
      getPublicSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: malformedUrl,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(malformedUrl);
    }
  });
});
