import { getGoogleIngestionConfig } from "../src/config/googleIngestion";
import { createGoogleImportRepository } from "../src/ingestion/googleImportRepository";
import {
  runGoogleImport,
  type GoogleImportOptions,
} from "../src/ingestion/googleImportRunner";
import {
  GooglePlacesClient,
  MVP_CITIES,
  MVP_PLACE_CATEGORIES,
} from "../src/ingestion/googlePlacesProvider";

const help = `Usage:
  npm run ingest:google -- --city <city[,city]> --category <type[,type]> [options]

Required bounds:
  --city        ${MVP_CITIES.join(", ")}
  --category    ${MVP_PLACE_CATEGORIES.join(", ")}

Options:
  --max-pages <1-3>    Search pages per city/category (default: 3)
  --max-places <1-200> Global unique-place cap (default: 60)
  --attach <GoogleID=KC3UUID>
                       Attach one reviewed provider identity to an existing place
  --create <GoogleID>  Create despite one deterministic duplicate candidate
  --write              Commit validated records (default is dry-run)
  --help               Show this help
`;

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (!options) {
    console.log(help);
    return;
  }

  const config = getGoogleIngestionConfig();
  const provider = new GooglePlacesClient(config.googleApiKey);
  const repository = createGoogleImportRepository(config);
  const summary = await runGoogleImport(options, provider, repository);

  console.log(
    `KC3 Google Places import (${options.write ? "write" : "dry-run"})`,
  );
  console.log(`Cities: ${options.cities.join(", ")}`);
  console.log(`Categories: ${options.categories.join(", ")}`);
  console.log(`Discovered: ${summary.discovered}`);
  console.log(
    `${options.write ? "Inserted" : "Would insert"}: ${summary.inserted}`,
  );
  console.log(
    `${options.write ? "Updated" : "Would update"}: ${summary.updated}`,
  );
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Failed: ${summary.failed}`);
  for (const query of summary.queries) {
    console.log(
      `Query ${query.category} in ${query.city}: ${query.failed ? "failed" : `${query.discovered} IDs across ${query.pagesFetched} page(s); provider capped=${query.providerCapped ? "yes" : "no"}; selection capped=${query.selectionCapped ? "yes" : "no"}`}`,
    );
  }
  for (const message of summary.messages) console.log(`- ${message}`);

  if (summary.failed > 0) process.exitCode = 1;
}

function parseArguments(arguments_: string[]): GoogleImportOptions | undefined {
  if (arguments_.includes("--help")) return undefined;

  let cityValue: string | undefined;
  let categoryValue: string | undefined;
  let maxPages = 3;
  let maxPlaces = 60;
  let write = false;
  const attachments: Record<string, string> = {};
  const explicitCreates: string[] = [];

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--write") {
      write = true;
      continue;
    }
    if (argument === "--attach" || argument === "--create") {
      const value = arguments_[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      index += 1;
      if (argument === "--create") {
        if (!value.trim()) throw new Error("--create requires a Google ID.");
        explicitCreates.push(value.trim());
      } else {
        const separator = value.lastIndexOf("=");
        const googlePlaceId = value.slice(0, separator).trim();
        const placeId = value.slice(separator + 1).trim();
        if (
          separator <= 0 ||
          !googlePlaceId ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            placeId,
          )
        ) {
          throw new Error("--attach must use GoogleID=KC3UUID.");
        }
        if (
          attachments[googlePlaceId] &&
          attachments[googlePlaceId] !== placeId
        ) {
          throw new Error(`Conflicting --attach values for ${googlePlaceId}.`);
        }
        attachments[googlePlaceId] = placeId;
      }
      continue;
    }
    if (
      !["--city", "--category", "--max-pages", "--max-places"].includes(
        argument,
      )
    ) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    index += 1;
    if (argument === "--city") cityValue = value;
    if (argument === "--category") categoryValue = value;
    if (argument === "--max-pages")
      maxPages = boundedInteger(value, argument, 1, 3);
    if (argument === "--max-places")
      maxPlaces = boundedInteger(value, argument, 1, 200);
  }

  if (!cityValue || !categoryValue) {
    throw new Error("Both --city and --category are required bounds.");
  }

  return {
    cities: parseAllowlist(cityValue, MVP_CITIES, "city"),
    categories: parseAllowlist(categoryValue, MVP_PLACE_CATEGORIES, "category"),
    maxPages,
    maxPlaces,
    write,
    attachments,
    explicitCreates: [...new Set(explicitCreates)],
  };
}

function parseAllowlist<const T extends readonly string[]>(
  value: string,
  allowlist: T,
  label: string,
): T[number][] {
  const values = [...new Set(value.split(",").map((item) => item.trim()))];
  if (
    values.length === 0 ||
    values.some((item) => !allowlist.includes(item as T[number]))
  ) {
    throw new Error(
      `Invalid ${label}; allowed values: ${allowlist.join(", ")}.`,
    );
  }
  return values as T[number][];
}

function boundedInteger(
  value: string,
  label: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${label} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return parsed;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown failure.";
  console.error(`KC3 Google Places import failed: ${message}`);
  process.exitCode = 1;
});
