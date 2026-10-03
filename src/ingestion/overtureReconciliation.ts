import { createHash } from "node:crypto";
import type { ReviewBatch, ReviewedRecord } from "./overtureReview";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const protectedSections = [
  "details",
  "kc3Hours",
  "overrides",
  "correctionEvidence",
] as const;
type ProtectedSection = (typeof protectedSections)[number];

export type ReconciliationPlace = {
  id: string;
  updatedAt: string;
  identity: Omit<
    ReviewedRecord["identity"],
    "latitude" | "longitude" | "timeZone"
  > & {
    latitude: number | null;
    longitude: number | null;
    timeZone: string | null;
  };
  movedToPlaceId: string | null;
  protected: Record<ProtectedSection, Json[]>;
};
export type ReconciliationSnapshot = {
  schemaVersion: 1;
  places: ReconciliationPlace[];
};

function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
function digest(value: Json): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
function protectedValue(place: ReconciliationPlace): Json {
  return {
    id: place.id,
    city: place.identity.city,
    hidden: place.identity.status === "hidden",
    movedToPlaceId: place.movedToPlaceId,
    ...Object.fromEntries(
      protectedSections.map((section) => [
        section,
        [...place.protected[section]].sort((a, b) =>
          canonical(a).localeCompare(canonical(b)),
        ),
      ]),
    ),
  };
}

/** JSON files must explicitly include every protected section, even when empty. */
export function parseReconciliationSnapshot(
  input: unknown,
): ReconciliationSnapshot {
  const fail = () => {
    throw new Error(
      "Invalid reconciliation snapshot; complete protected sections and canonical identities are required.",
    );
  };
  if (!input || typeof input !== "object") return fail();
  const snapshot = input as ReconciliationSnapshot;
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.places))
    return fail();
  const ids = new Set<string>();
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const place of snapshot.places) {
    if (
      !place ||
      typeof place.id !== "string" ||
      !uuid.test(place.id) ||
      ids.has(place.id.toLowerCase())
    )
      return fail();
    ids.add(place.id.toLowerCase());
    if (
      typeof place.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(place.updatedAt)) ||
      !place.identity ||
      !place.protected
    )
      return fail();
    const identity = place.identity;
    if (
      ![identity.name, identity.address].every(
        (v) => typeof v === "string" && v.trim(),
      ) ||
      !["Lenexa", "Overland Park", "Olathe"].includes(identity.city) ||
      ![
        "coffee_shop",
        "cafe",
        "boba_tea",
        "library",
        "coworking",
        "park",
      ].includes(identity.placeType) ||
      ![
        "active",
        "temporarily_closed",
        "permanently_closed",
        "hidden",
      ].includes(identity.status) ||
      !["street_address", "approximate", "unknown"].includes(
        identity.addressPrecision,
      ) ||
      ![identity.latitude, identity.longitude].every(
        (v) => v === null || (typeof v === "number" && Number.isFinite(v)),
      ) ||
      (identity.latitude !== null && Math.abs(identity.latitude) > 90) ||
      (identity.longitude !== null && Math.abs(identity.longitude) > 180) ||
      ![identity.postcode, identity.website, identity.timeZone].every(
        (v) => v === null || typeof v === "string",
      ) ||
      !(
        place.movedToPlaceId === null ||
        (typeof place.movedToPlaceId === "string" &&
          uuid.test(place.movedToPlaceId))
      )
    )
      return fail();
    for (const section of protectedSections) {
      if (!Array.isArray(place.protected[section])) return fail();
      for (const row of place.protected[section]) {
        if (
          !row ||
          Array.isArray(row) ||
          typeof row !== "object" ||
          ("place_id" in row && row.place_id !== place.id)
        )
          return fail();
        if (section === "kc3Hours" && row.source !== "kc3") return fail();
      }
    }
  }
  for (const place of snapshot.places) {
    if (place.movedToPlaceId && !ids.has(place.movedToPlaceId.toLowerCase()))
      return fail();
  }
  return snapshot;
}

