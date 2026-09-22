import type { PlaceType } from "../types/database";
import {
  classifyLocationChange,
  classifyTextChange,
  normalizeCosmeticText,
  normalizeGoogleRegularHours,
  type Coordinates,
  type HoursNormalization,
  type NormalizedHoursRow,
} from "./googleContract";

const businessStatuses = new Set([
  "BUSINESS_STATUS_UNSPECIFIED",
  "OPERATIONAL",
  "CLOSED_TEMPORARILY",
  "CLOSED_PERMANENTLY",
  "FUTURE_OPENING",
]);

const priceLevels = new Set([
  "PRICE_LEVEL_UNSPECIFIED",
  "PRICE_LEVEL_FREE",
  "PRICE_LEVEL_INEXPENSIVE",
  "PRICE_LEVEL_MODERATE",
  "PRICE_LEVEL_EXPENSIVE",
  "PRICE_LEVEL_VERY_EXPENSIVE",
]);

const cityComponentPriority = [
  "locality",
  "postal_town",
  "administrative_area_level_3",
] as const;

export type PlaceStatus =
  "active" | "temporarily_closed" | "permanently_closed" | "hidden";

export type GoogleProviderValues = {
  name?: string;
  address?: string;
  addressComponents?: unknown[];
  latitude?: number;
  longitude?: number;
  businessStatus?: string;
  primaryType?: string;
  types?: string[];
  timeZone?: string;
  movedPlaceId?: string;
  mapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  priceLevel?: string;
};

export type NormalizedGooglePlace = Readonly<{
  googlePlaceId: string;
  provider: GoogleProviderValues;
  cityCandidate?: string;
  location?: Coordinates;
  hours: HoursNormalization;
}>;

export type ExistingGooglePlace = Readonly<{
  id: string;
  name: string;
  city: string;
  address: string;
  placeType: PlaceType;
  googlePlaceId: string | null;
  latitude: number | null;
  longitude: number | null;
  timeZone: string | null;
  status: PlaceStatus;
  googleBusinessStatus: string | null;
  googleHours: NormalizedHoursRow[];
}>;

export type GoogleImportPayload = Readonly<{
  googlePlaceId: string;
  expectedPlaceId?: string;
  placeType: PlaceType;
  fetchedAt: string;
  provider: GoogleProviderValues;
  canonical: {
    name?: string;
    city?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    timeZone?: string;
    status?: PlaceStatus;
  };
  hours?: NormalizedHoursRow[];
}>;

export type GooglePlacePlan =
  | {
      disposition: "write";
      action: "inserted" | "updated";
      payload: GoogleImportPayload;
      notices: string[];
    }
  | { disposition: "skip"; reason: string };

export type GooglePlaceNormalization =
  { ok: true; value: NormalizedGooglePlace } | { ok: false; reason: string };

export type GoogleImportResolution = Readonly<{
  existingPlaceId?: string;
  createNew?: boolean;
}>;

