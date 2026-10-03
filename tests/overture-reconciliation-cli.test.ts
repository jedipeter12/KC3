import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createManifest,
  draftRows,
  encodeCsv,
  placeHeaders,
  hourHeaders,
} from "../src/ingestion/overtureReview";

test("CLI compiles actual reviewed CSVs, exclusively creates a report, and rejects incomplete snapshots", () => {
  const directory = mkdtempSync(join(tmpdir(), "kc3-reconciliation-test-"));
  try {
    const manifest = createManifest([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        name: "Synthetic Coffee",
        addresses: [{ locality: "Lenexa", freeform: "1 Synthetic St" }],
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
    const paths = [
      "manifest.json",
      "places.csv",
      "hours.csv",
      "snapshot.json",
      "report.json",
    ].map((file) => join(directory, file));
    writeFileSync(paths[0], JSON.stringify(manifest));
    writeFileSync(paths[1], encodeCsv(placeHeaders, rows.places));
    writeFileSync(paths[2], encodeCsv(hourHeaders, rows.hours));
    writeFileSync(paths[3], JSON.stringify({ schemaVersion: 1, places: [] }));
    const run = (args: string[]) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          resolve("scripts/plan-overture-reconciliation.ts"),
          ...args,
        ],
        { encoding: "utf8", timeout: 15_000 },
      );
    expect(run(paths).status).toBe(0);
    const report = readFileSync(paths[4], "utf8");
    expect(JSON.parse(report)).toMatchObject({
      mode: "dry_run_only",
      publicationAllowed: false,
      entries: [{ action: "new_candidate_requires_review" }],
    });
    expect(run(paths).status).toBe(1);
    expect(readFileSync(paths[4], "utf8")).toBe(report);
    expect(run([...paths, "--apply"]).status).toBe(1);
    writeFileSync(paths[3], JSON.stringify({ schemaVersion: 1, places: [{}] }));
    expect(
      run([...paths.slice(0, 4), join(directory, "invalid-report.json")])
        .status,
    ).toBe(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
