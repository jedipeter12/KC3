import {
  filterPlaces,
  getPlaceFilterOptions,
  normalizePlaceNameQuery,
} from "../src/features/places/placeFilters";
import type { PublicPlace } from "../src/types/database";

const PLACES: PublicPlace[] = [
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Central Coffee",
    city: "Olathe",
    address: "3 Main St",
    place_type: "coffee_shop",
  },
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Central Library",
    city: "Lenexa",
    address: "1 Main St",
    place_type: "library",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "South Library",
    city: "Olathe",
    address: "2 Main St",
    place_type: "library",
  },
];

describe("place filters", () => {
  it("normalizes case and surrounding whitespace in a name query", () => {
    expect(normalizePlaceNameQuery("  CeNTrAl  ")).toBe("central");
    expect(
      filterPlaces(PLACES, {
        city: null,
        nameQuery: "  CENTRAL  ",
        placeType: null,
      }).map((place) => place.name),
    ).toEqual(["Central Coffee", "Central Library"]);
  });

  it("treats a whitespace-only name query as inactive", () => {
    expect(
      filterPlaces(PLACES, {
        city: null,
        nameQuery: "   ",
        placeType: null,
      }),
    ).toEqual(PLACES);
  });

  it("combines name, city, and place type constraints with AND behavior", () => {
    expect(
      filterPlaces(PLACES, {
        city: "Lenexa",
        nameQuery: "central",
        placeType: "library",
      }),
    ).toEqual([PLACES[1]]);

    expect(
      filterPlaces(PLACES, {
        city: "Olathe",
        nameQuery: "central",
        placeType: "library",
      }),
    ).toEqual([]);
  });

  it("derives unique choices from loaded records in their first-seen order", () => {
    expect(getPlaceFilterOptions(PLACES)).toEqual({
      cities: ["Olathe", "Lenexa"],
      placeTypes: ["coffee_shop", "library"],
    });
  });

  it("preserves loaded order in filtered results", () => {
    expect(
      filterPlaces(PLACES, {
        city: "Olathe",
        nameQuery: "",
        placeType: null,
      }).map((place) => place.id),
    ).toEqual([PLACES[0].id, PLACES[2].id]);
  });
});
