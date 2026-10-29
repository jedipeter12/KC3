import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const project = "/private/tmp/kc3-37-synthetic-supabase";
const input = "/private/tmp/kc3-37-synthetic-input";
const cli = resolve("node_modules/.bin/supabase");
const status = JSON.parse(
  execFileSync(cli, ["status", "--workdir", project, "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
) as Record<string, unknown>;
if (
  status.API_URL !== "http://127.0.0.1:56321" ||
  typeof status.SERVICE_ROLE_KEY !== "string"
)
  throw new Error("Scratch project identity check failed; staging cancelled.");
const batch = JSON.parse(
  readFileSync(resolve(input, "preview.json"), "utf8"),
) as {
  batchId: string;
};
const result = spawnSync(
  process.execPath,
  [
    "--env-file-if-exists=.env.local",
    "--import",
    "tsx",
    "scripts/import-overture-review.ts",
    resolve(input, "manifest.json"),
    resolve(input, "places.csv"),
    resolve(input, "hours.csv"),
    resolve(input, "preview.json"),
    "--stage",
  ],
  {
    input: `STAGE ${batch.batchId}\n`,
    encoding: "utf8",
    env: {
      ...process.env,
      KC3_SUPABASE_URL: status.API_URL,
      KC3_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    },
    timeout: 30_000,
  },
);
process.stdout.write(result.stdout);
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exitCode = result.status ?? 1;
}
