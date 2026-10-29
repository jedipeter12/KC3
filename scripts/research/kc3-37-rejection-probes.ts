import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  decodeCsv,
  encodeCsv,
  hourHeaders,
  placeHeaders,
  type ReviewRow,
} from "../../src/ingestion/overtureReview";

const base = "/private/tmp/kc3-37-synthetic-input";
const probe = mkdtempSync(join(tmpdir(), "kc3-37-probes-"));
const read = (name: string) => readFileSync(join(base, name), "utf8");
const places = decodeCsv(read("places.csv"), placeHeaders);
const hours = decodeCsv(read("hours.csv"), hourHeaders);
const workbook = JSON.parse(read("workbook-data.json")) as {
  places: ReviewRow[];
  hours: ReviewRow[];
};
if (
  JSON.stringify(workbook.places) !== JSON.stringify(places) ||
  JSON.stringify(workbook.hours) !== JSON.stringify(hours)
)
  throw new Error("Workbook tables differ from CSV export.");

const run = (script: string, args: string[], expectedStatus: number) => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", resolve(script), ...args],
    {
      encoding: "utf8",
      timeout: 15_000,
    },
  );
  if (result.status !== expectedStatus)
    throw new Error(
      `${script} exited ${result.status}; expected ${expectedStatus}: ${result.stderr}`,
    );
};
const file = (name: string, content: string) => {
  const path = join(probe, name);
  writeFileSync(path, content, { flag: "wx" });
  return path;
};
const importArgs = (placePath: string, hourPath: string, output: string) => [
  join(base, "manifest.json"),
  placePath,
  hourPath,
  join(probe, output),
];
const planArgs = (
  placePath: string,
  hourPath: string,
  snapshotPath: string,
  output: string,
) => [
  join(base, "manifest.json"),
  placePath,
  hourPath,
  snapshotPath,
  join(probe, output),
];
const expectRejected = (
  name: string,
  placeText: string,
  hourText = read("hours.csv"),
) => {
  const path = file(`${name}-places.csv`, placeText);
  const hoursPath = file(`${name}-hours.csv`, hourText);
  const output = `${name}-preview.json`;
  run(
    "scripts/import-overture-review.ts",
    importArgs(path, hoursPath, output),
    1,
  );
  if (existsSync(join(probe, output)))
    throw new Error(`${name} created a preview`);
  console.log(`PASS ${name}: rejected before preview`);
};
const changedPlaces = (change: (rows: ReviewRow[]) => void) => {
  const copy = structuredClone(places);
  change(copy);
  return encodeCsv(placeHeaders, copy);
};

expectRejected(
  "changed-header",
  read("places.csv").replace("Review status", "Status"),
);
expectRejected("unclosed-quote", read("places.csv") + '"unclosed');
expectRejected(
  "future-review-date",
  changedPlaces((rows) => {
    rows[0]["Identity reviewed on"] = "9999-01-01";
  }),
);
expectRejected(
  "duplicate-target",
  changedPlaces((rows) => {
    const first = rows.find((row) => row.Name === "Synthetic Matched Cafe")!;
    const second = rows.find((row) => row.Name === "Synthetic New Coffee")!;
    second["KC3 place ID"] = first["KC3 place ID"].toUpperCase();
  }),
);
const badHours = structuredClone(hours);
badHours.find((row) => row.Name === "Synthetic New Coffee")!.Monday = "";
expectRejected(
  "incomplete-hours",
  read("places.csv"),
  encodeCsv(hourHeaders, badHours),
);
const originalPreview = read("preview.json");
const changedBatch = file(
  "changed-batch-places.csv",
  changedPlaces((rows) => {
    rows.find((row) => row.Name === "Synthetic Matched Cafe")![
      "Review status"
    ] = "Pending";
  }),
);
run(
  "scripts/import-overture-review.ts",
  [
    join(base, "manifest.json"),
    changedBatch,
    join(base, "hours.csv"),
    join(base, "preview.json"),
  ],
  1,
);
if (read("preview.json") !== originalPreview)
  throw new Error("Changed batch overwrote the existing preview.");
console.log("PASS changed batch cannot overwrite an existing preview");

const snapshot = JSON.parse(read("db-before.json")) as {
  places: { identity: { city: string; status: string } }[];
};
const expectConflict = (
  name: string,
  placeText: string,
  nextSnapshot: typeof snapshot,
  conflicts: string[],
) => {
  const placePath = file(`${name}-places.csv`, placeText);
  const snapshotPath = file(
    `${name}-snapshot.json`,
    JSON.stringify(nextSnapshot),
  );
  const output = `${name}-report.json`;
  run(
    "scripts/plan-overture-reconciliation.ts",
    planArgs(placePath, join(base, "hours.csv"), snapshotPath, output),
    0,
  );
  const report = JSON.parse(readFileSync(join(probe, output), "utf8")) as {
    entries: { conflicts: string[] }[];
    publicationAllowed: boolean;
  };
  if (
    report.publicationAllowed ||
    !conflicts.every((conflict) =>
      report.entries.some((entry) => entry.conflicts.includes(conflict)),
    )
  )
    throw new Error(`${name} did not report all expected conflicts`);
  console.log(`PASS ${name}: ${conflicts.join(", ")}`);
};
expectConflict(
  "unknown-target",
  changedPlaces((rows) => {
    rows.find((row) => row.Name === "Synthetic Matched Cafe")!["KC3 place ID"] =
      "55555555-5555-4555-8555-555555555555";
  }),
  snapshot,
  ["target_not_found"],
);
const hidden = structuredClone(snapshot);
hidden.places[0].identity.status = "hidden";
expectConflict("hidden-status", read("places.csv"), hidden, [
  "hidden_status_must_be_preserved",
]);
const movedCity = structuredClone(snapshot);
movedCity.places[0].identity.city = "Olathe";
expectConflict("city-change", read("places.csv"), movedCity, [
  "city_change_requires_review",
]);
expectConflict(
  "kc3-hours",
  changedPlaces((rows) => {
    rows.find((row) => row.Name === "Synthetic Matched Cafe")![
      "Review status"
    ] = "Pending";
    rows.find((row) => row.Name === "Synthetic New Coffee")!["KC3 place ID"] =
      "11111111-1111-4111-8111-111111111111";
  }),
  snapshot,
  ["city_change_requires_review", "existing_kc3_hours_require_review"],
);

console.log(`PASS workbook/CSV rows match exactly; probe files: ${probe}`);
