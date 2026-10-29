import {
  activityTypes,
  classificationBooleanFields,
  discoverySources,
  displayValue,
  reviewBooleanFields,
  verificationStates,
  type DiscoveryReview,
  type ThirdSpaceClassification,
  type ThirdSpaceReviewRecord,
} from "./thirdSpaceReview";
import type { DiscoverySource } from "../types/database";
import type { ThirdSpaceReviewRepository } from "./thirdSpaceReviewRepository";

export type ReviewIo = {
  ask(prompt: string): Promise<string>;
  write(message: string): void;
};

export async function runThirdSpaceReview(
  repository: ThirdSpaceReviewRepository,
  io: ReviewIo,
  filters: { name: string; city: string; source: string },
  selectedRecord?: ThirdSpaceReviewRecord,
): Promise<"saved" | "cancelled" | "no_results" | "no_changes"> {
  const records = selectedRecord
    ? [selectedRecord]
    : await repository.search(filters.name, filters.city, filters.source);
  if (!records.length) {
    io.write("No discoveries matched.");
    return "no_results";
  }
  records.forEach((record, index) =>
    io.write(
      `[${index + 1}] ${record.place?.name ?? record.leadName ?? "Unnamed lead"} — ${record.place?.city ?? record.leadCity ?? "Unknown city"} (${record.source}, ${record.discoveredAt}); discovery ${record.id}`,
    ),
  );
  let selected: ThirdSpaceReviewRecord | undefined = selectedRecord;
  while (!selected) {
    const choice = (
      await io.ask(`Select 1-${records.length}, or q to cancel: `)
    )
      .trim()
      .toLowerCase();
    if (choice === "q") return "cancelled";
    const number = Number(choice);
    if (Number.isInteger(number) && number >= 1 && number <= records.length)
      selected = records[number - 1];
    else io.write("Enter a listed number or q.");
  }
  const record = selected;
  io.write(
    `Provenance: ${record.source}, discovered ${record.discoveredAt}; discovery ${record.id}.`,
  );
  io.write(
    record.place
      ? `Canonical: ${record.place.name}, ${record.place.address}, ${record.place.city}; ${record.place.placeType}; ${record.place.status}; published ${displayValue(record.place.published)}; place ${record.place.id}.`
      : "Unlinked lead; canonical classification and publication are unavailable.",
  );
  io.write(`Current discovery review: ${JSON.stringify(record.review)}`);
  if (record.classification)
    io.write(
      `Current KC3 classification: ${JSON.stringify(record.classification)}`,
    );
  io.write(
    `Current hours (source and observation): ${JSON.stringify(record.hours)}`,
  );
  io.write(`Effective regular hours: ${JSON.stringify(record.effectiveHours)}`);
  io.write(
    `Hours eligibility review pending: ${displayValue(record.hoursReviewPending)} (revision ${record.hoursRevision}; active override ${record.effectiveOverrideId ?? "none"}).`,
  );

  const review: DiscoveryReview = { ...record.review };
  review.verificationState = await promptEnum(
    "Verification state",
    review.verificationState,
    verificationStates,
    io,
  );
  for (const field of reviewBooleanFields) {
    review[field] = (await promptBoolean(
      field,
      review[field] as boolean | null,
      io,
    )) as never;
  }
  review.lastVerifiedAt = await promptDate(
    "Last verified date",
    review.lastVerifiedAt,
    io,
  );
  review.verificationNotes = await promptText(
    "Verification notes",
    review.verificationNotes,
    io,
  );

  let classification: ThirdSpaceClassification | null = record.classification
    ? { ...record.classification }
    : null;
  if (classification) {
    for (const field of classificationBooleanFields) {
      classification[field] = (await promptBoolean(
        field,
        classification[field] as boolean | null,
        io,
      )) as never;
    }
    classification.supportedActivities = await promptActivities(
      "Supported activities",
      classification.supportedActivities,
      io,
    );
    classification.organizedActivities = await promptActivities(
      "Organized activities",
      classification.organizedActivities,
      io,
    );
  }
  const published = record.place
    ? await promptBoolean("MVP published", record.place.published, io)
    : null;
  const reviewHours =
    record.place && record.hoursReviewPending
      ? await promptYesNo(
          "Complete eligibility review for the shown hours revision?",
          io,
        )
      : false;
  if (
    reviewHours &&
    published &&
    (review.verificationState !== "verified" ||
      review.mvpEligible !== true ||
      review.hoursReviewed !== true ||
      !hasEveningHours(record))
  ) {
    io.write(
      "Publication requires verified eligibility, reviewed hours, and an interval covering 8 p.m.",
    );
    return "cancelled";
  }
  if (
    ((review.verificationState === "verified" &&
      JSON.stringify(review) !== JSON.stringify(record.review)) ||
      review.lastVerifiedAt !== record.review.lastVerifiedAt ||
      (reviewHours && published)) &&
    !(await promptYesNo(
      "Did you actually verify the discovery and shown hours?",
      io,
    ))
  ) {
    io.write("Verification was not confirmed; no changes were written.");
    return "cancelled";
  }
  const changes: string[] = [];
  diff("Discovery review", record.review, review, changes);
  if (classification && record.classification)
    diff("KC3 classification", record.classification, classification, changes);
  if (published !== null && published !== record.place?.published)
    changes.push(
      `MVP published: ${displayValue(record.place?.published)} -> ${displayValue(published)}`,
    );
  if (reviewHours)
    changes.push(
      `Hours eligibility review: revision ${record.hoursRevision} pending -> reviewed`,
    );
  if (!changes.length) {
    io.write("No changes; nothing saved.");
    return "no_changes";
  }
  io.write(
    `Pending changes:\n${changes.map((change) => `- ${change}`).join("\n")}`,
  );
  if ((await io.ask('Type "yes" to save these changes: ')).trim() !== "yes") {
    io.write("Cancelled; no changes were written.");
    return "cancelled";
  }
  await repository.save(record.id, {
    expectedUpdatedAt: record.updatedAt,
    expectedPlaceUpdatedAt: record.place?.updatedAt ?? null,
    expectedDetailUpdatedAt: record.detailUpdatedAt,
    expectedHoursRevision: record.hoursRevision,
    expectedEffectiveOverrideId: record.effectiveOverrideId,
    review,
    classification,
    published,
    reviewHours: !!reviewHours,
  });
  io.write("Third-space review saved.");
  return "saved";
}

