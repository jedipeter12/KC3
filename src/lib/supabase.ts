import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "../config/supabase";
import type { Database } from "../types/database";

const config = getPublicSupabaseConfig();

export const supabase = createClient<Database>(
  config.url,
  config.publishableKey,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  },
);
