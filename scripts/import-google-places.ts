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

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--write") {
      write = true;
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
