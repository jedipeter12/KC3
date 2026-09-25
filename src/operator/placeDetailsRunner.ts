import {
  assertValidPlaceDetails,
  changedDetails,
  detailLabels,
  displayDetailValue,
  foodBeverageLevels,
  outletLevels,
  wifiTypes,
  workSuitabilities,
  type OperatorPlace,
  type PlaceDetails,
} from "./placeDetails";
import type { PlaceDetailsRepository } from "./placeDetailsRepository";

export type OperatorIo = Readonly<{
  ask(prompt: string): Promise<string>;
  write(message: string): void;
}>;

export type PlaceDetailsRunResult =
  "saved" | "cancelled" | "no_results" | "no_changes";

export async function runPlaceDetailsEditor(
  name: string,
  city: string,
  repository: PlaceDetailsRepository,
  io: OperatorIo,
  today: () => string = localIsoDate,
): Promise<PlaceDetailsRunResult> {
  const places = await repository.search(name, city);
  if (places.length === 0) {
    io.write(
      `No active provider-backed places matched ${quote(name)} in ${quote(city)}.`,
    );
    return "no_results";
  }

  io.write(`Found ${places.length} active provider-backed place(s):`);
  places.forEach((place, index) => io.write(formatSearchResult(place, index)));

  const place = await selectPlace(places, io);
  if (!place) {
    io.write("Cancelled; no changes were written.");
    return "cancelled";
  }

  io.write(`Editing KC3-owned details for ${quote(place.name)} (${place.id}).`);
  const after = await editDetails(place.details, io, today);
  assertValidPlaceDetails(after);
  const changes = changedDetails(place.details, after);

  if (changes.length === 0) {
    io.write("No KC3-owned values changed; nothing was written.");
    return "no_changes";
  }

  io.write("Pending KC3-owned changes:");
  for (const key of changes) {
    io.write(
      `- ${detailLabels[key]}: ${displayDetailValue(place.details[key])} -> ${displayDetailValue(after[key])}`,
    );
  }

  const confirmation = (await io.ask('Type "yes" to write these changes: '))
    .trim()
    .toLowerCase();
  if (confirmation !== "yes") {
    io.write("Cancelled; no changes were written.");
    return "cancelled";
  }

  await repository.save(place.id, {
    expectedUpdatedAt: place.detailUpdatedAt,
    details: after,
  });
  io.write("KC3-owned place details saved.");
  return "saved";
}

function formatSearchResult(place: OperatorPlace, index: number): string {
  const providerName = place.googleName ?? "not supplied";
  const providerAddress = place.googleAddress ?? "not supplied";
  const providerStatus = place.googleBusinessStatus ?? "not supplied";
  const providerFetched = place.googleFetchedAt ?? "not supplied";
  return [
    `[${index + 1}] ${oneLine(place.name)} — ${oneLine(place.address)} (${place.placeType})`,
    `    KC3 ID: ${place.id}`,
    `    Google identity: ${oneLine(providerName)} — ${oneLine(providerAddress)}`,
    `    Google Place ID: ${oneLine(place.googlePlaceId)}; status: ${oneLine(providerStatus)}; fetched: ${oneLine(providerFetched)}`,
  ].join("\n");
}

async function selectPlace(
  places: readonly OperatorPlace[],
  io: OperatorIo,
): Promise<OperatorPlace | undefined> {
  while (true) {
    const answer = (await io.ask(`Select 1-${places.length}, or q to cancel: `))
      .trim()
      .toLowerCase();
    if (answer === "q") return undefined;
    const index = Number(answer);
    if (Number.isInteger(index) && index >= 1 && index <= places.length) {
      return places[index - 1];
    }
    io.write("Enter one listed number or q.");
  }
}

