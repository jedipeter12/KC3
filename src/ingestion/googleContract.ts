export const GOOGLE_PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName.text",
  "formattedAddress",
  "addressComponents",
  "location",
  "businessStatus",
  "primaryType",
  "types",
  "regularOpeningHours.periods",
  "timeZone.id",
  "movedPlaceId",
  "googleMapsUri",
  "rating",
  "userRatingCount",
  "websiteUri",
  "priceLevel",
].join(",");

export type TextChange = "missing" | "unchanged" | "cosmetic" | "substantive";

export function normalizeCosmeticText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/&/gu, " and ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function classifyTextChange(
  currentValue: string,
  incomingValue: string | null | undefined,
): TextChange {
  if (incomingValue == null) {
    return "missing";
  }

  if (incomingValue === currentValue) {
    return "unchanged";
  }

  return normalizeCosmeticText(incomingValue) ===
    normalizeCosmeticText(currentValue)
    ? "cosmetic"
    : "substantive";
}

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationChange =
  | { kind: "missing" }
  | { kind: "initialize" }
  | { kind: "unchanged"; distanceMeters: number }
  | { kind: "review"; distanceMeters: number };

export const LOCATION_REVIEW_THRESHOLD_METERS = 100;

export function classifyLocationChange(
  currentValue: Coordinates | null,
  incomingValue: Coordinates | null | undefined,
): LocationChange {
  if (incomingValue == null) {
    return { kind: "missing" };
  }

  if (currentValue == null) {
    return { kind: "initialize" };
  }

  const distanceMeters = greatCircleDistanceMeters(currentValue, incomingValue);

  return distanceMeters <= LOCATION_REVIEW_THRESHOLD_METERS
    ? { kind: "unchanged", distanceMeters }
    : { kind: "review", distanceMeters };
}

function greatCircleDistanceMeters(
  first: Coordinates,
  second: Coordinates,
): number {
  const earthRadiusMeters = 6_371_008.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export type GoogleHoursPoint = {
  day?: number;
  hour?: number;
  minute?: number;
};

export type GoogleHoursPeriod = {
  open?: GoogleHoursPoint;
  close?: GoogleHoursPoint;
};

export type GoogleRegularOpeningHours = {
  periods?: GoogleHoursPeriod[];
};

export type NormalizedHoursRow = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  closesNextDay: boolean;
};

export type HoursNormalization =
  | { disposition: "preserve"; reason: "missing" | "temporary_closure" }
  | { disposition: "reject"; reason: string }
  | { disposition: "replace"; rows: NormalizedHoursRow[] };

export function normalizeGoogleRegularHours(
  input: GoogleRegularOpeningHours | null | undefined,
  businessStatus?: string | null,
): HoursNormalization {
  if (input == null || input.periods == null) {
    return { disposition: "preserve", reason: "missing" };
  }

  if (!Array.isArray(input.periods)) {
    return { disposition: "reject", reason: "periods must be an array" };
  }

  if (input.periods.length === 0) {
    if (businessStatus === "CLOSED_TEMPORARILY") {
      return { disposition: "preserve", reason: "temporary_closure" };
    }

    return {
      disposition: "replace",
      rows: closedRowsForDays(new Set<number>()),
    };
  }

  if (isAlwaysOpen(input.periods)) {
    return {
      disposition: "replace",
      rows: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        openTime: "00:00",
        closeTime: "00:00",
        isClosed: false,
        closesNextDay: true,
      })),
    };
  }

  const openRows: NormalizedHoursRow[] = [];
  const coveredDays = new Set<number>();
  const coverageSegments: { start: number; end: number }[] = [];

  for (const period of input.periods) {
    if (!isValidPoint(period.open) || !isValidPoint(period.close)) {
      return {
        disposition: "reject",
        reason: "every period must have valid open and close points",
      };
    }

    const open = period.open;
    const close = period.close;
    const openMinutes = open.hour * 60 + open.minute;
    const closeMinutes = close.hour * 60 + close.minute;
    const nextDay = (open.day + 1) % 7;
    let closesNextDay: boolean;

    if (close.day === open.day && closeMinutes > openMinutes) {
      closesNextDay = false;
    } else if (close.day === nextDay) {
      closesNextDay = true;
    } else {
      return {
        disposition: "reject",
        reason:
          "a period must close later the same day or on the immediately following day",
      };
    }

    openRows.push({
      dayOfWeek: open.day,
      openTime: formatTime(open.hour, open.minute),
      closeTime: formatTime(close.hour, close.minute),
      isClosed: false,
      closesNextDay,
    });
    coveredDays.add(open.day);
    if (closesNextDay && closeMinutes > 0) {
      coveredDays.add(close.day);
    }

    const start = open.day * 1_440 + openMinutes;
    const end = closesNextDay
      ? (open.day + 1) * 1_440 + closeMinutes
      : open.day * 1_440 + closeMinutes;
    addWeeklyCoverageSegments(coverageSegments, start, end);
  }

  coverageSegments.sort((first, second) => first.start - second.start);
  for (let index = 1; index < coverageSegments.length; index += 1) {
    if (coverageSegments[index].start < coverageSegments[index - 1].end) {
      return { disposition: "reject", reason: "periods must not overlap" };
    }
  }

  return {
    disposition: "replace",
    rows: [...openRows, ...closedRowsForDays(coveredDays)].sort(
      (first, second) =>
        first.dayOfWeek - second.dayOfWeek ||
        (first.openTime ?? "99:99").localeCompare(second.openTime ?? "99:99"),
    ),
  };
}

function isAlwaysOpen(periods: GoogleHoursPeriod[]): boolean {
  return (
    periods.length === 1 &&
    isValidPoint(periods[0].open) &&
    periods[0].open.day === 0 &&
    periods[0].open.hour === 0 &&
    periods[0].open.minute === 0 &&
    periods[0].close == null
  );
}

function isValidPoint(
  point: GoogleHoursPoint | undefined,
): point is Required<GoogleHoursPoint> {
  return (
    point != null &&
    Number.isInteger(point.day) &&
    point.day != null &&
    point.day >= 0 &&
    point.day <= 6 &&
    Number.isInteger(point.hour) &&
    point.hour != null &&
    point.hour >= 0 &&
    point.hour <= 23 &&
    Number.isInteger(point.minute) &&
    point.minute != null &&
    point.minute >= 0 &&
    point.minute <= 59
  );
}

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function addWeeklyCoverageSegments(
  segments: { start: number; end: number }[],
  start: number,
  end: number,
): void {
  const weekMinutes = 7 * 1_440;
  if (end <= weekMinutes) {
    segments.push({ start, end });
    return;
  }

  segments.push(
    { start, end: weekMinutes },
    { start: 0, end: end - weekMinutes },
  );
}

function closedRowsForDays(coveredDays: Set<number>): NormalizedHoursRow[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => dayOfWeek)
    .filter((dayOfWeek) => !coveredDays.has(dayOfWeek))
    .map((dayOfWeek) => ({
      dayOfWeek,
      openTime: null,
      closeTime: null,
      isClosed: true,
      closesNextDay: false,
    }));
}
