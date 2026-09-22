export type PlaceType =
  "coffee_shop" | "cafe" | "boba_tea" | "library" | "coworking" | "park";

export type AddressPrecision = "street_address" | "approximate" | "unknown";

export type OutletLevel = "none" | "few" | "many" | "unknown";
export type WifiType =
  "public" | "password_printed" | "password_on_request" | "none" | "unknown";
export type WorkSuitability = "good" | "okay" | "poor" | "unknown";
export type FoodBeverageLevel = "none" | "light" | "full" | "unknown";
export type RegularHoursState = "open" | "closed" | "unknown";
export type Kc3VerificationState = "unverified" | "current" | "stale";

export type PublicRegularHoursRow = {
  close_time: string | null;
  closes_next_day: boolean;
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
};

export type PublicPlaceSummary = {
  address: string;
  address_precision: AddressPrecision;
  bathroom_available: boolean | null;
  city: string;
  drive_thru_available: boolean | null;
  drive_thru_only: boolean | null;
  food_beverage: FoodBeverageLevel;
  id: string;
  kc3_last_verified_at: string | null;
  kc3_verification_state: Kc3VerificationState;
  name: string;
  outlets: OutletLevel;
  phone_calls_allowed: boolean | null;
  place_type: PlaceType;
  regular_hours_available: boolean;
  regular_hours_next_transition_at: string | null;
  regular_hours_observed_at: string | null;
  regular_hours_state: RegularHoursState;
  wifi: WifiType;
  work_suitability: WorkSuitability;
};

export type PublicPlaceDetail = PublicPlaceSummary & {
  regular_hours: PublicRegularHoursRow[];
  seating_notes: string | null;
};

/**
 * The client-visible database contract. It intentionally describes only the
 * approved anonymous RPC; base tables are not part of the client API.
 */
export type Database = {
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      list_public_places: {
        Args: never;
        Returns: {
          address: string;
          city: string;
          id: string;
          name: string;
          place_type: PlaceType;
        }[];
      };
      list_public_place_summaries: {
        Args: never;
        Returns: PublicPlaceSummary[];
      };
      get_public_place_detail: {
        Args: { target_place_id: string };
        Returns: PublicPlaceDetail[];
      };
    };
    Enums: {
      address_precision: AddressPrecision;
      food_beverage_level: FoodBeverageLevel;
      kc3_verification_state: Kc3VerificationState;
      outlet_level: OutletLevel;
      place_type: PlaceType;
      regular_hours_state: RegularHoursState;
      wifi_type: WifiType;
      work_suitability: WorkSuitability;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type PublicPlace =
  Database["public"]["Functions"]["list_public_places"]["Returns"][number];
