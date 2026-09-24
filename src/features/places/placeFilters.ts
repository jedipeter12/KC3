import type { PlaceType, PublicPlaceSummary } from "../../types/database";

export type PlaceFilters = Readonly<{
  bathroomAvailable: boolean;
  city: string | null;
  driveThruAvailable: boolean;
  foodAvailable: boolean;
  goodForWork: boolean;
  hideDriveThruOnly: boolean;
  nameQuery: string;
  openNow: boolean;
  outletsAvailable: boolean;
  phoneCallsAllowed: boolean;
  placeType: PlaceType | null;
  wifiAvailable: boolean;
}>;

export type PlaceFilterOptions = Readonly<{
  cities: string[];
  placeTypes: PlaceType[];
}>;

const MVP_CITY_ORDER = ["Lenexa", "Overland Park", "Olathe"] as const;
const MVP_PLACE_TYPE_ORDER: readonly PlaceType[] = [
  "coffee_shop",
  "cafe",
  "boba_tea",
  "library",
  "coworking",
  "park",
];

export const DEFAULT_PLACE_FILTERS: PlaceFilters = {
  bathroomAvailable: false,
  city: null,
  driveThruAvailable: false,
  foodAvailable: false,
  goodForWork: false,
  hideDriveThruOnly: true,
  nameQuery: "",
  openNow: false,
  outletsAvailable: false,
  phoneCallsAllowed: false,
  placeType: null,
  wifiAvailable: false,
};

export function normalizePlaceNameQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function hasNonDefaultPlaceFilters(filters: PlaceFilters): boolean {
  return (
    normalizePlaceNameQuery(filters.nameQuery).length > 0 ||
    filters.city !== null ||
    filters.placeType !== null ||
    filters.openNow ||
    filters.goodForWork ||
    filters.wifiAvailable ||
    filters.outletsAvailable ||
    filters.foodAvailable ||
    filters.phoneCallsAllowed ||
    filters.bathroomAvailable ||
    filters.driveThruAvailable ||
    !filters.hideDriveThruOnly
  );
}

/** Applies every active constraint while preserving the server-provided order. */
export function filterPlaces(
  places: readonly PublicPlaceSummary[],
  filters: PlaceFilters,
): PublicPlaceSummary[] {
  const normalizedNameQuery = normalizePlaceNameQuery(filters.nameQuery);

  return places.filter(
    (place) =>
      (normalizedNameQuery.length === 0 ||
        place.name.toLowerCase().includes(normalizedNameQuery)) &&
      (filters.city === null || place.city === filters.city) &&
      (filters.placeType === null || place.place_type === filters.placeType) &&
      (!filters.openNow ||
        (place.regular_hours_available &&
          place.regular_hours_state === "open")) &&
      (!filters.goodForWork || place.work_suitability === "good") &&
      (!filters.wifiAvailable ||
        (place.wifi !== "none" && place.wifi !== "unknown")) &&
      (!filters.outletsAvailable ||
        place.outlets === "few" ||
        place.outlets === "many") &&
      (!filters.foodAvailable ||
        place.food_beverage === "light" ||
        place.food_beverage === "full") &&
      (!filters.phoneCallsAllowed || place.phone_calls_allowed === true) &&
      (!filters.bathroomAvailable || place.bathroom_available === true) &&
      (!filters.driveThruAvailable || place.drive_thru_available === true) &&
      (!filters.hideDriveThruOnly || place.drive_thru_only !== true),
  );
}

/** Returns loaded choices in the stable approved MVP order. */
export function getPlaceFilterOptions(
  places: readonly PublicPlaceSummary[],
): PlaceFilterOptions {
  const cities = new Set<string>();
  const placeTypes = new Set<PlaceType>();

  for (const place of places) {
    cities.add(place.city);
    placeTypes.add(place.place_type);
  }

  return {
    cities: MVP_CITY_ORDER.filter((city) => cities.has(city)),
    placeTypes: MVP_PLACE_TYPE_ORDER.filter((placeType) =>
      placeTypes.has(placeType),
    ),
  };
}
