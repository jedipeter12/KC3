import type {
  FoodBeverageLevel,
  OutletLevel,
  PlaceType,
  WifiType,
  WorkSuitability,
} from "../types/database";

export const outletLevels = ["none", "few", "many", "unknown"] as const;
export const wifiTypes = [
  "public",
  "password_printed",
  "password_on_request",
  "none",
  "unknown",
] as const;
export const workSuitabilities = ["good", "okay", "poor", "unknown"] as const;
export const foodBeverageLevels = ["none", "light", "full", "unknown"] as const;

export type PlaceDetails = Readonly<{
  seatingNotes: string | null;
  outlets: OutletLevel;
  wifi: WifiType;
  workSuitability: WorkSuitability;
  foodBeverage: FoodBeverageLevel;
  phoneCallsAllowed: boolean | null;
  bathroomAvailable: boolean | null;
  driveThruAvailable: boolean | null;
  driveThruOnly: boolean | null;
  lastVerifiedAt: string | null;
  verificationNotes: string | null;
}>;

export type OperatorPlace = Readonly<{
  id: string;
  name: string;
  city: string;
  address: string;
  placeType: PlaceType;
  googlePlaceId: string;
  googleName: string | null;
  googleAddress: string | null;
  googleBusinessStatus: string | null;
  googleFetchedAt: string | null;
  detailUpdatedAt: string | null;
  details: PlaceDetails;
}>;

export type PlaceDetailsWrite = Readonly<{
  expectedUpdatedAt: string | null;
  details: PlaceDetails;
}>;

export const emptyPlaceDetails: PlaceDetails = {
  seatingNotes: null,
  outlets: "unknown",
  wifi: "unknown",
  workSuitability: "unknown",
  foodBeverage: "unknown",
  phoneCallsAllowed: null,
  bathroomAvailable: null,
  driveThruAvailable: null,
  driveThruOnly: null,
  lastVerifiedAt: null,
  verificationNotes: null,
};

export const detailLabels: Readonly<Record<keyof PlaceDetails, string>> = {
  seatingNotes: "Seating",
  outlets: "Outlets",
  wifi: "Wi-Fi",
  workSuitability: "Work suitability",
  foodBeverage: "Food/drinks",
  phoneCallsAllowed: "Phone calls",
  bathroomAvailable: "Bathroom",
  driveThruAvailable: "Drive-thru available",
  driveThruOnly: "Drive-thru only",
  lastVerifiedAt: "Last verified",
  verificationNotes: "Verification notes",
};

const operatorPlaceKeys = new Set([
  "id",
  "name",
  "city",
  "address",
  "placeType",
  "googlePlaceId",
  "googleName",
  "googleAddress",
  "googleBusinessStatus",
  "googleFetchedAt",
  "detailUpdatedAt",
  "details",
]);

export function changedDetails(
  before: PlaceDetails,
  after: PlaceDetails,
): (keyof PlaceDetails)[] {
  return (Object.keys(detailLabels) as (keyof PlaceDetails)[]).filter(
    (key) => before[key] !== after[key],
  );
}

export function displayDetailValue(
  value: PlaceDetails[keyof PlaceDetails],
): string {
  if (value === null) return "unknown / unset";
  if (value === true) return "yes";
  if (value === false) return "no";
  return value;
}

export function assertValidPlaceDetails(details: PlaceDetails): void {
  if (!outletLevels.includes(details.outlets)) throw invalid("outlets");
  if (!wifiTypes.includes(details.wifi)) throw invalid("wifi");
  if (!workSuitabilities.includes(details.workSuitability)) {
    throw invalid("work suitability");
  }
  if (!foodBeverageLevels.includes(details.foodBeverage)) {
    throw invalid("food/drinks");
  }
  for (const [label, value] of [
    ["phone calls", details.phoneCallsAllowed],
    ["bathroom", details.bathroomAvailable],
    ["drive-thru available", details.driveThruAvailable],
    ["drive-thru only", details.driveThruOnly],
  ] as const) {
    if (value !== null && typeof value !== "boolean") throw invalid(label);
  }
  if (details.driveThruOnly === true && details.driveThruAvailable !== true) {
    throw new Error(
      "Drive-thru only can be yes only when drive-thru available is yes.",
    );
  }
  if (
    details.lastVerifiedAt !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(details.lastVerifiedAt)
  ) {
    throw new Error("Last verified must use YYYY-MM-DD.");
  }
  for (const [label, value] of [
    ["seating", details.seatingNotes],
    ["verification notes", details.verificationNotes],
  ] as const) {
    if (value !== null && (typeof value !== "string" || !value.trim())) {
      throw invalid(label);
    }
  }
}

export function isOperatorPlace(value: unknown): value is OperatorPlace {
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
    [
      "coffee_shop",
      "cafe",
      "boba_tea",
      "library",
      "coworking",
      "park",
    ].includes(place.placeType) &&
    typeof place.googlePlaceId === "string" &&
    isNullableString(place.googleName) &&
    isNullableString(place.googleAddress) &&
    isNullableString(place.googleBusinessStatus) &&
    isNullableString(place.googleFetchedAt) &&
    isNullableString(place.detailUpdatedAt) &&
    isPlaceDetails(place.details) &&
    Object.keys(place).every((key) => operatorPlaceKeys.has(key))
  );
}

function isPlaceDetails(value: unknown): value is PlaceDetails {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  try {
    assertValidPlaceDetails(value as PlaceDetails);
    return (Object.keys(value) as string[]).every((key) => key in detailLabels);
  } catch {
    return false;
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function invalid(label: string): Error {
  return new Error(`Invalid ${label} value.`);
}
