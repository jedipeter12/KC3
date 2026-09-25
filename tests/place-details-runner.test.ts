import {
  emptyPlaceDetails,
  type OperatorPlace,
} from "../src/operator/placeDetails";
import type { PlaceDetailsRepository } from "../src/operator/placeDetailsRepository";
import {
  runPlaceDetailsEditor,
  type OperatorIo,
} from "../src/operator/placeDetailsRunner";

function place(overrides: Partial<OperatorPlace> = {}): OperatorPlace {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Shared Name Coffee",
    city: "Lenexa",
    address: "1 First St, Lenexa, KS",
    placeType: "coffee_shop",
    googlePlaceId: "google-one",
    googleName: "Shared Name Coffee",
    googleAddress: "1 First St, Lenexa, KS 66215",
    googleBusinessStatus: "OPERATIONAL",
    googleFetchedAt: "2026-09-24T12:00:00Z",
    detailUpdatedAt: null,
    details: emptyPlaceDetails,
    ...overrides,
  };
}

function harness(answers: string[], places: OperatorPlace[]) {
  const output: string[] = [];
  const saved: Parameters<PlaceDetailsRepository["save"]>[] = [];
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
  const repository: PlaceDetailsRepository = {
    async search() {
      return places;
    },
    async save(...arguments_) {
      saved.push(arguments_);
      const selected = places.find(
        (candidate) => candidate.id === arguments_[0],
      );
      return { ...selected!, details: arguments_[1].details };
    },
  };
  return { io, output, repository, saved };
}

describe("KC3 place-detail operator workflow", () => {
  it("selects between duplicate-looking provider-backed places and creates verified details", async () => {
    const places = [
      place(),
      place({
        id: "22222222-2222-4222-8222-222222222222",
        address: "2 Second St, Lenexa, KS",
        googlePlaceId: "google-two",
        googleAddress: "2 Second St, Lenexa, KS 66215",
      }),
    ];
    const { io, output, repository, saved } = harness(
      [
        "2",
        "Indoor and patio seating",
        "many",
        "public",
        "good",
        "light",
        "yes",
        "unknown",
        "yes",
        "no",
        "yes",
        "",
        "Observed during morning visit",
        "yes",
      ],
      places,
    );

    await expect(
      runPlaceDetailsEditor(
        "Shared Name",
        "Lenexa",
        repository,
        io,
        () => "2026-09-24",
      ),
    ).resolves.toBe("saved");

    expect(saved).toHaveLength(1);
    expect(saved[0][0]).toBe(places[1].id);
    expect(saved[0][1]).toEqual({
      expectedUpdatedAt: null,
      details: {
        seatingNotes: "Indoor and patio seating",
        outlets: "many",
        wifi: "public",
        workSuitability: "good",
        foodBeverage: "light",
        phoneCallsAllowed: true,
        bathroomAvailable: null,
        driveThruAvailable: true,
        driveThruOnly: false,
        lastVerifiedAt: "2026-09-24",
        verificationNotes: "Observed during morning visit",
      },
    });
    expect(output.join("\n")).toContain("1 First St");
    expect(output.join("\n")).toContain("2 Second St");
    expect(output.join("\n")).toContain("Pending KC3-owned changes:");
    expect(output.join("\n")).not.toContain("Bathroom: unknown / unset ->");
  });

  it("updates a partial row, retains unknowns, validates input, and does not refresh verification without confirmation", async () => {
    const existing = place({
      detailUpdatedAt: "2026-09-20 12:00:00+00",
      details: {
        ...emptyPlaceDetails,
        seatingNotes: "Some tables",
        outlets: "few",
        lastVerifiedAt: "2026-01-01",
      },
    });
    const { io, output, repository, saved } = harness(
      [
        "1",
        "",
        "invalid",
        "many",
        "",
        "",
        "",
        "",
        "",
        "unknown",
        "unknown",
        "no",
        "yes",
      ],
      [existing],
    );

    await expect(
      runPlaceDetailsEditor("Shared", "Lenexa", repository, io),
    ).resolves.toBe("saved");

    expect(output).toContain("Allowed values: none, few, many, unknown.");
    expect(saved[0][1].details.outlets).toBe("many");
    expect(saved[0][1].details.bathroomAvailable).toBeNull();
    expect(saved[0][1].details.lastVerifiedAt).toBe("2026-01-01");
    expect(saved[0][1].expectedUpdatedAt).toBe("2026-09-20 12:00:00+00");
  });

  it("cancels without a database write at selection or final confirmation", async () => {
    const first = harness(["q"], [place()]);
    await expect(
      runPlaceDetailsEditor("Shared", "Lenexa", first.repository, first.io),
    ).resolves.toBe("cancelled");
    expect(first.saved).toHaveLength(0);

    const second = harness(
      ["1", "New seating", "", "", "", "", "", "", "", "", "no", "no"],
      [place()],
    );
    await expect(
      runPlaceDetailsEditor("Shared", "Lenexa", second.repository, second.io),
    ).resolves.toBe("cancelled");
    expect(second.saved).toHaveLength(0);
  });

  it("does not write when every value is retained", async () => {
    const { io, repository, saved } = harness(
      ["1", "", "", "", "", "", "", "", "", "", "no"],
      [place()],
    );
    await expect(
      runPlaceDetailsEditor("Shared", "Lenexa", repository, io),
    ).resolves.toBe("no_changes");
    expect(saved).toHaveLength(0);
  });

  it("reports an empty active/provider-backed search without prompting", async () => {
    const { io, output, repository, saved } = harness([], []);
    await expect(
      runPlaceDetailsEditor("Missing", "Olathe", repository, io),
    ).resolves.toBe("no_results");
    expect(output.join("\n")).toContain("No active provider-backed places");
    expect(saved).toHaveLength(0);
  });
});
