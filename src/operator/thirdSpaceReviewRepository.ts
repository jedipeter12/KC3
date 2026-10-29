import { createClient } from "@supabase/supabase-js";
import type { OperatorDatabaseConfig } from "../config/operatorDatabase";
import type { DiscoverySource } from "../types/database";
import {
  isThirdSpaceReviewRecord,
  type ThirdSpaceReviewRecord,
  type ThirdSpaceReviewWrite,
  type UnreviewedPlace,
} from "./thirdSpaceReview";

type OperatorDatabase = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      kc3_get_unreviewed_third_space_place: {
        Args: { target_place_id: string };
        Returns: UnreviewedPlace | null;
      };
      kc3_start_third_space_review: {
        Args: {
          target_place_id: string;
          source_value: DiscoverySource;
          discovered_on: string;
          expected_place_updated_at: string;
        };
        Returns: ThirdSpaceReviewRecord;
      };
      kc3_search_third_space_reviews: {
        Args: { name_query: string; city_query: string; source_query: string };
        Returns: ThirdSpaceReviewRecord[];
      };
      kc3_save_third_space_review: {
        Args: { target_discovery_id: string; payload: ThirdSpaceReviewWrite };
        Returns: ThirdSpaceReviewRecord;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type ThirdSpaceReviewRepository = {
  unreviewedPlace(id: string): Promise<UnreviewedPlace | null>;
  start(
    place: UnreviewedPlace,
    source: DiscoverySource,
    discoveredAt: string,
  ): Promise<ThirdSpaceReviewRecord>;
  search(
    name: string,
    city: string,
    source: string,
  ): Promise<ThirdSpaceReviewRecord[]>;
  save(
    id: string,
    write: ThirdSpaceReviewWrite,
  ): Promise<ThirdSpaceReviewRecord>;
};

export function createThirdSpaceReviewRepository(
  config: OperatorDatabaseConfig,
): ThirdSpaceReviewRepository {
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
    async unreviewedPlace(id) {
      const { data, error } = await client.rpc(
        "kc3_get_unreviewed_third_space_place",
        { target_place_id: id },
      );
      if (error) throw new Error("Canonical place lookup failed.");
      if (data === null) return null;
      if (
        !data ||
        data.id !== id ||
        !Array.isArray(data.hours) ||
        !Array.isArray(data.effectiveHours)
      )
        throw new Error("Unexpected canonical place response.");
      return data;
    },
    async start(place, source, discoveredAt) {
      const { data, error } = await client.rpc("kc3_start_third_space_review", {
        target_place_id: place.id,
        source_value: source,
        discovered_on: discoveredAt,
        expected_place_updated_at: place.updatedAt,
      });
      if (error || !isThirdSpaceReviewRecord(data)) {
        if (error?.code === "40001")
          throw new Error("Canonical place changed. Look it up again.");
        throw new Error(
          "Could not start discovery review; no review was saved.",
        );
      }
      return data;
    },
    async search(name, city, source) {
      const { data, error } = await client.rpc(
        "kc3_search_third_space_reviews",
        {
          name_query: name,
          city_query: city,
          source_query: source,
        },
      );
      if (
        error ||
        !Array.isArray(data) ||
        !data.every(isThirdSpaceReviewRecord)
      ) {
        throw new Error("Discovery search failed.");
      }
      return data;
    },
    async save(id, write) {
      const { data, error } = await client.rpc("kc3_save_third_space_review", {
        target_discovery_id: id,
        payload: write,
      });
      if (error || !isThirdSpaceReviewRecord(data)) {
        if (error?.code === "40001")
          throw new Error(
            "Review is stale. Search again and inspect current values.",
          );
        throw new Error("Review write failed; no changes were saved.");
      }
      return data;
    },
  };
}
