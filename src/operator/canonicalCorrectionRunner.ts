import {
  addressPrecisions,
  assertValidCanonicalValues,
  assertValidCorrectionEvidence,
  canonicalLabels,
  canonicalValues,
  changedCanonicalValues,
  isHttpsUrl,
  isIsoDate,
  placeTypes,
  type CanonicalCorrectionEvidence,
  type CanonicalCorrectionPlace,
  type CanonicalPlaceValues,
} from "./canonicalCorrection";
import type { CanonicalCorrectionRepository } from "./canonicalCorrectionRepository";
import type { OperatorIo } from "./placeDetailsRunner";

export type CanonicalCorrectionRunResult =
  "saved" | "cancelled" | "no_results" | "no_changes";

export async function runCanonicalCorrectionEditor(
  name: string,
  city: string,
  repository: CanonicalCorrectionRepository,
  io: OperatorIo,
  today: () => string = localIsoDate,
): Promise<CanonicalCorrectionRunResult> {
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

  io.write(
    `Correcting canonical facts for ${quote(place.name)} (${place.id}).`,
  );
  const before = canonicalValues(place);
  const after = await editCanonicalValues(before, io);
  assertValidCanonicalValues(after);
  const changes = changedCanonicalValues(before, after);
  if (changes.length === 0) {
    io.write("No canonical values changed; nothing was written.");
    return "no_changes";
  }

  const evidence = await promptEvidence(io, today);
  assertValidCorrectionEvidence(evidence);

  io.write("Pending canonical correction:");
  for (const key of changes) {
    io.write(
      `- ${canonicalLabels[key]}: ${oneLine(before[key])} -> ${oneLine(after[key])}`,
    );
  }
  io.write(`- Source: ${oneLine(evidence.sourceUrl)}`);
  io.write(`- Source observed: ${evidence.observedOn}`);
  io.write(`- Notes: ${oneLine(evidence.notes)}`);

  const confirmation = (await io.ask('Type "yes" to write this correction: '))
    .trim()
    .toLowerCase();
  if (confirmation !== "yes") {
    io.write("Cancelled; no changes were written.");
    return "cancelled";
  }

  await repository.save(place.id, {
    expectedUpdatedAt: place.placeUpdatedAt,
    canonical: after,
    evidence,
  });
  io.write("Canonical place correction and evidence saved.");
  return "saved";
}

function formatSearchResult(
  place: CanonicalCorrectionPlace,
  index: number,
): string {
  return [
    `[${index + 1}] ${oneLine(place.name)} — ${oneLine(place.address)} (${place.addressPrecision}; ${place.placeType})`,
    `    KC3 ID: ${place.id}`,
    `    Google identity: ${oneLine(place.googleName ?? "not supplied")} — ${oneLine(place.googleAddress ?? "not supplied")}`,
    `    Google type: ${oneLine(place.googlePrimaryType ?? "not supplied")}; types: ${oneLine(place.googleTypes.join(", ") || "not supplied")}`,
    `    Google Place ID: ${oneLine(place.googlePlaceId)}; status: ${oneLine(place.googleBusinessStatus ?? "not supplied")}; fetched: ${oneLine(place.googleFetchedAt ?? "not supplied")}`,
  ].join("\n");
}

async function selectPlace(
  places: readonly CanonicalCorrectionPlace[],
  io: OperatorIo,
): Promise<CanonicalCorrectionPlace | undefined> {
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

async function editCanonicalValues(
  before: CanonicalPlaceValues,
  io: OperatorIo,
): Promise<CanonicalPlaceValues> {
  return {
    name: await promptRequiredText("Name", before.name, io),
    address: await promptRequiredText("Address", before.address, io),
    addressPrecision: await promptEnum(
      "Address precision",
      before.addressPrecision,
      addressPrecisions,
      io,
    ),
    placeType: await promptEnum("Place type", before.placeType, placeTypes, io),
  };
}

async function promptEvidence(
  io: OperatorIo,
  today: () => string,
): Promise<CanonicalCorrectionEvidence> {
  let sourceUrl: string;
  while (true) {
    sourceUrl = (await io.ask("Authoritative HTTPS source URL: ")).trim();
    if (isHttpsUrl(sourceUrl)) break;
    io.write("Enter a valid HTTPS URL.");
  }

  let observedOn: string;
  while (true) {
    const answer = (
      await io.ask(`Source observation date [${today()}]: `)
    ).trim();
    observedOn = answer || today();
    if (isIsoDate(observedOn)) break;
    io.write("Enter a real date in YYYY-MM-DD format.");
  }

  let notes: string;
  while (true) {
    notes = (await io.ask("Correction notes (required): ")).trim();
    if (notes) break;
    io.write("Correction notes cannot be blank.");
  }
  return { sourceUrl, observedOn, notes };
}

async function promptRequiredText(
  label: string,
  current: string,
  io: OperatorIo,
): Promise<string> {
  const answer = (
    await io.ask(`${label} [${oneLine(current)}] (blank keep): `)
  ).trim();
  return answer || current;
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
    .slice(0, 500);
}

function quote(value: string): string {
  return JSON.stringify(oneLine(value));
}
