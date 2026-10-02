import type {
  CanonicalCorrectionPlace,
  CanonicalCorrectionWrite,
} from "../src/operator/canonicalCorrection";
import type { CanonicalCorrectionRepository } from "../src/operator/canonicalCorrectionRepository";
import {
  runCanonicalCorrectionEditor,
  type CanonicalCorrectionRunResult,
} from "../src/operator/canonicalCorrectionRunner";
import type { OperatorIo } from "../src/operator/placeDetailsRunner";

function place(
  overrides: Partial<CanonicalCorrectionPlace> = {},
): CanonicalCorrectionPlace {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Shared Name Park",
    city: "Lenexa",
    address: "W 93rd St & Greenway Ln, Lenexa, KS 66215",
    addressPrecision: "approximate",
    placeType: "park",
    status: "active",
    placeUpdatedAt: "2026-09-28 12:00:00+00",
    googlePlaceId: "google-one",
    googleName: "Shared Name Park RIGHT",
    googleAddress: "W 93rd St & Greenway Ln, Lenexa, KS 66215",
    googlePrimaryType: "park",
    googleTypes: ["park", "point_of_interest"],
    googleBusinessStatus: "OPERATIONAL",
    googleFetchedAt: "2026-09-24T12:00:00Z",
    ...overrides,
  };
}

function harness(answers: string[], places: CanonicalCorrectionPlace[]) {
  const output: string[] = [];
  const saved: [string, CanonicalCorrectionWrite][] = [];
  const io: OperatorIo = {
    async ask(prompt) {
      output.push(prompt);
      const answer = answers.shift();
      if (answer === undefined) throw new Error(`No answer for ${prompt}`);
      return answer;
    },
    write(message) {
      output.push(message);
    },
  };
  const repository: CanonicalCorrectionRepository = {
    async search() {
      return places;
    },
    async save(placeId, write) {
      saved.push([placeId, write]);
      const selected = places.find((candidate) => candidate.id === placeId)!;
      return { ...selected, ...write.canonical };
    },
  };
  return { io, output, repository, saved };
}

async function run(
  answers: string[],
  places: CanonicalCorrectionPlace[] = [place()],
): Promise<{
  result: CanonicalCorrectionRunResult;
  output: string[];
  saved: [string, CanonicalCorrectionWrite][];
}> {
  const { io, output, repository, saved } = harness(answers, places);
  const result = await runCanonicalCorrectionEditor(
    "Shared",
    "Lenexa",
    repository,
    io,
    () => "2026-09-29",
  );
  return { result, output, saved };
}

describe("KC3 canonical correction operator workflow", () => {
  it("selects a duplicate-looking record and saves a sourced complete correction", async () => {
    const places = [
      place(),
      place({
        id: "22222222-2222-4222-8222-222222222222",
        address: "2 Second St, Lenexa, KS 66215",
        googlePlaceId: "google-two",
        googleAddress: "2 Second St, Lenexa, KS 66215",
      }),
    ];
    const result = await run(
      [
        "2",
        "Correct Park Name",
        "675 W 93rd St, Lenexa, KS 66215",
        "street_address",
        "",
        "bad-url",
        "https://www.lenexa.com/park",
        "",
        "Official city park page lists the corrected name and address.",
        "yes",
      ],
      places,
    );

    expect(result.result).toBe("saved");
    expect(result.saved).toEqual([
      [
        places[1].id,
        {
          expectedUpdatedAt: places[1].placeUpdatedAt,
          canonical: {
            name: "Correct Park Name",
            address: "675 W 93rd St, Lenexa, KS 66215",
            addressPrecision: "street_address",
            placeType: "park",
          },
          evidence: {
            sourceUrl: "https://www.lenexa.com/park",
            observedOn: "2026-09-29",
            notes:
              "Official city park page lists the corrected name and address.",
          },
        },
      ],
    ]);
    expect(result.output.join("\n")).toContain("google-one");
    expect(result.output.join("\n")).toContain("google-two");
    expect(result.output).toContain("Enter a valid HTTPS URL.");
    expect(result.output.join("\n")).toContain("Pending canonical correction:");
  });

  it("validates bounded enum, date, and required note inputs", async () => {
    const result = await run([
      "1",
      "",
      "New address",
      "precise",
      "approximate",
      "restaurant",
      "cafe",
      "https://example.gov/place",
      "2026-02-30",
      "2026-09-28",
      "",
      "Official source confirms the public-facing identity.",
      "yes",
    ]);

    expect(result.result).toBe("saved");
    expect(result.output).toContain(
      "Allowed values: street_address, approximate, unknown.",
    );
    expect(result.output).toContain(
      "Allowed values: coffee_shop, cafe, boba_tea, library, coworking, park.",
    );
    expect(result.output).toContain("Enter a real date in YYYY-MM-DD format.");
    expect(result.output).toContain("Correction notes cannot be blank.");
    expect(result.saved[0][1].canonical.placeType).toBe("cafe");
  });

  it("cancels at selection or final confirmation without saving", async () => {
    const first = await run(["q"]);
    expect(first.result).toBe("cancelled");
    expect(first.saved).toHaveLength(0);

    const second = await run([
      "1",
      "Corrected name",
      "",
      "",
      "",
      "https://example.gov/place",
      "",
      "Official source.",
      "no",
    ]);
    expect(second.result).toBe("cancelled");
    expect(second.saved).toHaveLength(0);
  });

  it("does not request evidence or write when canonical values are unchanged", async () => {
    const result = await run(["1", "", "", "", ""]);
    expect(result.result).toBe("no_changes");
    expect(result.saved).toHaveLength(0);
    expect(result.output.join("\n")).not.toContain("Authoritative HTTPS");
  });

  it("reports no active provider-backed matches without prompting", async () => {
    const result = await run([], []);
    expect(result.result).toBe("no_results");
    expect(result.saved).toHaveLength(0);
    expect(result.output.join("\n")).toContain(
      "No active provider-backed places",
    );
  });
});
