import {
  DEFAULT_PLACE_FILTERS,
  filterPlaces,
  getPlaceFilterOptions,
  normalizePlaceNameQuery,
} from "../src/features/places/placeFilters";
import type { PublicPlaceSummary } from "../src/types/database";
import { makePlaceSummary } from "./place-fixtures";

const PLACES: PublicPlaceSummary[] = [
  makePlaceSummary({
    bathroom_available: true,
    city: "Olathe",
    drive_thru_available: true,
    food_beverage: "light",
    id: "00000000-0000-0000-0000-000000000003",
    name: "Central Coffee",
    outlets: "few",
    phone_calls_allowed: true,
    regular_hours_available: true,
    regular_hours_state: "open",
    wifi: "public",
    work_suitability: "good",
  }),
  makePlaceSummary({
    city: "Lenexa",
    id: "00000000-0000-0000-0000-000000000001",
    name: "Central Library",
    place_type: "library",
    work_suitability: "okay",
  }),
  makePlaceSummary({
    city: "Olathe",
    drive_thru_available: true,
    drive_thru_only: true,
    id: "00000000-0000-0000-0000-000000000002",
    name: "South Library",
    place_type: "library",
  }),
];

describe("place filters", () => {
  it("normalizes name search and combines city/type constraints", () => {
    expect(normalizePlaceNameQuery("  CeNTrAl  ")).toBe("central");
    expect(
      filterPlaces(PLACES, {
        ...DEFAULT_PLACE_FILTERS,
        city: "Lenexa",
        nameQuery: "  CENTRAL  ",
        placeType: "library",
      }),
    ).toEqual([PLACES[1]]);
  });

  it("uses exact approved positive-filter semantics", () => {
    expect(
      filterPlaces(PLACES, {
        ...DEFAULT_PLACE_FILTERS,
        bathroomAvailable: true,
        driveThruAvailable: true,
        foodAvailable: true,
        goodForWork: true,
        openNow: true,
        outletsAvailable: true,
        phoneCallsAllowed: true,
        wifiAvailable: true,
      }),
    ).toEqual([PLACES[0]]);
  });

  it("hides only verified drive-thru-only places by default", () => {
    expect(filterPlaces(PLACES, DEFAULT_PLACE_FILTERS)).toEqual([
      PLACES[0],
      PLACES[1],
    ]);
    expect(
      filterPlaces(PLACES, {
        ...DEFAULT_PLACE_FILTERS,
        hideDriveThruOnly: false,
      }),
    ).toEqual(PLACES);
  });

  it("does not let unknown or known-negative values satisfy positives", () => {
    expect(
      filterPlaces(PLACES, {
        ...DEFAULT_PLACE_FILTERS,
        goodForWork: true,
        hideDriveThruOnly: false,
      }),
    ).toEqual([PLACES[0]]);
  });

  it("derives options and preserves loaded order", () => {
    expect(getPlaceFilterOptions(PLACES)).toEqual({
      cities: ["Olathe", "Lenexa"],
      placeTypes: ["coffee_shop", "library"],
    });
  });
});
