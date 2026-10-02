import { createClient } from "@supabase/supabase-js";

import type { OperatorDatabaseConfig } from "../config/operatorDatabase";
import {
  assertValidCanonicalValues,
  assertValidCorrectionEvidence,
  isCanonicalCorrectionPlace,
  type CanonicalCorrectionPlace,
  type CanonicalCorrectionWrite,
} from "./canonicalCorrection";

type CanonicalCorrectionDatabase = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      kc3_search_places_for_canonical_correction: {
        Args: { name_query: string; city_query: string };
        Returns: CanonicalCorrectionPlace[];
      };
      kc3_correct_canonical_place: {
        Args: {
          target_place_id: string;
          payload: CanonicalCorrectionWrite;
        };
        Returns: CanonicalCorrectionPlace;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type CanonicalCorrectionRepository = Readonly<{
  search(name: string, city: string): Promise<CanonicalCorrectionPlace[]>;
  save(
    placeId: string,
    write: CanonicalCorrectionWrite,
  ): Promise<CanonicalCorrectionPlace>;
}>;

export function createCanonicalCorrectionRepository(
  config: OperatorDatabaseConfig,
): CanonicalCorrectionRepository {
  const client = createClient<CanonicalCorrectionDatabase>(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );

  return {
    async search(name, city) {
      const { data, error } = await client.rpc(
        "kc3_search_places_for_canonical_correction",
        { name_query: name, city_query: city },
      );
      if (
        error ||
        !Array.isArray(data) ||
        !data.every(isCanonicalCorrectionPlace)
      ) {
        throw new Error("Database search failed.");
      }
      return data;
    },

    async save(placeId, write) {
      assertValidCanonicalValues(write.canonical);
      assertValidCorrectionEvidence(write.evidence);
      if (!write.expectedUpdatedAt.trim()) {
        throw new Error("Expected place version is required.");
      }
      const { data, error } = await client.rpc("kc3_correct_canonical_place", {
        target_place_id: placeId,
        payload: write,
      });
      if (error || !isCanonicalCorrectionPlace(data)) {
        throw new Error("Database write failed; no changes were saved.");
      }
      return data;
    },
  };
}
