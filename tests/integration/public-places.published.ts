/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { getLocalTestProject, type LocalTestProject } from "./local-project";

// The fixture is committed only to the loopback Supabase database and is removed
// after this suite. The test client itself always uses the anonymous key.
const batchId = randomUUID();
const ids = {
  unknown: randomUUID(),
  stale: randomUUID(),
  fresh: randomUUID(),
  dawn: randomUUID(),
  hidden: randomUUID(),
  legacy: randomUUID(),
};
let client: SupabaseClient<Database>;
let localProject: LocalTestProject;
let fixtureCommitted = false;
let hiddenPlaceId: string;
let unknownPlaceId: string;
let dawnPlaceId: string;
const summaryFields = [
  "address",
  "address_precision",
  "bathroom_available",
  "city",
  "drive_thru_available",
  "drive_thru_only",
  "food_beverage",
  "id",
  "kc3_last_verified_at",
  "kc3_verification_state",
  "name",
  "outlets",
  "phone_calls_allowed",
  "place_type",
  "regular_hours_available",
  "regular_hours_next_transition_at",
  "regular_hours_observed_at",
  "regular_hours_rule",
  "regular_hours_state",
  "wifi",
  "work_suitability",
].sort();
const detailFields = [
  ...summaryFields,
  "place_local_day_of_week",
  "regular_hours",
  "seating_notes",
].sort();

function localSql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      localProject.dbContainer,
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-f",
      "/dev/stdin",
    ],
    {
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    },
  );
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function hours(observedOn: string, ruleType: "weekly" | "dawn_to_dusk") {
  return {
    sourceUrl: "https://example.org/fixture-hours",
    observedOn,
    reuseBasis: "Permitted source",
    notes: "Independent disposable fixture evidence",
    ruleType,
    periods: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      openTime: ruleType === "weekly" ? "08:00" : null,
      closeTime: ruleType === "weekly" ? "21:00" : null,
      isClosed: ruleType === "dawn_to_dusk",
      closesNextDay: false,
    })),
  };
}

function reviewedRecord(
  overtureId: string,
  name: string,
  placeType: "cafe" | "park",
  status: "active" | "hidden",
  reviewedHours: ReturnType<typeof hours> | null,
) {
  return {
    overtureId,
    targetPlaceId: null,
    identity: {
      name,
      city: "Lenexa",
      address: "1 Fixture Way",
      placeType,
      status,
      addressPrecision: "street_address",
      latitude: 38.9,
      longitude: -94.7,
      timeZone: "America/Chicago",
      website: null,
      postcode: null,
    },
    identityEvidence: {
      sourceUrl: "https://example.org/fixture-identity",
      observedOn: new Date().toISOString().slice(0, 10),
      reuseBasis: "Overture license",
      notes: "",
    },
    source: {
      id: overtureId,
      sources: [{ dataset: "fixture", license: "CDLA-Permissive-2.0" }],
    },
    hours: reviewedHours,
  };
}