export async function startThirdSpaceReview(
  repository: ThirdSpaceReviewRepository,
  io: ReviewIo,
  placeId: string,
): Promise<"saved" | "cancelled" | "no_results" | "no_changes"> {
  const place = await repository.unreviewedPlace(placeId);
  if (!place) {
    io.write(
      "No unreviewed canonical place found for that ID. Search existing discoveries first.",
    );
    return "no_results";
  }
  io.write(
    `Canonical: ${place.name}, ${place.address}, ${place.city}; ${place.placeType}; ${place.status}; published ${displayValue(place.published)}; place ${place.id}.`,
  );
  io.write(
    `Current KC3 classification: ${JSON.stringify(place.classification)}`,
  );
  io.write(
    `Current hours (source and observation): ${JSON.stringify(place.hours)}`,
  );
  io.write(`Effective regular hours: ${JSON.stringify(place.effectiveHours)}`);
  let source: DiscoverySource | undefined;
  while (!source) {
    const answer = (
      await io.ask(`Discovery source (${discoverySources.join("/")}): `)
    ).trim();
    if (discoverySources.includes(answer as DiscoverySource))
      source = answer as DiscoverySource;
    else io.write("Choose the actual discovery source; no source is inferred.");
  }
  let discoveredAt: string | null = null;
  while (!discoveredAt) {
    discoveredAt = await promptDate("Actual discovery date", null, io);
    if (!discoveredAt) io.write("A real discovery date is required.");
  }
  io.write(
    `Start private review for ${place.id} with provenance ${source}, discovered ${discoveredAt}.`,
  );
  if (
    (await io.ask('Type "yes" to create this discovery review: ')).trim() !==
    "yes"
  ) {
    io.write("Cancelled; no discovery was created.");
    return "cancelled";
  }
  const record = await repository.start(place, source, discoveredAt);
  return runThirdSpaceReview(
    repository,
    io,
    { name: "", city: "", source: "" },
    record,
  );
}

