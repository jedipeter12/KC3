import { createClient } from "@supabase/supabase-js";

import type { GoogleIngestionConfig } from "../config/googleIngestion";
import type {
  ExistingGooglePlace,
  GoogleImportPayload,
} from "./googlePlaceIngestion";
import type { GoogleImportRepository } from "./googleImportRunner";

type ImportDatabase = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      kc3_google_import_state: {
        Args: never;
        Returns: ExistingGooglePlace[];
      };
      kc3_import_google_place: {
        Args: { payload: GoogleImportPayload };
        Returns: { placeId: string; action: "inserted" | "updated" };
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export function createGoogleImportRepository(
  config: Pick<GoogleIngestionConfig, "supabaseUrl" | "supabaseServiceRoleKey">,
): GoogleImportRepository {
  const client = createClient<ImportDatabase>(
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
    async listExisting() {
      const { data, error } = await client.rpc("kc3_google_import_state");
      if (error || !Array.isArray(data) || !data.every(isExistingGooglePlace)) {
        throw new Error("Database read failed.");
      }
      return data;
    },

    async importPlace(payload) {
      const { data, error } = await client.rpc("kc3_import_google_place", {
        payload,
      });
      if (
        error ||
        data == null ||
        typeof data.placeId !== "string" ||
        !["inserted", "updated"].includes(data.action)
      ) {
        throw new Error("Database write failed.");
      }
      return data;
    },
  };
}

const placeTypes = new Set([
  "coffee_shop",
  "cafe",
  "boba_tea",
  "library",
  "coworking",
  "park",
]);
const placeStatuses = new Set([
  "active",
  "temporarily_closed",
  "permanently_closed",
  "hidden",
]);

function isExistingGooglePlace(value: unknown): value is ExistingGooglePlace {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const place = value as Record<string, unknown>;
  return (
    typeof place.id === "string" &&
    typeof place.name === "string" &&
    typeof place.city === "string" &&
    typeof place.address === "string" &&
    typeof place.placeType === "string" &&
    placeTypes.has(place.placeType) &&
    (place.googlePlaceId == null || typeof place.googlePlaceId === "string") &&
    (place.latitude == null || typeof place.latitude === "number") &&
    (place.longitude == null || typeof place.longitude === "number") &&
    (place.timeZone == null || typeof place.timeZone === "string") &&
    typeof place.status === "string" &&
    placeStatuses.has(place.status) &&
    (place.googleBusinessStatus == null ||
      typeof place.googleBusinessStatus === "string") &&
    Array.isArray(place.googleHours) &&
    place.googleHours.every(isNormalizedHour)
  );
}

function isNormalizedHour(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const hour = value as Record<string, unknown>;
  return (
    Number.isInteger(hour.dayOfWeek) &&
    typeof hour.isClosed === "boolean" &&
    typeof hour.closesNextDay === "boolean" &&
    (hour.openTime == null || typeof hour.openTime === "string") &&
    (hour.closeTime == null || typeof hour.closeTime === "string")
  );
}
