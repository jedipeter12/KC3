/// <reference types="node" />
import { execFileSync } from "node:child_process";
import path from "node:path";

const prerequisites =
  "KC3 integration prerequisites: start Docker Desktop, run npm exec -- supabase start, " +
  "then npm exec -- supabase db reset --local against the disposable local database. " +
  "See docs/DEVELOPMENT.md. The clean seed and a reviewed provider-backed local dataset are both supported.";

let supabase: typeof import("../../src/lib/supabase").supabase;
let listPublicPlaces: typeof import("../../src/data/publicPlaces").listPublicPlaces;
let filterPlaces: typeof import("../../src/features/places/placeFilters").filterPlaces;
let getPlaceFilterOptions: typeof import("../../src/features/places/placeFilters").getPlaceFilterOptions;

const requireProviderDataset = process.env.KC3_EXPECT_PROVIDER_DATASET === "1";

beforeAll(() => {
  let status: { API_URL?: string; ANON_KEY?: string };
  try {
    status = JSON.parse(
      execFileSync(
        path.resolve("node_modules/.bin/supabase"),
        ["status", "-o", "json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 },
      ),
    );
    const url = new URL(status.API_URL ?? "");
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) ||
      !status.ANON_KEY
    ) {
      throw new Error("Invalid local configuration");
    }
  } catch {
    // CLI output can contain privileged credentials; never include it in errors.
    throw new Error(prerequisites);
  }

  // Ignore ambient Expo configuration. Only the local anonymous key is used.
  process.env.EXPO_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.ANON_KEY;
  ({ supabase } = jest.requireActual<typeof import("../../src/lib/supabase")>(
    "../../src/lib/supabase",
  ));
  ({ listPublicPlaces } = jest.requireActual<
    typeof import("../../src/data/publicPlaces")
  >("../../src/data/publicPlaces"));
  ({ filterPlaces, getPlaceFilterOptions } = jest.requireActual<
    typeof import("../../src/features/places/placeFilters")
  >("../../src/features/places/placeFilters"));
});

it("returns active MVP-city places with exactly the five serialized fields", async () => {
  const { data, error, status } = await supabase
    .rpc("list_public_places")
    .abortSignal(AbortSignal.timeout(5000));
  if (error || !data) {
    throw new Error(
      `Local public RPC failed (HTTP ${status}). ${prerequisites}`,
    );
  }
  expect(data.length).toBeGreaterThan(0);
  for (const place of data) {
    // Check the raw RPC result before the data layer can strip extra fields.
    expect(Object.keys(place).sort()).toEqual([
      "address",
      "city",
      "id",
      "name",
      "place_type",
    ]);
    for (const value of Object.values(place)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
    expect(["Lenexa", "Overland Park", "Olathe"]).toContain(place.city);
    expect([
      "coffee_shop",
      "cafe",
      "boba_tea",
      "library",
      "coworking",
      "park",
    ]).toContain(place.place_type);
  }
  if (requireProviderDataset) expect(data.length).toBeGreaterThan(100);
});

it("loads the same live RPC result through the production data layer", async () => {
  const { data, error } = await supabase
    .rpc("list_public_places")
    .abortSignal(AbortSignal.timeout(5000));
  expect(error).toBeNull();
  expect(data?.length).toBeGreaterThan(0);
  await expect(listPublicPlaces()).resolves.toEqual(data);
});

it("applies production search and city/type filters to the live RPC dataset", async () => {
  const places = await listPublicPlaces();

  expect(
    filterPlaces(places, {
      city: null,
      nameQuery: "  bLaCk DoG  ",
      placeType: null,
    }).map((place) => place.name),
  ).toContain("Black Dog Coffeehouse");

  const olatheParks = filterPlaces(places, {
    city: "Olathe",
    nameQuery: "",
    placeType: "park",
  });
  expect(olatheParks.length).toBeGreaterThan(0);
  expect(
    olatheParks.every(
      (place) => place.city === "Olathe" && place.place_type === "park",
    ),
  ).toBe(true);

  const options = getPlaceFilterOptions(places);
  expect(options.cities).toEqual(
    expect.arrayContaining(["Lenexa", "Overland Park", "Olathe"]),
  );
  expect(options.placeTypes).toEqual(
    expect.arrayContaining(["coffee_shop", "library", "park"]),
  );
  if (requireProviderDataset) {
    expect(options.placeTypes).toEqual(
      expect.arrayContaining([
        "coffee_shop",
        "cafe",
        "boba_tea",
        "library",
        "coworking",
        "park",
      ]),
    );
  }
});

it("denies direct anonymous access to places with a permission error", async () => {
  // Intentionally probe an API excluded from the production Database type.
  const { data, error, status } = await supabase
    .from("places" as never)
    .select("*")
    .abortSignal(AbortSignal.timeout(5000));
  expect(data).toBeNull();
  expect(status).toBe(401);
  expect(error?.code).toBe("42501");
});
