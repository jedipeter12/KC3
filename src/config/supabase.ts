export type PublicSupabaseConfig = Readonly<{
  url: string;
  publishableKey: string;
}>;

type ExpoPublicSupabaseEnvironment = Readonly<{
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}>;

const VARIABLE_NAMES = {
  url: "EXPO_PUBLIC_SUPABASE_URL",
  publishableKey: "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
} as const;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getPublicSupabaseConfig(
  environment: ExpoPublicSupabaseEnvironment = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): PublicSupabaseConfig {
  const url = environment.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    const missingVariables = [
      !url ? VARIABLE_NAMES.url : undefined,
      !publishableKey ? VARIABLE_NAMES.publishableKey : undefined,
    ].filter((name) => name !== undefined);

    throw new Error(
      `KC3 configuration error: Missing ${missingVariables.join(
        " and ",
      )}. Copy .env.example to .env.local and set the public Supabase values.`,
    );
  }

  if (!isHttpUrl(url)) {
    throw new Error(
      `KC3 configuration error: ${VARIABLE_NAMES.url} must be a valid HTTP or HTTPS URL.`,
    );
  }

  return { url, publishableKey };
}