export function normalizeGooglePlaceResponse(
  input: unknown,
  expectedGooglePlaceId?: string,
): GooglePlaceNormalization {
  if (!isRecord(input)) {
    return invalid("response must be an object");
  }

  const id = optionalNonblankString(input, "id");
  if (id.invalid || !id.value) {
    return invalid("id is missing or invalid");
  }
  if (expectedGooglePlaceId && id.value !== expectedGooglePlaceId) {
    return invalid("response id does not match the requested place");
  }

  const provider: GoogleProviderValues = {};

  if (input.displayName != null) {
    if (!isRecord(input.displayName)) {
      return invalid("displayName must be an object");
    }
    const name = optionalNonblankString(input.displayName, "text");
    if (name.invalid) return invalid("displayName.text is invalid");
    if (name.value) provider.name = name.value;
  }

  const address = optionalNonblankString(input, "formattedAddress");
  if (address.invalid) return invalid("formattedAddress is invalid");
  if (address.value) provider.address = address.value;

  let cityCandidate: string | undefined;
  if (input.addressComponents != null) {
    if (!Array.isArray(input.addressComponents)) {
      return invalid("addressComponents must be an array");
    }
    if (input.addressComponents.length > 0) {
      if (!input.addressComponents.every(isAddressComponent)) {
        return invalid("addressComponents contains an invalid component");
      }
      provider.addressComponents = input.addressComponents;
      cityCandidate = extractCity(input.addressComponents);
    }
  }

  let location: Coordinates | undefined;
  if (input.location != null) {
    if (!isRecord(input.location)) {
      return invalid("location must be an object");
    }
    if (
      !isFiniteNumber(input.location.latitude) ||
      !isFiniteNumber(input.location.longitude) ||
      input.location.latitude < -90 ||
      input.location.latitude > 90 ||
      input.location.longitude < -180 ||
      input.location.longitude > 180
    ) {
      return invalid("location must contain a valid coordinate pair");
    }
    location = {
      latitude: input.location.latitude,
      longitude: input.location.longitude,
    };
    provider.latitude = location.latitude;
    provider.longitude = location.longitude;
  }

  const businessStatus = optionalEnum(
    input,
    "businessStatus",
    businessStatuses,
  );
  if (businessStatus.invalid) return invalid("businessStatus is invalid");
  if (businessStatus.value) provider.businessStatus = businessStatus.value;

  const primaryType = optionalNonblankString(input, "primaryType");
  if (primaryType.invalid) return invalid("primaryType is invalid");
  if (primaryType.value) provider.primaryType = primaryType.value;

  const types = optionalStringArray(input, "types");
  if (types.invalid) return invalid("types is invalid");
  if (types.value && types.value.length > 0) provider.types = types.value;

  if (input.timeZone != null) {
    if (!isRecord(input.timeZone)) return invalid("timeZone must be an object");
    const timeZone = optionalNonblankString(input.timeZone, "id");
    if (timeZone.invalid || (timeZone.value && !isTimeZone(timeZone.value))) {
      return invalid("timeZone.id is invalid");
    }
    if (timeZone.value) provider.timeZone = timeZone.value;
  }

  for (const [inputKey, providerKey] of [
    ["movedPlaceId", "movedPlaceId"],
    ["googleMapsUri", "mapsUri"],
    ["websiteUri", "websiteUri"],
  ] as const) {
    const value = optionalNonblankString(input, inputKey);
    if (value.invalid) return invalid(`${inputKey} is invalid`);
    if (value.value) {
      if (inputKey !== "movedPlaceId" && !isHttpUrl(value.value)) {
        return invalid(`${inputKey} is invalid`);
      }
      provider[providerKey] = value.value;
    }
  }

  const rating = optionalNumber(input, "rating");
  if (
    rating.invalid ||
    (rating.value != null && (rating.value < 1 || rating.value > 5))
  ) {
    return invalid("rating is invalid");
  }
  if (rating.value != null) provider.rating = rating.value;

  const ratingCount = optionalNumber(input, "userRatingCount");
  if (
    ratingCount.invalid ||
    (ratingCount.value != null &&
      (!Number.isInteger(ratingCount.value) || ratingCount.value < 0))
  ) {
    return invalid("userRatingCount is invalid");
  }
  if (ratingCount.value != null) provider.userRatingCount = ratingCount.value;

  const priceLevel = optionalEnum(input, "priceLevel", priceLevels);
  if (priceLevel.invalid) return invalid("priceLevel is invalid");
  if (priceLevel.value) provider.priceLevel = priceLevel.value;

  let regularHours: Parameters<typeof normalizeGoogleRegularHours>[0];
  if (input.regularOpeningHours != null) {
    if (!isRecord(input.regularOpeningHours)) {
      return invalid("regularOpeningHours must be an object");
    }
    regularHours = input.regularOpeningHours;
  }
  const hours = normalizeGoogleRegularHours(
    regularHours,
    provider.businessStatus,
  );
  if (hours.disposition === "reject") {
    return invalid(`regularOpeningHours is invalid: ${hours.reason}`);
  }

  return {
    ok: true,
    value: {
      googlePlaceId: id.value,
      provider,
      cityCandidate,
      location,
      hours,
    },
  };
}

