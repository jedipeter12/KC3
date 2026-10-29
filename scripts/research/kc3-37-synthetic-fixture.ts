import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createManifest,
  draftRows,
  encodeCsv,
  hourHeaders,
  placeHeaders,
} from "../../src/ingestion/overtureReview";
import type { ReconciliationSnapshot } from "../../src/ingestion/overtureReconciliation";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: fixture.ts output-directory");

const target = "11111111-1111-4111-8111-111111111111";
const sources = [
  {
    dataset: "synthetic-fixture",
    license: "CDLA-Permissive-2.0",
    property: "",
  },
];
const manifest = createManifest([
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Synthetic Matched Cafe",
    addresses: [{ locality: "Lenexa", freeform: "1 Fixture Way" }],
    taxonomy: { primary: "cafe" },
    operating_status: "open",
    confidence: 0.9,
    sources,
    latitude: 38.9,
    longitude: -94.7,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Synthetic New Coffee",
    addresses: [{ locality: "Olathe", freeform: "2 Fixture Way" }],
    taxonomy: { primary: "coffee_shop" },
    operating_status: "open",
    confidence: 0.9,
    sources,
    latitude: 38.8,
    longitude: -94.8,
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Synthetic Pending Park",
    addresses: [{ locality: "Lenexa", freeform: "" }],
    taxonomy: { primary: "park" },
    operating_status: "open",
    sources,
    latitude: 38.91,
    longitude: -94.71,
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    name: "Synthetic Excluded Park",
    addresses: [{ locality: "Olathe", freeform: "4 Fixture Way" }],
    taxonomy: { primary: "park" },
    operating_status: "open",
    sources,
    latitude: 38.81,
    longitude: -94.81,
  },
]);
const rows = draftRows(manifest);
for (const place of rows.places) {
  if (place.Name === "Synthetic Matched Cafe") {
    place["Review status"] = "Ready";
    place["KC3 place ID"] = target;
  } else if (place.Name === "Synthetic New Coffee") {
    place["Review status"] = "Ready";
  } else if (place.Name === "Synthetic Excluded Park") {
    place["Review status"] = "Exclude";
  }
  if (place["Review status"] === "Ready")
    place["Identity reviewed on"] = "2026-10-01";
}
const newHours = rows.hours.find((row) => row.Name === "Synthetic New Coffee")!;
newHours["Hours status"] = "Ready";
newHours["Hours source URL"] = "https://example.org/synthetic-hours";
newHours["Hours observed on"] = "2026-10-01";
newHours["Hours reuse basis"] = "Business supplied";
newHours["Hours notes"] = "Synthetic fixture permission statement.";
for (const day of hourHeaders.slice(3, 10)) newHours[day] = "Closed";
newHours.Monday = "09:00-12:00;13:00-17:00";
newHours.Tuesday = "24h";

const snapshot: ReconciliationSnapshot = {
  schemaVersion: 1,
  places: [
    {
      id: target,
      updatedAt: "2026-10-01T00:00:00Z",
      identity: {
        name: "Synthetic Old Cafe",
        city: "Lenexa",
        address: "1 Fixture Way",
        postcode: null,
        website: null,
        placeType: "cafe",
        addressPrecision: "unknown",
        latitude: 38.9,
        longitude: -94.7,
        timeZone: "America/Chicago",
        status: "active",
      },
      movedToPlaceId: null,
      protected: {
        details: [{ outlets: "many", bathroom_available: false, notes: null }],
        kc3Hours: [
          {
            source: "kc3",
            day_of_week: 0,
            open_time: "09:00",
            close_time: "17:00",
            source_observed_at: "2026-10-01T00:00:00Z",
          },
        ],
        overrides: [
          { override_type: "synthetic.v1", override_value: { v: 0 } },
        ],
        correctionEvidence: [
          {
            before_values: { name: "Synthetic Earlier Cafe" },
            after_values: { name: "Synthetic Old Cafe" },
          },
        ],
      },
    },
  ],
};

async function main() {
  await mkdir(directory, { recursive: true });
  const output = async (name: string, value: string) =>
    writeFile(resolve(directory, name), value, { flag: "wx" });
  await output("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  await output(
    "workbook-data.json",
    JSON.stringify({ manifest, ...rows, placeHeaders, hourHeaders }, null, 2) +
      "\n",
  );
  await output("places.csv", encodeCsv(placeHeaders, rows.places));
  await output("hours.csv", encodeCsv(hourHeaders, rows.hours));
  await output("snapshot.json", JSON.stringify(snapshot, null, 2) + "\n");
  console.log(
    "Created four synthetic workbook rows, review CSVs, and one synthetic snapshot.",
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
