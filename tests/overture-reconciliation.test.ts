import {
  compileReview,
  createManifest,
  draftRows,
  type ReviewBatch,
} from "../src/ingestion/overtureReview";
import {
  parseReconciliationSnapshot,
  planOvertureReconciliation,
  verifyProtectedReconciliation,
  type ReconciliationSnapshot,
} from "../src/ingestion/overtureReconciliation";

const id = "11111111-1111-1111-1111-111111111111";
function batch(): ReviewBatch {
  const manifest = createManifest([
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Fixture Coffee",
      addresses: [{ locality: "Lenexa", freeform: "1 Fixture St" }],
      taxonomy: { primary: "coffee_shop" },
      operating_status: "open",
      confidence: 0.95,
      sources: [
        { dataset: "meta", license: "CDLA-Permissive-2.0", property: "" },
      ],
      latitude: 38.9,
      longitude: -94.7,
    },
  ]);
  const rows = draftRows(manifest);
  rows.places[0]["Review status"] = "Ready";
  rows.places[0]["Identity reviewed on"] = "2026-10-02";
  return compileReview(manifest, rows.places, rows.hours, "2026-10-03");
}
function snapshot(): ReconciliationSnapshot {
  return {
    schemaVersion: 1,
    places: [
      {
        id,
        updatedAt: "2026-10-02T00:00:00Z",
        identity: { ...batch().records[0].identity },
        movedToPlaceId: null,
        protected: {
          details: [
            {
              outlets: "many",
              bathroom_available: false,
              last_verified_at: "2026-09-30",
              notes: null,
            },
          ],
          kc3Hours: [
            {
              source: "kc3",
              day_of_week: 0,
              open_time: "09:00",
              close_time: "17:00",
              source_observed_at: "2026-09-30",
            },
          ],
          overrides: [{ field_name: "name", value: "Fixture", ends_at: null }],
          correctionEvidence: [
            {
              before_values: { name: "Historical fixture" },
              source_url: "https://example.org/evidence",
            },
          ],
        },
      },
    ],
  };
}
test("only explicit IDs match; identical names remain unresolved new candidates", () => {
  const b = batch(),
    s = snapshot();
  const before = JSON.stringify({ b, s });
  const plan = planOvertureReconciliation(b, s);
  expect(plan.entries[0].action).toBe("new_candidate_requires_review");
  expect(plan.untouchedPlaceIds).toEqual([id]);
  expect(plan.publicationAllowed).toBe(false);
  expect(JSON.stringify({ b, s })).toBe(before);
  b.records[0].targetPlaceId = id;
  const matched = planOvertureReconciliation(b, s);
  expect(matched.entries[0]).toMatchObject({
    action: "matched_candidate",
    expectedUpdatedAt: s.places[0].updatedAt,
    hoursAction: "preserve_existing_or_unknown",
    changedFields: [],
  });
  expect(matched.entries[0].protectedSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(matched)).not.toContain("Historical fixture");
  expect(JSON.stringify(matched)).not.toContain("bathroom_available");
});
test("reports proposed field changes without retaining old canonical values", () => {
  const b = batch(),
    s = snapshot();
  b.records[0].targetPlaceId = id;
  s.places[0].identity.name = "Old provider fixture";
  const plan = planOvertureReconciliation(b, s);
  expect(plan.entries[0].changedFields).toEqual(["name"]);
  expect(JSON.stringify(plan)).not.toContain("Old provider fixture");
  plan.entries[0].proposedIdentity.name = "Edited report";
  expect(b.records[0].identity.name).toBe("Fixture Coffee");
});
test.each([
  "target_not_found",
  "city_change_requires_review",
  "hidden_status_must_be_preserved",
  "existing_kc3_hours_require_review",
])("blocks %s", (conflict) => {
  const b = batch(),
    s = snapshot();
  b.records[0].targetPlaceId = id;
  if (conflict === "target_not_found")
    b.records[0].targetPlaceId = "22222222-2222-2222-2222-222222222222";
  if (conflict === "city_change_requires_review")
    b.records[0].identity.city = "Olathe";
  if (conflict === "hidden_status_must_be_preserved")
    s.places[0].identity.status = "hidden";
  if (conflict === "existing_kc3_hours_require_review")
    b.records[0].hours = {
      sourceUrl: "https://example.org",
      observedOn: "2026-10-02",
      reuseBasis: "Business supplied",
      notes: "Permission confirmed",
      periods: [],
    };
  expect(planOvertureReconciliation(b, s).entries[0]).toMatchObject({
    action: "blocked",
    conflicts: [conflict],
  });
});
test("rejects incomplete snapshots and case-variant duplicate canonical IDs", () => {
  const s = snapshot();
  const incomplete = structuredClone(s) as unknown as {
    places: { protected: Record<string, unknown> }[];
  };
  delete incomplete.places[0].protected.overrides;
  expect(() => parseReconciliationSnapshot(incomplete)).toThrow(
    "complete protected",
  );
  s.places.push(structuredClone(s.places[0]));
  expect(() => parseReconciliationSnapshot(s)).toThrow();
});
test.each(["details", "kc3Hours", "overrides", "correctionEvidence"] as const)(
  "detects exact %s changes, missing rows, and removed places",
  (section) => {
    const before = snapshot(),
      after = structuredClone(before);
    expect(verifyProtectedReconciliation(before, after)).toEqual([]);
    after.places[0].protected[section][0] = {
      changed: true,
      ...(section === "kc3Hours" ? { source: "kc3" } : {}),
    };
    expect(verifyProtectedReconciliation(before, after)).toEqual([id]);
    after.places[0].protected[section] = [];
    expect(verifyProtectedReconciliation(before, after)).toEqual([id]);
    after.places = [];
    expect(verifyProtectedReconciliation(before, after)).toEqual([id]);
  },
);
test("preservation compares JSON keys and row sets independently of database ordering", () => {
  const before = snapshot(),
    after = structuredClone(before);
  before.places[0].protected.details.push({ a: 1, b: false });
  after.places[0].protected.details.unshift({ b: false, a: 1 });
  after.places[0].identity.name = "New independently sourced identity";
  expect(verifyProtectedReconciliation(before, after)).toEqual([]);
  before.places[0].identity.status = "hidden";
  expect(verifyProtectedReconciliation(before, after)).toEqual([id]);
});
test("protects move links and leaves unreviewed places untouched", () => {
  const s = snapshot();
  const nextId = "22222222-2222-2222-2222-222222222222";
  s.places.push({ ...structuredClone(s.places[0]), id: nextId });
  s.places[0].movedToPlaceId = nextId;
  const b = batch();
  b.records[0].targetPlaceId = id;
  const plan = planOvertureReconciliation(b, s);
  expect(plan.entries[0].conflicts).toContain("moved_place_requires_review");
  expect(plan.untouchedPlaceIds).toEqual([nextId]);
  const after = structuredClone(s);
  after.places[0].movedToPlaceId = null;
  expect(verifyProtectedReconciliation(s, after)).toEqual([id]);
});

test("blocks every participant in duplicate explicit mappings", () => {
  const b = batch();
  b.records[0].targetPlaceId = id;
  b.records.push({
    ...structuredClone(b.records[0]),
    overtureId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  });
  expect(
    planOvertureReconciliation(b, snapshot()).entries.every((entry) =>
      entry.conflicts.includes("duplicate_kc3_target"),
    ),
  ).toBe(true);
});
