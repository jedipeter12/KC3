import { publicRequest } from "./publicRequest";
import { supabase } from "../lib/supabase";
import type {
  AddressPrecision,
  FoodBeverageLevel,
  Kc3VerificationState,
  OutletLevel,
  PlaceType,
  PublicPlace,
  PublicPlaceDetail,
  PublicPlaceSummary,
  PublicRegularHoursRow,
  RegularHoursRule,
  RegularHoursState,
  WifiType,
  WorkSuitability,
} from "../types/database";

const PLACE_TYPES: readonly PlaceType[] = [
  "coffee_shop",
  "cafe",
  "boba_tea",
  "library",
  "coworking",
  "park",
  "bookstore",
  "board_game_cafe",
  "gaming_venue",
  "community_center",
  "hobby_space",
  "community_venue",
];
const ADDRESS_PRECISIONS: readonly AddressPrecision[] = [
  "street_address",
  "approximate",
  "unknown",
];
const OUTLET_LEVELS: readonly OutletLevel[] = [
  "none",
  "few",
  "many",
  "unknown",
];
const WIFI_TYPES: readonly WifiType[] = [
  "public",
  "password_printed",
  "password_on_request",
  "none",
  "unknown",
];
const WORK_SUITABILITIES: readonly WorkSuitability[] = [
  "good",
  "okay",
  "poor",
  "unknown",
];
const FOOD_BEVERAGE_LEVELS: readonly FoodBeverageLevel[] = [
  "none",
  "light",
  "full",
  "unknown",
];
const REGULAR_HOURS_STATES: readonly RegularHoursState[] = [
  "open",
  "closed",
  "unknown",
];
const REGULAR_HOURS_RULES: readonly RegularHoursRule[] = [
  "weekly",
  "dawn_to_dusk",
];
const KC3_VERIFICATION_STATES: readonly Kc3VerificationState[] = [
  "unverified",
  "current",
  "stale",
];

export const PUBLIC_PLACES_ERROR_CODE = "PUBLIC_PLACES_UNAVAILABLE";
export const PUBLIC_PLACES_ERROR_MESSAGE =
  "We couldn't load places right now. Please try again.";
export const PUBLIC_PLACE_DETAILS_ERROR_MESSAGE =
  "We couldn't load place details right now. Please try again.";

export class PublicPlacesError extends Error {
  readonly code = PUBLIC_PLACES_ERROR_CODE;

  constructor() {
    super(PUBLIC_PLACES_ERROR_MESSAGE);
    this.name = "PublicPlacesError";
  }
}

async function requirePublicationGate(signal?: AbortSignal): Promise<void> {
  const { data, error } = await publicRequest(
    (requestSignal) =>
      supabase.rpc("kc3_publication_gate_ready").abortSignal(requestSignal),
    signal,
  );
  if (error || data !== true) throw new PublicPlacesError();
}