export function planGooglePlaceImport(
  place: NormalizedGooglePlace,
  placeType: PlaceType,
  fetchedAt: string,
  existingPlaces: readonly ExistingGooglePlace[],
  resolution: GoogleImportResolution = {},
): GooglePlacePlan {
  const providerMatch = existingPlaces.find(
    (candidate) => candidate.googlePlaceId === place.googlePlaceId,
  );
  if (resolution.existingPlaceId && resolution.createNew) {
    return {
      disposition: "skip",
      reason: "conflicting attach and create resolutions",
    };
  }
  const attachment = resolution.existingPlaceId
    ? existingPlaces.find(
        (candidate) => candidate.id === resolution.existingPlaceId,
      )
    : undefined;
  if (resolution.existingPlaceId && !attachment) {
    return {
      disposition: "skip",
      reason: `attach target ${resolution.existingPlaceId} does not exist`,
    };
  }
  if (
    attachment?.googlePlaceId &&
    attachment.googlePlaceId !== place.googlePlaceId
  ) {
    return {
      disposition: "skip",
      reason: `attach target ${attachment.id} already has a different provider identity`,
    };
  }
  if (providerMatch && attachment && providerMatch.id !== attachment.id) {
    return {
      disposition: "skip",
      reason: "provider identity and attach target resolve to different places",
    };
  }
  const existing = providerMatch ?? attachment;

  if (place.provider.movedPlaceId) {
    return {
      disposition: "skip",
      reason: "listing has movedPlaceId and requires operator move resolution",
    };
  }

  if (!existing) {
    const missing = [
      !place.provider.name && "name",
      !place.provider.address && "formatted address",
      !place.cityCandidate && "city",
      !place.location && "coordinates",
      !place.provider.timeZone && "time zone",
    ].filter(Boolean);
    if (missing.length > 0) {
      return {
        disposition: "skip",
        reason: `new place is missing ${missing.join(", ")}`,
      };
    }

    const duplicate = findDuplicateCandidate(place, existingPlaces);
    if (duplicate && !resolution.createNew) {
      return {
        disposition: "skip",
        reason: `possible duplicate of KC3 place ${duplicate.id}; attach or create requires explicit resolution`,
      };
    }

    return {
      disposition: "write",
      action: "inserted",
      notices: [],
      payload: {
        googlePlaceId: place.googlePlaceId,
        placeType,
        fetchedAt,
        provider: place.provider,
        canonical: {
          name: place.provider.name!,
          city: place.cityCandidate!,
          address: place.provider.address!,
          latitude: place.location!.latitude,
          longitude: place.location!.longitude,
          timeZone: place.provider.timeZone!,
          status:
            providerStatusToCanonical(place.provider.businessStatus) ??
            "active",
        },
        ...(place.hours.disposition === "replace"
          ? { hours: place.hours.rows }
          : {}),
      },
    };
  }

  const currentLocation =
    existing.latitude == null || existing.longitude == null
      ? null
      : { latitude: existing.latitude, longitude: existing.longitude };
  const locationChange = classifyLocationChange(
    currentLocation,
    place.location,
  );
  if (locationChange.kind === "review") {
    return {
      disposition: "skip",
      reason: `coordinate change of ${Math.round(locationChange.distanceMeters)}m requires review`,
    };
  }
  if (
    place.provider.timeZone &&
    existing.timeZone &&
    place.provider.timeZone !== existing.timeZone
  ) {
    return { disposition: "skip", reason: "time-zone change requires review" };
  }

  const canonical: GoogleImportPayload["canonical"] = {};
  const notices: string[] = attachment
    ? ["provider identity attached to an existing KC3 place"]
    : [];
  const nameChange = classifyTextChange(existing.name, place.provider.name);
  if (nameChange === "cosmetic") canonical.name = place.provider.name;
  if (nameChange === "substantive") notices.push("substantive name change");

  const addressChange = classifyTextChange(
    existing.address,
    place.provider.address,
  );
  if (addressChange === "cosmetic") canonical.address = place.provider.address;
  if (addressChange === "substantive") {
    notices.push("substantive address change");
  }

  if (place.cityCandidate) {
    const cityChange = classifyTextChange(existing.city, place.cityCandidate);
    if (cityChange === "cosmetic") canonical.city = place.cityCandidate;
    if (cityChange === "substantive") notices.push("substantive city change");
  }
  if (
    place.location &&
    (locationChange.kind === "initialize" ||
      (locationChange.kind === "unchanged" &&
        locationChange.distanceMeters > 0))
  ) {
    canonical.latitude = place.location.latitude;
    canonical.longitude = place.location.longitude;
  }
  if (place.provider.timeZone && !existing.timeZone) {
    canonical.timeZone = place.provider.timeZone;
  }

  const incomingStatus = providerStatusToCanonical(
    place.provider.businessStatus,
  );
  const previousProviderStatus = providerStatusToCanonical(
    existing.googleBusinessStatus ?? undefined,
  );
  if (
    incomingStatus &&
    incomingStatus !== existing.status &&
    existing.status !== "hidden" &&
    (existing.googleBusinessStatus == null ||
      previousProviderStatus === existing.status)
  ) {
    canonical.status = incomingStatus;
  }

  return {
    disposition: "write",
    action: "updated",
    notices,
    payload: {
      googlePlaceId: place.googlePlaceId,
      expectedPlaceId: existing.id,
      placeType: existing.placeType,
      fetchedAt,
      provider: place.provider,
      canonical,
      ...(place.hours.disposition === "replace" &&
      !hoursAreEqual(place.hours.rows, existing.googleHours)
        ? { hours: place.hours.rows }
        : {}),
    },
  };
}

