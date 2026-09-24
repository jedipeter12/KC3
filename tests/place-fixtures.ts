import type {
  PublicPlaceDetail,
  PublicPlaceSummary,
} from "../src/types/database";

export function makePlaceSummary(
  overrides: Partial<PublicPlaceSummary> = {},
): PublicPlaceSummary {
  return {
    address: "1 Main St",
    address_precision: "street_address",
    bathroom_available: null,
    city: "Lenexa",
    drive_thru_available: null,
    drive_thru_only: null,
    food_beverage: "unknown",
    id: "00000000-0000-0000-0000-000000000001",
    kc3_last_verified_at: null,
    kc3_verification_state: "unverified",
    name: "First Place",
    outlets: "unknown",
    phone_calls_allowed: null,
    place_type: "coffee_shop",
    regular_hours_available: false,
    regular_hours_next_transition_at: null,
    regular_hours_observed_at: null,
    regular_hours_state: "unknown",
    wifi: "unknown",
    work_suitability: "unknown",
    ...overrides,
  };
}

export function makePlaceDetail(
  overrides: Partial<PublicPlaceDetail> = {},
): PublicPlaceDetail {
  return {
    ...makePlaceSummary(overrides),
    place_local_day_of_week: 1,
    regular_hours: [],
    seating_notes: null,
    ...overrides,
  };
}
