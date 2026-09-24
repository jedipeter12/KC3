import type {
  PublicPlace,
  PublicPlaceDetail,
  PublicPlaceSummary,
} from "../src/types/database";

type ExpectedPublicPlace = {
  address: string;
  city: string;
  id: string;
  name: string;
  place_type:
    "coffee_shop" | "cafe" | "boba_tea" | "library" | "coworking" | "park";
};

type TypesAreEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

describe("public place database type", () => {
  it("contains exactly the five approved RPC fields", () => {
    const contractIsExact: TypesAreEqual<PublicPlace, ExpectedPublicPlace> =
      true;
    const place: PublicPlace = {
      address: "123 Main St",
      city: "Olathe",
      id: "00000000-0000-0000-0000-000000000001",
      name: "Example Place",
      place_type: "coffee_shop",
    };

    expect(Object.keys(place).sort()).toEqual([
      "address",
      "city",
      "id",
      "name",
      "place_type",
    ]);
    expect(contractIsExact).toBe(true);
  });

  it("keeps summary and detail fields distinct", () => {
    const summary: PublicPlaceSummary = {
      address: "123 Main St",
      address_precision: "street_address",
      bathroom_available: null,
      city: "Olathe",
      drive_thru_available: null,
      drive_thru_only: null,
      food_beverage: "unknown",
      id: "00000000-0000-0000-0000-000000000001",
      kc3_last_verified_at: null,
      kc3_verification_state: "unverified",
      name: "Example Place",
      outlets: "unknown",
      phone_calls_allowed: null,
      place_type: "coffee_shop",
      regular_hours_available: false,
      regular_hours_next_transition_at: null,
      regular_hours_observed_at: null,
      regular_hours_state: "unknown",
      wifi: "unknown",
      work_suitability: "unknown",
    };
    const detail: PublicPlaceDetail = {
      ...summary,
      place_local_day_of_week: null,
      regular_hours: [],
      seating_notes: null,
    };

    expect("regular_hours" in summary).toBe(false);
    expect(detail.regular_hours).toEqual([]);
  });
});
