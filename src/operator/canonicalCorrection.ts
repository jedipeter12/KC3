import type { AddressPrecision, PlaceType } from "../types/database";

export const addressPrecisions = [
  "street_address",
  "approximate",
  "unknown",
] as const satisfies readonly AddressPrecision[];

export const placeTypes = [
  "coffee_shop",
  "cafe",
  "boba_tea",
  "library",
  "coworking",
  "park",
] as const satisfies readonly PlaceType[];

export type CanonicalPlaceValues = Readonly<{
  name: string;
  address: string;
  addressPrecision: AddressPrecision;
  placeType: PlaceType;
}>;

export type CanonicalCorrectionEvidence = Readonly<{
  sourceUrl: string;
  observedOn: string;
  notes: string;
}>;

export type CanonicalCorrectionPlace = CanonicalPlaceValues &
  Readonly<{
    id: string;
    city: string;
    status: "active";
    placeUpdatedAt: string;
    googlePlaceId: string;
    googleName: string | null;
    googleAddress: string | null;
    googlePrimaryType: string | null;
    googleTypes: string[];
    googleBusinessStatus: string | null;
    googleFetchedAt: string | null;
  }>;

export type CanonicalCorrectionWrite = Readonly<{
  expectedUpdatedAt: string;
  canonical: CanonicalPlaceValues;
  evidence: CanonicalCorrectionEvidence;
}>;

export const canonicalLabels: Readonly<
  Record<keyof CanonicalPlaceValues, string>
> = {
  name: "Name",
  address: "Address",
  addressPrecision: "Address precision",
  placeType: "Place type",
};

const correctionPlaceKeys = new Set([
  "id",
  "name",
  "city",
  "address",
  "addressPrecision",
  "placeType",
  "status",
  "placeUpdatedAt",
  "googlePlaceId",
  "googleName",
  "googleAddress",
  "googlePrimaryType",
  "googleTypes",
  "googleBusinessStatus",
  "googleFetchedAt",
]);

export function canonicalValues(
  place: CanonicalCorrectionPlace,
): CanonicalPlaceValues {
  return {
    name: place.name,
    address: place.address,
    addressPrecision: place.addressPrecision,
    placeType: place.placeType,
  };
}

export function changedCanonicalValues(
  before: CanonicalPlaceValues,
  after: CanonicalPlaceValues,
): (keyof CanonicalPlaceValues)[] {
  return (
    Object.keys(canonicalLabels) as (keyof CanonicalPlaceValues)[]
  ).filter((key) => before[key] !== after[key]);
}

export function assertValidCanonicalValues(values: CanonicalPlaceValues): void {
  if (typeof values.name !== "string" || !values.name.trim()) {
    throw new Error("Name cannot be blank.");
  }
  if (typeof values.address !== "string" || !values.address.trim()) {
    throw new Error("Address cannot be blank.");
  }
  if (!addressPrecisions.includes(values.addressPrecision)) {
    throw new Error("Invalid address precision value.");
  }
  if (!placeTypes.includes(values.placeType)) {
    throw new Error("Invalid place type value.");
  }
}

export function assertValidCorrectionEvidence(
  evidence: CanonicalCorrectionEvidence,
): void {
  if (!isHttpsUrl(evidence.sourceUrl)) {
    throw new Error("Source URL must be a valid HTTPS URL.");
  }
  if (!isIsoDate(evidence.observedOn)) {
    throw new Error("Source observation date must be a real YYYY-MM-DD date.");
  }
  if (typeof evidence.notes !== "string" || !evidence.notes.trim()) {
    throw new Error("Correction notes cannot be blank.");
  }
}

export function isCanonicalCorrectionPlace(
  value: unknown,
): value is CanonicalCorrectionPlace {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const place = value as Record<string, unknown>;
  try {
    assertValidCanonicalValues(place as CanonicalPlaceValues);
  } catch {
    return false;
  }
  return (
    typeof place.id === "string" &&
    typeof place.city === "string" &&
    place.status === "active" &&
    typeof place.placeUpdatedAt === "string" &&
    typeof place.googlePlaceId === "string" &&
    isNullableString(place.googleName) &&
    isNullableString(place.googleAddress) &&
    isNullableString(place.googlePrimaryType) &&
    Array.isArray(place.googleTypes) &&
    place.googleTypes.every((type) => typeof type === "string") &&
    isNullableString(place.googleBusinessStatus) &&
    isNullableString(place.googleFetchedAt) &&
    Object.keys(place).every((key) => correctionPlaceKeys.has(key))
  );
}

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