function isPlaceType(value: unknown): value is PlaceType {
  return PLACE_TYPES.includes(value as PlaceType);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableTimestamp(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) return false;
  const [, calendarDate, hour, minute, second] = match;
  return (
    isNullableCalendarDate(calendarDate) &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

function isNullableCalendarDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

function isEnumValue<Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value {
  return values.includes(value as Value);
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

function toPublicPlaceSummary(value: unknown): PublicPlaceSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicPlacesError();
  }

  const place = value as Record<string, unknown>;
  if (
    typeof place.id !== "string" ||
    typeof place.name !== "string" ||
    typeof place.city !== "string" ||
    typeof place.address !== "string" ||
    !isEnumValue(ADDRESS_PRECISIONS, place.address_precision) ||
    !isPlaceType(place.place_type) ||
    typeof place.regular_hours_available !== "boolean" ||
    !isEnumValue(REGULAR_HOURS_RULES, place.regular_hours_rule) ||
    !isEnumValue(REGULAR_HOURS_STATES, place.regular_hours_state) ||
    !isNullableTimestamp(place.regular_hours_next_transition_at) ||
    !isNullableTimestamp(place.regular_hours_observed_at) ||
    !isEnumValue(OUTLET_LEVELS, place.outlets) ||
    !isEnumValue(WIFI_TYPES, place.wifi) ||
    !isEnumValue(WORK_SUITABILITIES, place.work_suitability) ||
    !isEnumValue(FOOD_BEVERAGE_LEVELS, place.food_beverage) ||
    !isNullableBoolean(place.phone_calls_allowed) ||
    !isNullableBoolean(place.bathroom_available) ||
    !isNullableBoolean(place.drive_thru_available) ||
    !isNullableBoolean(place.drive_thru_only) ||
    !isNullableCalendarDate(place.kc3_last_verified_at) ||
    !isEnumValue(KC3_VERIFICATION_STATES, place.kc3_verification_state) ||
    (place.drive_thru_only === true && place.drive_thru_available !== true)
  ) {
    throw new PublicPlacesError();
  }

  return {
    id: place.id,
    name: place.name,
    city: place.city,
    address: place.address,
    address_precision: place.address_precision,
    place_type: place.place_type,
    regular_hours_available: place.regular_hours_available,
    regular_hours_rule: place.regular_hours_rule,
    regular_hours_state: place.regular_hours_state,
    regular_hours_next_transition_at: place.regular_hours_next_transition_at,
    regular_hours_observed_at: place.regular_hours_observed_at,
    outlets: place.outlets,
    wifi: place.wifi,
    work_suitability: place.work_suitability,
    food_beverage: place.food_beverage,
    phone_calls_allowed: place.phone_calls_allowed,
    bathroom_available: place.bathroom_available,
    drive_thru_available: place.drive_thru_available,
    drive_thru_only: place.drive_thru_only,
    kc3_last_verified_at: place.kc3_last_verified_at,
    kc3_verification_state: place.kc3_verification_state,
  };
}

function toPublicRegularHoursRow(value: unknown): PublicRegularHoursRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicPlacesError();
  }

  const row = value as Record<string, unknown>;
  if (
    !Number.isInteger(row.day_of_week) ||
    (row.day_of_week as number) < 0 ||
    (row.day_of_week as number) > 6 ||
    !isNullableString(row.open_time) ||
    !isNullableString(row.close_time) ||
    typeof row.is_closed !== "boolean" ||
    typeof row.closes_next_day !== "boolean" ||
    (row.is_closed && (row.open_time != null || row.close_time != null)) ||
    (!row.is_closed && (row.open_time == null || row.close_time == null))
  ) {
    throw new PublicPlacesError();
  }

  return {
    day_of_week: row.day_of_week as number,
    open_time: row.open_time,
    close_time: row.close_time,
    is_closed: row.is_closed,
    closes_next_day: row.closes_next_day,
  };
}

function toPublicPlaceDetail(value: unknown): PublicPlaceDetail {
  const summary = toPublicPlaceSummary(value);
  const place = value as Record<string, unknown>;
  if (
    !Array.isArray(place.regular_hours) ||
    !isNullableString(place.seating_notes) ||
    !(
      place.place_local_day_of_week === null ||
      (Number.isInteger(place.place_local_day_of_week) &&
        (place.place_local_day_of_week as number) >= 0 &&
        (place.place_local_day_of_week as number) <= 6)
    )
  ) {
    throw new PublicPlacesError();
  }

  return {
    ...summary,
    place_local_day_of_week: place.place_local_day_of_week as number | null,
    regular_hours: place.regular_hours.map(toPublicRegularHoursRow),
    seating_notes: place.seating_notes,
  };
}

/**
 * Returns the server-ordered public place projection. An empty RPC array is a
 * successful empty result; provider failures and malformed responses use the
 * same safe application error without retaining provider details.
 */
export async function listPublicPlaces(
  signal?: AbortSignal,
): Promise<PublicPlace[]> {
  try {
    await requirePublicationGate(signal);
    const { data, error } = await publicRequest(
      (requestSignal) =>
        supabase.rpc("list_public_places").abortSignal(requestSignal),
      signal,
    );

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

export async function listPublicPlaceSummaries(
  signal?: AbortSignal,
): Promise<PublicPlaceSummary[]> {
  try {
    await requirePublicationGate(signal);
    const { data, error } = await publicRequest(
      (requestSignal) =>
        supabase.rpc("list_public_place_summaries").abortSignal(requestSignal),
      signal,
    );

    if (error || !Array.isArray(data)) {
      throw new PublicPlacesError();
    }

    return data.map(toPublicPlaceSummary);
  } catch (error) {
    if (error instanceof PublicPlacesError) throw error;
    throw new PublicPlacesError();
  }
}

export async function getPublicPlaceDetail(
  placeId: string,
  signal?: AbortSignal,
): Promise<PublicPlaceDetail | null> {
  try {
    await requirePublicationGate(signal);
    const { data, error } = await publicRequest(
      (requestSignal) =>
        supabase
          .rpc("get_public_place_detail", { target_place_id: placeId })
          .abortSignal(requestSignal),
      signal,
    );

    if (error || !Array.isArray(data) || data.length > 1) {
      throw new PublicPlacesError();
    }

    return data.length === 0 ? null : toPublicPlaceDetail(data[0]);
  } catch (error) {
    if (error instanceof PublicPlacesError) throw error;
    throw new PublicPlacesError();
  }
}
