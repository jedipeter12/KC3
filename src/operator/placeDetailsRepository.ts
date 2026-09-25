import { createClient } from "@supabase/supabase-js";

import type { OperatorDatabaseConfig } from "../config/operatorDatabase";
import {
  assertValidPlaceDetails,
  isOperatorPlace,
  type OperatorPlace,
  type PlaceDetailsWrite,
} from "./placeDetails";

type OperatorDatabase = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      kc3_search_places_for_details: {
        Args: { name_query: string; city_query: string };
        Returns: OperatorPlace[];
      };
      kc3_upsert_place_details: {
        Args: { target_place_id: string; payload: PlaceDetailsWrite };
        Returns: OperatorPlace;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type PlaceDetailsRepository = Readonly<{
  search(name: string, city: string): Promise<OperatorPlace[]>;
  save(placeId: string, write: PlaceDetailsWrite): Promise<OperatorPlace>;
}>;

export function createPlaceDetailsRepository(
  config: OperatorDatabaseConfig,
): PlaceDetailsRepository {
  const client = createClient<OperatorDatabase>(
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
        "kc3_search_places_for_details",
        { name_query: name, city_query: city },
      );
      if (error || !Array.isArray(data) || !data.every(isOperatorPlace)) {
        throw new Error("Database search failed.");
      }
      return data;
    },

    async save(placeId, write) {
      assertValidPlaceDetails(write.details);
      const { data, error } = await client.rpc("kc3_upsert_place_details", {
        target_place_id: placeId,
        payload: write,
      });
      if (error || !isOperatorPlace(data)) {
        throw new Error("Database write failed; no changes were saved.");
      }
      return data;
    },
  };
}
