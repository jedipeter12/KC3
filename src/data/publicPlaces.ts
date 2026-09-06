import { supabase } from "../lib/supabase";
import type { PlaceType, PublicPlace } from "../types/database";

const PLACE_TYPES: readonly PlaceType[] = [
  "coffee_shop",
  "cafe",
  "boba_tea",
  "library",
  "coworking",
  "park",
];

export const PUBLIC_PLACES_ERROR_CODE = "PUBLIC_PLACES_UNAVAILABLE";
export const PUBLIC_PLACES_ERROR_MESSAGE =
  "We couldn't load places right now. Please try again.";

export class PublicPlacesError extends Error {
  readonly code = PUBLIC_PLACES_ERROR_CODE;

  constructor() {
    super(PUBLIC_PLACES_ERROR_MESSAGE);
    this.name = "PublicPlacesError";
  }
}

function isPlaceType(value: unknown): value is PlaceType {
  return PLACE_TYPES.includes(value as PlaceType);
}

function toPublicPlace(value: unknown): PublicPlace {
  if (!value || typeof value !== "object") {
    throw new PublicPlacesError();
  }

  const place = value as Record<string, unknown>;
  if (
    typeof place.id !== "string" ||
    typeof place.name !== "string" ||
    typeof place.city !== "string" ||
    typeof place.address !== "string" ||
    !isPlaceType(place.place_type)
  ) {
    throw new PublicPlacesError();
  }

  return {
    id: place.id,
    name: place.name,
    city: place.city,
    address: place.address,
    place_type: place.place_type,
  };
}

/**
 * Returns the server-ordered public place projection. An empty RPC array is a
 * successful empty result; provider failures and malformed responses use the
 * same safe application error without retaining provider details.
 */
export async function listPublicPlaces(): Promise<PublicPlace[]> {
  try {
    const { data, error } = await supabase.rpc("list_public_places");

    if (error || !Array.isArray(data)) {
      throw new PublicPlacesError();
    }

    return data.map(toPublicPlace);
  } catch (error) {
    if (error instanceof PublicPlacesError) {
      throw error;
    }

    throw new PublicPlacesError();
  }
}
