export type OperatorDatabaseEnvironment = Readonly<{
  KC3_SUPABASE_URL?: string;
  KC3_SUPABASE_SERVICE_ROLE_KEY?: string;
}>;

export type OperatorDatabaseConfig = Readonly<{
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}>;

export function getOperatorDatabaseConfig(
  environment: OperatorDatabaseEnvironment = {
    KC3_SUPABASE_URL: process.env.KC3_SUPABASE_URL,
    KC3_SUPABASE_SERVICE_ROLE_KEY: process.env.KC3_SUPABASE_SERVICE_ROLE_KEY,
  },
): OperatorDatabaseConfig {
  const supabaseUrl = environment.KC3_SUPABASE_URL?.trim();
  const supabaseServiceRoleKey =
    environment.KC3_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const missing = [
    !supabaseUrl ? "KC3_SUPABASE_URL" : undefined,
    !supabaseServiceRoleKey ? "KC3_SUPABASE_SERVICE_ROLE_KEY" : undefined,
  ].filter((name): name is string => name !== undefined);

  if (missing.length > 0) {
    throw new Error(
      `Missing server-only operator configuration: ${missing.join(", ")}.`,
    );
  }

  if (!isHttpUrl(supabaseUrl!)) {
    throw new Error("KC3_SUPABASE_URL must be a valid HTTP or HTTPS URL.");
  }

  return {
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
