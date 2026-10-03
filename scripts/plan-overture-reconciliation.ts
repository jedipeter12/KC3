import { readFile, writeFile } from "node:fs/promises";
import {
  compileReview,
  decodeCsv,
  placeHeaders,
  hourHeaders,
  type ReviewManifest,
} from "../src/ingestion/overtureReview";
import {
  parseReconciliationSnapshot,
  planOvertureReconciliation,
} from "../src/ingestion/overtureReconciliation";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 5 || args.some((arg) => arg.startsWith("--"))) {
    throw new Error(
      "Usage: plan-overture-reconciliation.ts manifest.json places.csv hours.csv snapshot.json report.json",
    );
  }
  const [manifestPath, placesPath, hoursPath, snapshotPath, reportPath] = args;
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as ReviewManifest;
  const batch = compileReview(
    manifest,
    decodeCsv(await readFile(placesPath, "utf8"), placeHeaders),
    decodeCsv(await readFile(hoursPath, "utf8"), hourHeaders),
    new Date().toISOString().slice(0, 10),
  );
  const snapshot = parseReconciliationSnapshot(
    JSON.parse(await readFile(snapshotPath, "utf8")),
  );
  const report = planOvertureReconciliation(batch, snapshot);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    `Dry-run report: ${report.entries.length} reviewed candidates; ${report.entries.filter((entry) => entry.action === "blocked").length} blocked. Publication is disabled.`,
  );
}
main().catch(() => {
  console.error(
    "Reconciliation planning failed. Check reviewed inputs, complete snapshot, and a new report filename. No database operation was performed.",
  );
  process.exitCode = 1;
});
