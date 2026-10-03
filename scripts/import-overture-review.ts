import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  compileReview,
  decodeCsv,
  placeHeaders,
  hourHeaders,
  type ReviewManifest,
} from "../src/ingestion/overtureReview";
import { getOperatorDatabaseConfig } from "../src/config/operatorDatabase";
import { createInterface } from "node:readline/promises";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--stage");
  const paths = args.filter((a) => a !== "--stage");
  if (paths.length !== 4)
    throw new Error(
      "Usage: import-overture-review.ts manifest.json places.csv hours.csv preview.json [--stage]",
    );
  const [manifestPath, placePath, hourPath, previewPath] = paths;
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as ReviewManifest;
  const batch = compileReview(
    manifest,
    decodeCsv(await readFile(placePath, "utf8"), placeHeaders),
    decodeCsv(await readFile(hourPath, "utf8"), hourHeaders),
    new Date().toISOString().slice(0, 10),
  );
  if (
    paths
      .slice(0, 3)
      .map((p) => resolve(p))
      .includes(resolve(previewPath))
  )
    throw new Error("Preview must not overwrite an input.");
  const previewText = JSON.stringify(batch, null, 2);
  try {
    await writeFile(previewPath, previewText, { flag: "wx" });
  } catch (error: unknown) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "EEXIST" ||
      (await readFile(previewPath, "utf8")) !== previewText
    )
      throw new Error(
        "Cannot create preview. Choose a new filename; existing files will not be overwritten.",
      );
  }
  console.log(
    `Preview: ${batch.records.length} Ready identities; ${batch.records.filter((r) => r.hours).length} Ready schedules. Pending/Exclude rows skipped.`,
  );
  console.log(
    "Preview contains exact staged values and source evidence. Current directory and KC3 details are unchanged.",
  );
  if (!apply || batch.records.length === 0) return;
  const io = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (
      (await io.question(
        `Read ${previewPath}. Type STAGE ${batch.batchId} to stage this exact batch: `,
      )) !== `STAGE ${batch.batchId}`
    ) {
      console.log("Cancelled.");
      return;
    }
  } finally {
    io.close();
  }
  const config = getOperatorDatabaseConfig();
  const client = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { data, error } = await client.rpc("kc3_stage_overture_review", {
    batch,
  });
  if (
    error ||
    !data ||
    data.batchId !== batch.batchId ||
    data.count !== batch.records.length ||
    !["staged", "unchanged"].includes(data.action)
  )
    throw new Error("Staging failed.");
  console.log(
    `Staged ${data.count} reviewed records (${data.action}). No public places were replaced.`,
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Overture review import failed.",
  );
  process.exitCode = 1;
});
