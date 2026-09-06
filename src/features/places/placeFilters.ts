import type { PlaceType, PublicPlace } from "../../types/database";

export type PlaceFilters = Readonly<{
  city: string | null;
  nameQuery: string;
  placeType: PlaceType | null;
}>;

export type PlaceFilterOptions = Readonly<{
  cities: string[];
  placeTypes: PlaceType[];
}>;

export function normalizePlaceNameQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Applies every active constraint using AND behavior while preserving the
 * loaded place order.
 */
export function filterPlaces(
  places: readonly PublicPlace[],
  filters: PlaceFilters,
): PublicPlace[] {
  const normalizedNameQuery = normalizePlaceNameQuery(filters.nameQuery);

  return places.filter(
    (place) =>
      (normalizedNameQuery.length === 0 ||
        place.name.toLowerCase().includes(normalizedNameQuery)) &&
      (filters.city === null || place.city === filters.city) &&
      (filters.placeType === null || place.place_type === filters.placeType),
  );
}

/** Returns unique choices in the order they first appear in loaded records. */
export function getPlaceFilterOptions(
  places: readonly PublicPlace[],
): PlaceFilterOptions {
  const cities = new Set<string>();
  const placeTypes = new Set<PlaceType>();

  for (const place of places) {
    cities.add(place.city);
    placeTypes.add(place.place_type);
  }

  return {
    cities: [...cities],
    placeTypes: [...placeTypes],
  };
}