/** Compares exact protected rows, allowing only database row ordering to vary. */
export function verifyProtectedReconciliation(
  before: ReconciliationSnapshot,
  after: ReconciliationSnapshot,
): string[] {
  parseReconciliationSnapshot(before);
  parseReconciliationSnapshot(after);
  const afterById = new Map(
    after.places.map((place) => [place.id.toLowerCase(), place]),
  );
  return before.places.flatMap((place) => {
    const next = afterById.get(place.id.toLowerCase());
    return !next ||
      digest(protectedValue(place)) !== digest(protectedValue(next))
      ? [place.id]
      : [];
  });
}

/** Consumes a batch produced by compileReview. No DB access, IDs allocated, or writes. */
export function planOvertureReconciliation(
  batch: ReviewBatch,
  snapshot: ReconciliationSnapshot,
) {
  parseReconciliationSnapshot(snapshot);
  const byId = new Map(
    snapshot.places.map((place) => [place.id.toLowerCase(), place]),
  );
  const targets = new Set<string>();
  const count = (id: string, field: "targetPlaceId" | "overtureId") =>
    batch.records.filter((record) => record[field]?.toLowerCase() === id)
      .length;
  const entries = [...batch.records]
    .sort((a, b) => a.overtureId.localeCompare(b.overtureId))
    .map((record) => {
      const conflicts: string[] = [];
      const target = record.targetPlaceId?.toLowerCase() ?? null;
      const existing = target ? byId.get(target) : undefined;
      if (count(record.overtureId.toLowerCase(), "overtureId") > 1)
        conflicts.push("duplicate_overture_id");
      if (target && count(target, "targetPlaceId") > 1)
        conflicts.push("duplicate_kc3_target");
      if (target) targets.add(target);
      if (target && !existing) conflicts.push("target_not_found");
      if (existing && record.identity.city !== existing.identity.city)
        conflicts.push("city_change_requires_review");
      if (
        existing?.identity.status === "hidden" &&
        record.identity.status !== "hidden"
      )
        conflicts.push("hidden_status_must_be_preserved");
      if (existing?.movedToPlaceId)
        conflicts.push("moved_place_requires_review");
      if (existing && record.hours && existing.protected.kc3Hours.length)
        conflicts.push("existing_kc3_hours_require_review");
      const changedFields = existing
        ? Object.keys(record.identity)
            .filter(
              (key) =>
                record.identity[key as keyof typeof record.identity] !==
                existing.identity[key as keyof typeof existing.identity],
            )
            .sort()
        : [];
      return {
        overtureId: record.overtureId,
        targetPlaceId: existing?.id ?? record.targetPlaceId,
        action: conflicts.length
          ? "blocked"
          : existing
            ? "matched_candidate"
            : "new_candidate_requires_review",
        conflicts,
        changedFields,
        proposedIdentity: structuredClone(record.identity),
        identityEvidence: structuredClone(record.identityEvidence),
        sourceLicenses: [
          ...new Set(record.source.sources.map((source) => source.license)),
        ].sort(),
        reviewedHoursSha256: record.hours
          ? digest(record.hours as unknown as Json)
          : null,
        expectedUpdatedAt: existing?.updatedAt ?? null,
        protectedSha256: existing ? digest(protectedValue(existing)) : null,
        hoursAction: !record.hours
          ? "preserve_existing_or_unknown"
          : existing?.protected.kc3Hours.length
            ? "review_conflict"
            : "review_independent_schedule",
      };
    });
  return {
    schemaVersion: 1,
    mode: "dry_run_only",
    batchId: batch.batchId,
    snapshotSha256: digest(
      [...snapshot.places].sort((a, b) =>
        a.id.localeCompare(b.id),
      ) as unknown as Json,
    ),
    entries,
    untouchedPlaceIds: snapshot.places
      .filter((place) => !targets.has(place.id.toLowerCase()))
      .map((place) => place.id)
      .sort(),
    unresolved: [
      "municipal_eligibility",
      "new_identity_and_duplicate_review",
      "publication_provenance_contract",
      "google_history_and_secondary_copy_retirement",
    ],
    publicationAllowed: false,
  };
}