function diff(
  label: string,
  before: object,
  after: object,
  changes: string[],
): void {
  for (const key of Object.keys(after) as (keyof typeof after)[]) {
    const oldValue = before[key];
    const newValue = after[key];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue))
      changes.push(
        `${label} ${String(key)}: ${displayValue(oldValue)} -> ${displayValue(newValue)}`,
      );
  }
}
function hasEveningHours(record: ThirdSpaceReviewRecord): boolean {
  const hoursToReview = record.effectiveHours.length
    ? record.effectiveHours
    : record.hours;
  return hoursToReview.some(
    (hours) =>
      !hours.closed &&
      !!hours.open &&
      hours.open <= "20:00:00" &&
      ((!!hours.close && hours.close >= "20:00:00") || hours.nextDay),
  );
}
async function promptEnum<T extends string>(
  label: string,
  current: T,
  allowed: readonly T[],
  io: ReviewIo,
): Promise<T> {
  while (true) {
    const answer = (
      await io.ask(`${label} [${current}] (${allowed.join("/")}; blank keep): `)
    ).trim();
    if (!answer) return current;
    if (allowed.includes(answer as T)) return answer as T;
    io.write(`Allowed: ${allowed.join(", ")}.`);
  }
}
async function promptBoolean(
  label: string,
  current: boolean | null,
  io: ReviewIo,
): Promise<boolean | null> {
  while (true) {
    const answer = (
      await io.ask(
        `${label} [${displayValue(current)}] (yes/no/unknown; blank keep): `,
      )
    )
      .trim()
      .toLowerCase();
    if (!answer) return current;
    if (answer === "yes") return true;
    if (answer === "no") return false;
    if (answer === "unknown") return null;
    io.write("Enter yes, no, unknown, or blank.");
  }
}
async function promptYesNo(label: string, io: ReviewIo): Promise<boolean> {
  while (true) {
    const answer = (await io.ask(`${label} [y/N]: `)).trim().toLowerCase();
    if (!answer || answer === "no" || answer === "n") return false;
    if (answer === "yes" || answer === "y") return true;
    io.write("Enter yes or no.");
  }
}
async function promptText(
  label: string,
  current: string | null,
  io: ReviewIo,
): Promise<string | null> {
  const answer = (
    await io.ask(
      `${label} [${displayValue(current)}] (blank keep, - unknown): `,
    )
  ).trim();
  return !answer ? current : answer === "-" ? null : answer;
}
async function promptDate(
  label: string,
  current: string | null,
  io: ReviewIo,
): Promise<string | null> {
  while (true) {
    const answer = (
      await io.ask(
        `${label} [${displayValue(current)}] (YYYY-MM-DD, blank keep, - unknown): `,
      )
    ).trim();
    if (!answer) return current;
    if (answer === "-") return null;
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(answer) &&
      !Number.isNaN(Date.parse(`${answer}T00:00:00Z`)) &&
      new Date(`${answer}T00:00:00Z`).toISOString().slice(0, 10) === answer
    )
      return answer;
    io.write("Enter a real date in YYYY-MM-DD format.");
  }
}
async function promptActivities(
  label: string,
  current: ThirdSpaceClassification["supportedActivities"],
  io: ReviewIo,
): Promise<ThirdSpaceClassification["supportedActivities"]> {
  while (true) {
    const answer = (
      await io.ask(
        `${label} [${displayValue(current)}] (comma-separated; blank keep, - unknown, none confirmed none): `,
      )
    ).trim();
    if (!answer) return current;
    if (answer === "-") return null;
    if (answer === "none") return [];
    const values = answer.split(",").map((value) => value.trim());
    if (
      values.every((value) =>
        activityTypes.includes(value as (typeof activityTypes)[number]),
      ) &&
      new Set(values).size === values.length
    )
      return values as typeof current;
    io.write(`Allowed: ${activityTypes.join(", ")}.`);
  }
}
