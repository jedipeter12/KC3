import { createInterface } from "node:readline/promises";

import { getOperatorDatabaseConfig } from "../src/config/operatorDatabase";
import { createPlaceDetailsRepository } from "../src/operator/placeDetailsRepository";
import { runPlaceDetailsEditor } from "../src/operator/placeDetailsRunner";

const help = `Usage:
  npm run edit:place-details -- --name <name search> --city <city>

Searches active provider-backed KC3 places, prompts for KC3-owned details,
shows every pending change, and writes only after exact "yes" confirmation.
`;

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (!options) {
    console.log(help);
    return;
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    await runPlaceDetailsEditor(
      options.name,
      options.city,
      createPlaceDetailsRepository(getOperatorDatabaseConfig()),
      {
        ask: (prompt) => readline.question(prompt),
        write: (message) => console.log(message),
      },
    );
  } finally {
    readline.close();
  }
}

export function parseArguments(
  arguments_: readonly string[],
): { name: string; city: string } | undefined {
  if (arguments_.includes("--help")) return undefined;
  let name: string | undefined;
  let city: string | undefined;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument !== "--name" && argument !== "--city") {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = arguments_[index + 1]?.trim();
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    index += 1;
    if (argument === "--name") name = value;
    if (argument === "--city") city = value;
  }

  if (!name || !city) throw new Error("Both --name and --city are required.");
  return { name, city };
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown failure.";
    console.error(`KC3 place-detail editor failed: ${message}`);
    process.exitCode = 1;
  });
}
