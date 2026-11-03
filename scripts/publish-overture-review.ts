import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { getOperatorDatabaseConfig } from "../src/config/operatorDatabase";
import type { ReviewBatch } from "../src/ingestion/overtureReview";
import { validatePublicationApprovals } from "../src/ingestion/overturePublication";

async function main() {
  const [previewPath, approvalPath, flag] = process.argv.slice(2);
  if (!previewPath || !approvalPath || (flag && flag !== "--publish")) {
    throw new Error(
      "Usage: publish-overture-review.ts preview.json approvals.json [--publish]",
    );
  }
  const batch = JSON.parse(await readFile(previewPath, "utf8")) as ReviewBatch;
  const approvals = validatePublicationApprovals(
    batch,
    JSON.parse(await readFile(approvalPath, "utf8")),
  );
  console.log(
    `Reviewed batch: ${batch.batchId}; approved rows: ${approvals.length}`,
  );
  for (const row of approvals) {
    console.log(
      `${row.overtureId}: ${row.targetPlaceId ?? "new KC3 ID"}; ${row.reviewNotes.trim()}`,
    );
  }
  if (flag !== "--publish") return;
  const io = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await io.question(`Type PUBLISH ${batch.batchId}: `);
    if (answer !== `PUBLISH ${batch.batchId}`) {
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
  const staged = await client.rpc("kc3_stage_overture_review", { batch });
  if (
    staged.error ||
    !staged.data ||
    !["staged", "unchanged"].includes(staged.data.action)
  ) {
    throw new Error("Exact reviewed batch is not staged; publication stopped.");
  }
  for (const row of approvals) {
    const { data, error } = await client.rpc("kc3_publish_overture_place", {
      reviewed_batch_id: batch.batchId,
      reviewed_overture_id: row.overtureId,
      confirmed_target_id: row.targetPlaceId,
      expected_updated_at: row.expectedUpdatedAt,
      municipal_eligibility_confirmed: true,
      duplicate_review_confirmed: true,
      review_notes: row.reviewNotes.trim(),
    });
    if (error || !data || typeof data.placeId !== "string") {
      throw new Error(
        `Publication stopped at ${row.overtureId}. Earlier rows may have committed; inspect the publication ledger before resuming.`,
      );
    }
    console.log(`Published ${row.overtureId} as KC3 ${data.placeId}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Publication failed.");
  process.exitCode = 1;
});
