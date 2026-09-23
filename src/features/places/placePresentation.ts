import type {
  PublicPlaceSummary,
  PublicRegularHoursRow,
} from "../../types/database";

export const PLACE_TYPE_LABELS = {
  coffee_shop: "Coffee shop",
  cafe: "Cafe",
  boba_tea: "Boba & tea",
  library: "Library",
  coworking: "Coworking",
  park: "Park",
} as const;

export const WORK_LABELS = {
  good: "Good for working",
  okay: "Okay for a short work session",
  poor: "Not suited for working",
  unknown: "Not yet KC3-verified",
} as const;

export const OUTLET_LABELS = {
  many: "Many outlets",
  few: "A few outlets",
  none: "No outlets available",
  unknown: "Not yet KC3-verified",
} as const;

export const WIFI_LABELS = {
  public: "Public Wi-Fi",
  password_printed: "Wi-Fi · password posted",
  password_on_request: "Wi-Fi · ask for password",
  none: "No public Wi-Fi",
  unknown: "Not yet KC3-verified",
} as const;

export const FOOD_LABELS = {
  full: "Full food menu",
  light: "Drinks or light food",
  none: "No food or drinks",
  unknown: "Not yet KC3-verified",
} as const;

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(value: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTransition(value: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function isHoursStale(
  observedAt: string | null,
  now = new Date(),
): boolean {
  if (!observedAt) return false;
  return now.getTime() - new Date(observedAt).getTime() > 14 * DAY_MS;
}

export function getHoursStatus(
  place: PublicPlaceSummary,
  now = new Date(),
): string {
  if (!place.regular_hours_available) return "Hours unavailable";
  if (isHoursStale(place.regular_hours_observed_at, now)) {
    return `Hours may have changed · Last checked ${formatDate(place.regular_hours_observed_at!)}`;
  }
  if (place.regular_hours_state === "open") {
    return place.regular_hours_next_transition_at
      ? `Open · until ${formatTransition(place.regular_hours_next_transition_at)}`
      : "Open 24 hours";
  }
  if (place.regular_hours_state === "closed") {
    return place.regular_hours_next_transition_at
      ? `Closed · opens ${formatTransition(place.regular_hours_next_transition_at)}`
      : "Closed";
  }
  return "Current hours status unavailable";
}

export function getCompactKc3Summary(place: PublicPlaceSummary): string[] {
  const hasKnownValue =
    place.work_suitability !== "unknown" ||
    place.outlets !== "unknown" ||
    place.wifi !== "unknown" ||
    place.food_beverage !== "unknown" ||
    place.phone_calls_allowed !== null ||
    place.bathroom_available !== null ||
    place.drive_thru_available !== null ||
    place.drive_thru_only !== null;

  if (!hasKnownValue) return ["KC3 details not yet verified"];

  const lines: string[] = [];
  if (place.work_suitability !== "unknown") {
    lines.push(WORK_LABELS[place.work_suitability]);
  }
  for (const highlight of [
    place.wifi !== "unknown" && place.wifi !== "none"
      ? WIFI_LABELS[place.wifi]
      : null,
    place.outlets === "few" || place.outlets === "many"
      ? OUTLET_LABELS[place.outlets]
      : null,
    place.food_beverage === "light" || place.food_beverage === "full"
      ? FOOD_LABELS[place.food_beverage]
      : null,
  ]) {
    if (highlight && lines.length < 3) lines.push(highlight);
  }
  if (lines.length === 0) lines.push("KC3 details verified");
  return lines;
}

function formatClockTime(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatHoursRows(
  rows: readonly PublicRegularHoursRow[],
): string {
  if (rows.length === 0 || rows.every((row) => row.is_closed)) return "Closed";
  return rows
    .filter((row) => !row.is_closed)
    .map((row) => {
      if (
        row.open_time === "00:00" &&
        row.close_time === "00:00" &&
        row.closes_next_day
      ) {
        return "Open 24 hours";
      }
      const overnight = row.closes_next_day ? " next day" : "";
      return `${formatClockTime(row.open_time!)}–${formatClockTime(row.close_time!)}${overnight}`;
    })
    .join(", ");
}

export function buildMapsUrl(
  place: PublicPlaceSummary,
  provider: "apple" | "google" = "google",
): string {
  const query = encodeURIComponent(
    `${place.name}, ${place.address}, ${place.city}`,
  );
  if (provider === "apple") return `https://maps.apple.com/?q=${query}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
