import { validatePublicationApprovals } from "../src/ingestion/overturePublication";
import type { ReviewBatch } from "../src/ingestion/overtureReview";

const batch = {
  schemaVersion: 1,
  batchId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  release: "2026-09-23.1",
  manifestSha256: "a".repeat(64),
  records: [
    { overtureId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", targetPlaceId: null },
  ],
} as ReviewBatch;
const approval = {
  overtureId: batch.records[0].overtureId,
  targetPlaceId: null,
  expectedUpdatedAt: null,
  municipalEligibilityConfirmed: true,
  duplicateReviewConfirmed: true,
  reviewNotes:
    "Municipality, identity, and duplicates checked against independent evidence.",
};

test("publication requires an exact staged identity, target, and explicit review", () => {
  expect(
    validatePublicationApprovals(batch, {
      batchId: batch.batchId,
      entries: [approval],
    }),
  ).toEqual([approval]);
  for (const changed of [
    { ...approval, overtureId: "other" },
    { ...approval, targetPlaceId: "cccccccc-cccc-cccc-cccc-cccccccccccc" },
    { ...approval, municipalEligibilityConfirmed: false },
    { ...approval, duplicateReviewConfirmed: false },
    { ...approval, reviewNotes: " " },
    { ...approval, expectedUpdatedAt: "2026-10-01T00:00:00Z" },
  ]) {
    expect(() =>
      validatePublicationApprovals(batch, {
        batchId: batch.batchId,
        entries: [changed],
      }),
    ).toThrow();
  }
  expect(() =>
    validatePublicationApprovals(batch, {
      batchId: "wrong",
      entries: [approval],
    }),
  ).toThrow();
  expect(() =>
    validatePublicationApprovals(batch, {
      batchId: batch.batchId,
      entries: [approval, approval],
    }),
  ).toThrow();
});
