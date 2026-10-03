import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createManifest,
  draftRows,
  encodeCsv,
  placeHeaders,
  hourHeaders,
} from "../src/ingestion/overtureReview";

async function main() {
  const [input, directory] = process.argv.slice(2);
  if (!input || !directory)
    throw new Error(
      "Usage: prepare-overture-review.ts regional.json output-directory",
    );
  const manifest = createManifest(JSON.parse(await readFile(input, "utf8")));
  const rows = draftRows(manifest);
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { flag: "wx" },
  );
  await writeFile(
    resolve(directory, "workbook-data.json"),
    JSON.stringify({ manifest, ...rows, placeHeaders, hourHeaders }),
    { flag: "wx" },
  );
  await writeFile(
    resolve(directory, "places.csv"),
    encodeCsv(placeHeaders, rows.places),
    { flag: "wx" },
  );
  await writeFile(
    resolve(directory, "hours.csv"),
    encodeCsv(hourHeaders, rows.hours),
    { flag: "wx" },
  );
  console.log(
    `Prepared ${manifest.records.length} Pending candidates. No database writes.`,
  );
}
main().catch(() => {
  console.error(
    "Overture review preparation failed. Check input shape, source licenses, and paths.",
  );
  process.exitCode = 1;
});
