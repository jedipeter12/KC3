import { createInterface } from "node:readline/promises";
import { getOperatorDatabaseConfig } from "../src/config/operatorDatabase";
import { discoverySources } from "../src/operator/thirdSpaceReview";
import { createThirdSpaceReviewRepository } from "../src/operator/thirdSpaceReviewRepository";
import {
  runThirdSpaceReview,
  startThirdSpaceReview,
} from "../src/operator/thirdSpaceReviewRunner";

export function parseArguments(
  args: string[],
): { name: string; city: string; source: string; placeId: string } | null {
  if (args.includes("--help")) return null;
  const filters = { name: "", city: "", source: "", placeId: "" };
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1]?.trim();
    if (!value || !["--name", "--city", "--source", "--place-id"].includes(key))
      throw new Error(`Invalid argument: ${key}`);
    filters[
      (key === "--place-id" ? "placeId" : key.slice(2)) as keyof typeof filters
    ] = value;
  }
  if (
    filters.source &&
    !discoverySources.includes(
      filters.source as (typeof discoverySources)[number],
    )
  )
    throw new Error("Unknown discovery source.");
  if (filters.placeId && (filters.name || filters.city || filters.source))
    throw new Error("Use --place-id alone when starting a canonical review.");
  if (!filters.name && !filters.city && !filters.source && !filters.placeId)
    throw new Error("Provide at least one filter.");
  return filters;
}
async function main(): Promise<void> {
  const filters = parseArguments(process.argv.slice(2));
  if (!filters) {
    console.log(
      "Usage: npm run review:third-space -- --name <text> [--city <city>] [--source <source>]\n   or: npm run review:third-space -- --place-id <canonical UUID>",
    );
    return;
  }
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const repository = createThirdSpaceReviewRepository(
      getOperatorDatabaseConfig(),
    );
    const io = {
      ask: (prompt: string) => readline.question(prompt),
      write: (message: string) => console.log(message),
    };
    if (filters.placeId)
      await startThirdSpaceReview(repository, io, filters.placeId);
    else await runThirdSpaceReview(repository, io, filters);
  } finally {
    readline.close();
  }
}
if (require.main === module)
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Third-space review failed.",
    );
    process.exitCode = 1;
  });
