/// <reference types="node" />
import { execFileSync } from "node:child_process";
import path from "node:path";

import type { PublicPlace } from "../../src/types/database";

const prerequisites =
  "KC3 integration prerequisites: start Docker Desktop, run npm exec -- supabase start, " +
  "then npm exec -- supabase db reset --local against the disposable local database. " +
  "See docs/DEVELOPMENT.md. This test requires the unchanged 15-place seed.";

let supabase: typeof import("../../src/lib/supabase").supabase;
let listPublicPlaces: typeof import("../../src/data/publicPlaces").listPublicPlaces;

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
});

it("returns every seeded active place with exactly the five serialized fields", async () => {
  const { data, error, status } = await supabase
    .rpc("list_public_places")
    .abortSignal(AbortSignal.timeout(5000));
  if (error || !data) {
    throw new Error(
      `Local public RPC failed (HTTP ${status}). ${prerequisites}`,
    );
  }
  expect(data).toHaveLength(15);
  expect(data.map((place) => place.id).sort()).toEqual(
    Array.from(
      { length: 15 },
      (_, index) =>
        `6b633300-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ),
  );
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
  }
  expect(data).toContainEqual({
    id: "6b633300-0000-4000-8000-000000000001",
    name: "Lenexa City Center Library",
    city: "Lenexa",
    address: "8778 Penrose Ln, Lenexa, KS 66219",
    place_type: "library",
  } satisfies PublicPlace);
});

it("loads the same live RPC result through the production data layer", async () => {
  const { data, error } = await supabase
    .rpc("list_public_places")
    .abortSignal(AbortSignal.timeout(5000));
  expect(error).toBeNull();
  expect(data).toHaveLength(15);
  await expect(listPublicPlaces()).resolves.toEqual(data);
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