beforeAll(() => {
  try {
    localProject = getLocalTestProject();
  } catch {
    throw new Error(
      "Start disposable local Supabase before the published RPC integration suite",
    );
  }
  client = createClient<Database>(localProject.apiUrl, localProject.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = new Date();
  const staleDate = new Date(today.getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const currentDate = today.toISOString().slice(0, 10);
  const batch = {
    schemaVersion: 1,
    batchId,
    release: "2026-09-23.1",
    manifestSha256: "a".repeat(64),
    records: [
      reviewedRecord(
        ids.unknown,
        "HTTP Unknown fixture",
        "cafe",
        "active",
        null,
      ),
      reviewedRecord(
        ids.stale,
        "HTTP Stale fixture",
        "cafe",
        "active",
        hours(staleDate, "weekly"),
      ),
      reviewedRecord(
        ids.fresh,
        "HTTP Fresh fixture",
        "cafe",
        "active",
        hours(currentDate, "weekly"),
      ),
      reviewedRecord(
        ids.dawn,
        "HTTP Dawn fixture",
        "park",
        "active",
        hours(currentDate, "dawn_to_dusk"),
      ),
      reviewedRecord(ids.hidden, "HTTP Hidden fixture", "cafe", "hidden", null),
    ],
  };
  const sql = `begin;
insert into public.places (id, name, city, address, place_type)
values (${quote(ids.legacy)}::uuid, 'HTTP Google sentinel fixture', 'Lenexa', '9 Fixture Way', 'cafe');
select public.kc3_stage_overture_review(${quote(JSON.stringify(batch))}::jsonb);
set local role service_role;
${[ids.unknown, ids.stale, ids.fresh, ids.dawn, ids.hidden]
  .map(
    (id) =>
      `select public.kc3_publish_overture_place(${quote(batchId)}::uuid, ${quote(id)}::uuid,
null, null, true, true, 'Disposable municipality and duplicate review');`,
  )
  .join("\n")}
reset role;
update public.place_hours_eligibility_reviews set reviewed_revision = hours_revision
where place_id in (select place_id from public.place_publications
  where overture_id in (${quote(ids.fresh)}::uuid, ${quote(ids.stale)}::uuid));
insert into public.place_discoveries (
  place_id, source, verification_state, business_exists, currently_operating,
  publicly_accessible, hours_reviewed, amenities_reviewed, suitability_reviewed,
  is_third_space, last_verified_at, mvp_eligible
)
select place_id, 'overture', 'verified', true, true, true, true, true, true,
  true, current_date, true from public.place_publications
where overture_id in (${quote(ids.fresh)}::uuid, ${quote(ids.stale)}::uuid);
update public.places set mvp_published = true
where id in (select place_id from public.place_publications
  where overture_id in (${quote(ids.fresh)}::uuid, ${quote(ids.stale)}::uuid));
commit;`;
  try {
    localSql(sql);
    fixtureCommitted = true;
    hiddenPlaceId = localSql(`select place_id from public.place_publications
where overture_id = ${quote(ids.hidden)}::uuid;`).trim();
    unknownPlaceId = localSql(`select place_id from public.place_publications
where overture_id = ${quote(ids.unknown)}::uuid;`).trim();
    dawnPlaceId = localSql(`select place_id from public.place_publications
where overture_id = ${quote(ids.dawn)}::uuid;`).trim();
  } catch {
    throw new Error("Could not create disposable reviewed Overture fixtures");
  }
});

afterAll(() => {
  if (!fixtureCommitted) return;
  try {
    localSql(`begin;
create temp table cleanup_place_ids on commit drop as
  select place_id from public.place_publications where batch_id = ${quote(batchId)}::uuid;
delete from public.place_publications where batch_id = ${quote(batchId)}::uuid;
delete from public.places where id in (select place_id from cleanup_place_ids)
  or id = ${quote(ids.legacy)}::uuid;
delete from public.overture_review_batches where batch_id = ${quote(batchId)}::uuid;
commit;`);
  } catch {
    throw new Error("Disposable published RPC fixtures could not be removed");
  }
});

it("serves only active reviewed identities through anonymous list, summary and detail", async () => {
  const [list, summaries] = await Promise.all([
    client.rpc("list_public_places"),
    client.rpc("list_public_place_summaries"),
  ]);
  expect(list.error).toBeNull();
  expect(summaries.error).toBeNull();
  const names = ["HTTP Stale fixture", "HTTP Fresh fixture"];
  expect(
    list.data
      ?.filter((row) => names.includes(row.name))
      .map((row) => row.name)
      .sort(),
  ).toEqual([...names].sort());
  expect(
    summaries.data
      ?.filter((row) => names.includes(row.name))
      .map((row) => row.name)
      .sort(),
  ).toEqual([...names].sort());
  for (const row of list.data ?? []) {
    if (!names.includes(row.name)) continue;
    expect(Object.keys(row).sort()).toEqual([
      "address",
      "city",
      "id",
      "name",
      "place_type",
    ]);
  }
  expect(
    list.data?.some(
      (row) =>
        row.name.includes("Google sentinel") || row.name.includes("Hidden"),
    ),
  ).toBe(false);
  expect(
    summaries.data?.some(
      (row) =>
        row.name.includes("Google sentinel") || row.name.includes("Hidden"),
    ),
  ).toBe(false);
  expect(JSON.stringify(summaries.data)).not.toMatch(/google/i);
  for (const summary of summaries.data?.filter((row) =>
    names.includes(row.name),
  ) ?? []) {
    expect(Object.keys(summary).sort()).toEqual(summaryFields);
    const detail = await client.rpc("get_public_place_detail", {
      target_place_id: summary.id,
    });
    expect(detail.error).toBeNull();
    expect(detail.data).toHaveLength(1);
    expect(detail.data?.[0]).toMatchObject(summary);
    expect(Object.keys(detail.data![0]).sort()).toEqual(detailFields);
    expect(JSON.stringify(detail.data)).not.toMatch(/google/i);
  }
  for (const id of [ids.legacy, hiddenPlaceId, unknownPlaceId, dawnPlaceId]) {
    const detail = await client.rpc("get_public_place_detail", {
      target_place_id: id,
    });
    expect(detail.error).toBeNull();
    expect(detail.data).toEqual([]);
    const attribution = await client.rpc("get_public_place_attribution", {
      target_place_id: id,
    });
    expect(attribution.error).toBeNull();
    expect(attribution.data).toBeNull();
  }
});

it("keeps unknown and dawn-only places private while exposing stale hours honestly", async () => {
  const { data, error } = await client.rpc("list_public_place_summaries");
  expect(error).toBeNull();
  const byName = Object.fromEntries((data ?? []).map((row) => [row.name, row]));
  expect(byName["HTTP Unknown fixture"]).toBeUndefined();
  expect(byName["HTTP Dawn fixture"]).toBeUndefined();
  expect(byName["HTTP Stale fixture"]).toMatchObject({
    regular_hours_available: true,
    regular_hours_state: "unknown",
    regular_hours_rule: "weekly",
    regular_hours_next_transition_at: null,
  });
  expect(byName["HTTP Fresh fixture"]?.regular_hours_available).toBe(true);
  expect(byName["HTTP Fresh fixture"]?.regular_hours_state).not.toBe("unknown");
  expect(
    localSql(`select hours_state from public.kc3_regular_hours_status(
  ${quote(unknownPlaceId)}::uuid, now());`).trim(),
  ).toBe("unknown");
  expect(
    localSql(`select
    (select hours_state from public.kc3_regular_hours_status(
      ${quote(dawnPlaceId)}::uuid, bounds.opens_at + interval '1 minute'))::text
      || '|' ||
    (select hours_state from public.kc3_regular_hours_status(
      ${quote(dawnPlaceId)}::uuid, bounds.closes_at + interval '1 minute'))::text
  from public.kc3_dawn_to_dusk_bounds(${quote(dawnPlaceId)}::uuid, current_date) bounds;`).trim(),
  ).toBe("open|closed");
  const stale = await client.rpc("get_public_place_detail", {
    target_place_id: byName["HTTP Stale fixture"]!.id,
  });
  expect(stale.error).toBeNull();
  expect(stale.data?.[0]?.regular_hours).toHaveLength(7);
});

it("returns reviewed attribution and denies direct anonymous content access", async () => {
  const { data: summaries, error } = await client.rpc(
    "list_public_place_summaries",
  );
  expect(error).toBeNull();
  const fresh = summaries?.find((row) => row.name === "HTTP Fresh fixture");
  expect(fresh).toBeDefined();
  const attribution = await client.rpc("get_public_place_attribution", {
    target_place_id: fresh!.id,
  });
  expect(attribution.error).toBeNull();
  expect(Object.keys(attribution.data ?? {}).sort()).toEqual([
    "fieldSources",
    "hoursSourceUrl",
    "identityReviewedOn",
    "licenseUrl",
    "licenses",
    "source",
    "sourceUrl",
  ]);
  expect(attribution.data).toMatchObject({
    source: "Overture Maps",
    licenses: ["CDLA-Permissive-2.0"],
    hoursSourceUrl: "https://example.org/fixture-hours",
  });
  expect(JSON.stringify(attribution.data)).not.toMatch(/google/i);
  for (const table of [
    "places",
    "place_publications",
    "place_hours",
  ] as const) {
    const response = await client.from(table as never).select("*");
    expect(response.data).toBeNull();
    expect(response.error?.code).toBe("42501");
  }
});
