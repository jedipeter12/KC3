export type PlaceType =
  "coffee_shop" | "cafe" | "boba_tea" | "library" | "coworking" | "park";

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
    };
    Enums: {
      place_type: PlaceType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type PublicPlace =
  Database["public"]["Functions"]["list_public_places"]["Returns"][number];