function hoursAreEqual(
  incoming: readonly NormalizedHoursRow[],
  existing: readonly NormalizedHoursRow[],
): boolean {
  if (incoming.length !== existing.length) return false;

  const incomingRows = [...incoming].sort(compareNormalizedHoursRows);
  const existingRows = [...existing].sort(compareNormalizedHoursRows);

  return incomingRows.every((row, index) => {
    const stored = existingRows[index];
    return (
      row.dayOfWeek === stored.dayOfWeek &&
      row.openTime === stored.openTime &&
      row.closeTime === stored.closeTime &&
      row.isClosed === stored.isClosed &&
      row.closesNextDay === stored.closesNextDay
    );
  });
}

function compareNormalizedHoursRows(
  first: NormalizedHoursRow,
  second: NormalizedHoursRow,
): number {
  return (
    first.dayOfWeek - second.dayOfWeek ||
    (first.openTime ?? "99:99").localeCompare(second.openTime ?? "99:99") ||
    (first.closeTime ?? "99:99").localeCompare(second.closeTime ?? "99:99") ||
    Number(first.isClosed) - Number(second.isClosed) ||
    Number(first.closesNextDay) - Number(second.closesNextDay)
  );
}

export function findDuplicateCandidate(
  place: NormalizedGooglePlace,
  existingPlaces: readonly ExistingGooglePlace[],
): ExistingGooglePlace | undefined {
  if (!place.provider.name || !place.provider.address || !place.location) {
    return undefined;
  }
  return existingPlaces.find((candidate) => {
    const identityTextMatches =
      normalizeCosmeticText(candidate.name) ===
        normalizeCosmeticText(place.provider.name!) &&
      normalizeCosmeticText(candidate.address) ===
        normalizeCosmeticText(place.provider.address!);
    if (!identityTextMatches) return false;
    if (candidate.latitude == null || candidate.longitude == null) return true;
    return (
      classifyLocationChange(
        { latitude: candidate.latitude, longitude: candidate.longitude },
        place.location,
      ).kind === "unchanged"
    );
  });
}

function providerStatusToCanonical(
  status: string | undefined,
): Exclude<PlaceStatus, "hidden"> | undefined {
  if (status === "OPERATIONAL") return "active";
  if (status === "CLOSED_TEMPORARILY") return "temporarily_closed";
  if (status === "CLOSED_PERMANENTLY") return "permanently_closed";
  return undefined;
}

function extractCity(components: unknown[]): string | undefined {
  for (const wantedType of cityComponentPriority) {
    for (const component of components) {
      if (
        isRecord(component) &&
        Array.isArray(component.types) &&
        component.types.includes(wantedType) &&
        typeof component.longText === "string" &&
        component.longText.trim()
      ) {
        return component.longText.trim();
      }
    }
  }
  return undefined;
}

function isAddressComponent(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.longText === "string" &&
    value.longText.trim().length > 0 &&
    (value.types == null ||
      (Array.isArray(value.types) &&
        value.types.every(
          (type) => typeof type === "string" && type.trim().length > 0,
        ))) &&
    (value.shortText == null || typeof value.shortText === "string") &&
    (value.languageCode == null || typeof value.languageCode === "string")
  );
}

function optionalNonblankString(
  record: Record<string, unknown>,
  key: string,
): { value?: string; invalid: boolean } {
  const value = record[key];
  if (value == null) return { invalid: false };
  if (typeof value !== "string" || !value.trim()) return { invalid: true };
  return { value: value.trim(), invalid: false };
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
): { value?: string[]; invalid: boolean } {
  const value = record[key];
  if (value == null) return { invalid: false };
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string" && item.trim())
  ) {
    return { invalid: true };
  }
  return { value: value.map((item) => item.trim()), invalid: false };
}

function optionalEnum(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<string>,
): { value?: string; invalid: boolean } {
  const value = optionalNonblankString(record, key);
  return value.value && !allowed.has(value.value) ? { invalid: true } : value;
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
): { value?: number; invalid: boolean } {
  const value = record[key];
  if (value == null) return { invalid: false };
  return isFiniteNumber(value) ? { value, invalid: false } : { invalid: true };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function invalid(reason: string): GooglePlaceNormalization {
  return { ok: false, reason };
}
