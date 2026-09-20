export type GoogleIngestionEnvironment = Readonly<{
  GOOGLE_PLACES_API_KEY?: string;
  KC3_SUPABASE_URL?: string;
  KC3_SUPABASE_SERVICE_ROLE_KEY?: string;
}>;

export type GoogleIngestionConfig = Readonly<{
  googleApiKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}>;

const variableNames = [
  "GOOGLE_PLACES_API_KEY",
  "KC3_SUPABASE_URL",
  "KC3_SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function getGoogleIngestionConfig(
  environment: GoogleIngestionEnvironment = {
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    KC3_SUPABASE_URL: process.env.KC3_SUPABASE_URL,
    KC3_SUPABASE_SERVICE_ROLE_KEY: process.env.KC3_SUPABASE_SERVICE_ROLE_KEY,
  },
): GoogleIngestionConfig {
  const googleApiKey = environment.GOOGLE_PLACES_API_KEY?.trim();
  const supabaseUrl = environment.KC3_SUPABASE_URL?.trim();
  const supabaseServiceRoleKey =
    environment.KC3_SUPABASE_SERVICE_ROLE_KEY?.trim();

  const values = [googleApiKey, supabaseUrl, supabaseServiceRoleKey];
  const missing = variableNames.filter((_name, index) => !values[index]);
  if (missing.length > 0) {
    throw new Error(
      `Missing server-only ingestion configuration: ${missing.join(", ")}.`,
    );
  }

  if (!isHttpUrl(supabaseUrl!)) {
    throw new Error("KC3_SUPABASE_URL must be a valid HTTP or HTTPS URL.");
  }

  return {
    googleApiKey: googleApiKey!,
    supabaseUrl: supabaseUrl!,
    supabaseServiceRoleKey: supabaseServiceRoleKey!,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