async function editDetails(
  before: PlaceDetails,
  io: OperatorIo,
  today: () => string,
): Promise<PlaceDetails> {
  const seatingNotes = await promptText("Seating", before.seatingNotes, io);
  const outlets = await promptEnum("Outlets", before.outlets, outletLevels, io);
  const wifi = await promptEnum("Wi-Fi", before.wifi, wifiTypes, io);
  const workSuitability = await promptEnum(
    "Work suitability",
    before.workSuitability,
    workSuitabilities,
    io,
  );
  const foodBeverage = await promptEnum(
    "Food/drinks",
    before.foodBeverage,
    foodBeverageLevels,
    io,
  );
  const phoneCallsAllowed = await promptBoolean(
    "Phone calls allowed",
    before.phoneCallsAllowed,
    io,
  );
  const bathroomAvailable = await promptBoolean(
    "Bathroom available",
    before.bathroomAvailable,
    io,
  );
  const driveThruAvailable = await promptBoolean(
    "Drive-thru available",
    before.driveThruAvailable,
    io,
  );
  let driveThruOnly: boolean | null;
  while (true) {
    driveThruOnly = await promptBoolean(
      "Drive-thru only",
      before.driveThruOnly,
      io,
    );
    if (driveThruOnly !== true || driveThruAvailable === true) break;
    io.write(
      "Drive-thru only can be yes only when drive-thru available is yes.",
    );
  }

  let lastVerifiedAt = before.lastVerifiedAt;
  let verificationNotes = before.verificationNotes;
  const verified = await promptYesNo(
    "Did you actually verify the KC3-owned information for this place?",
    io,
  );
  if (verified) {
    lastVerifiedAt = await promptDate(today(), io);
    verificationNotes = await promptText(
      "Verification notes",
      before.verificationNotes,
      io,
    );
  }

  return {
    seatingNotes,
    outlets,
    wifi,
    workSuitability,
    foodBeverage,
    phoneCallsAllowed,
    bathroomAvailable,
    driveThruAvailable,
    driveThruOnly,
    lastVerifiedAt,
    verificationNotes,
  };
}

async function promptText(
  label: string,
  current: string | null,
  io: OperatorIo,
): Promise<string | null> {
  const answer = await io.ask(
    `${label} [${displayDetailValue(current)}] (blank keep, - unset): `,
  );
  const trimmed = answer.trim();
  if (!trimmed) return current;
  return trimmed === "-" ? null : trimmed;
}

async function promptEnum<const T extends string>(
  label: string,
  current: T,
  values: readonly T[],
  io: OperatorIo,
): Promise<T> {
  while (true) {
    const answer = (
      await io.ask(`${label} [${current}] (${values.join("/")}; blank keep): `)
    )
      .trim()
      .toLowerCase();
    if (!answer) return current;
    if (values.includes(answer as T)) return answer as T;
    io.write(`Allowed values: ${values.join(", ")}.`);
  }
}

async function promptBoolean(
  label: string,
  current: boolean | null,
  io: OperatorIo,
): Promise<boolean | null> {
  while (true) {
    const answer = (
      await io.ask(
        `${label} [${displayDetailValue(current)}] (yes/no/unknown; blank keep): `,
      )
    )
      .trim()
      .toLowerCase();
    if (!answer) return current;
    if (["yes", "y"].includes(answer)) return true;
    if (["no", "n"].includes(answer)) return false;
    if (["unknown", "unset", "u"].includes(answer)) return null;
    io.write("Allowed values: yes, no, unknown.");
  }
}

async function promptYesNo(label: string, io: OperatorIo): Promise<boolean> {
  while (true) {
    const answer = (await io.ask(`${label} [y/N]: `)).trim().toLowerCase();
    if (!answer || answer === "n" || answer === "no") return false;
    if (answer === "y" || answer === "yes") return true;
    io.write("Enter yes or no.");
  }
}

async function promptDate(
  defaultDate: string,
  io: OperatorIo,
): Promise<string> {
  while (true) {
    const answer = (
      await io.ask(`Verification date [${defaultDate}]: `)
    ).trim();
    const value = answer || defaultDate;
    if (isIsoDate(value)) return value;
    io.write("Enter a real date in YYYY-MM-DD format.");
  }
}

function isIsoDate(value: string): boolean {
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

function localIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function oneLine(value: string): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

function quote(value: string): string {
  return JSON.stringify(oneLine(value));
}
