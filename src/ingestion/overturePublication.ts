import type { ReviewBatch } from "./overtureReview";

export type PublicationApproval = {
  overtureId: string;
  targetPlaceId: string | null;
  expectedUpdatedAt: string | null;
  municipalEligibilityConfirmed: true;
  duplicateReviewConfirmed: true;
  reviewNotes: string;
};

export function validatePublicationApprovals(
  batch: ReviewBatch,
  input: unknown,
): PublicationApproval[] {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray((input as { entries?: unknown }).entries) ||
    (input as { batchId?: unknown }).batchId !== batch.batchId
  ) {
    throw new Error("Approval file does not match the staged review batch.");
  }
  const rows = (input as { entries: unknown[] }).entries;
  if (rows.length === 0) throw new Error("No approved publications.");
  const byId = new Map(
    batch.records.map((record) => [record.overtureId, record]),
  );
  const seen = new Set<string>();
  return rows.map((value) => {
    if (!value || typeof value !== "object")
      throw new Error("Invalid publication approval.");
    const approval = value as PublicationApproval;
    const record = byId.get(approval.overtureId);
    if (!record || seen.has(approval.overtureId))
      throw new Error("Unknown or duplicate reviewed identity.");
    seen.add(approval.overtureId);
    if (
      approval.targetPlaceId !== record.targetPlaceId ||
      approval.municipalEligibilityConfirmed !== true ||
      approval.duplicateReviewConfirmed !== true ||
      typeof approval.reviewNotes !== "string" ||
      !approval.reviewNotes.trim() ||
      (record.targetPlaceId === null
        ? approval.expectedUpdatedAt !== null
        : typeof approval.expectedUpdatedAt !== "string" ||
          !Number.isFinite(Date.parse(approval.expectedUpdatedAt)))
    ) {
      throw new Error(
        "Publication approval is incomplete or changed the reviewed target.",
      );
    }
    return approval;
  });
}
