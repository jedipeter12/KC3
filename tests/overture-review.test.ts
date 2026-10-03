import {
  compileReview,
  createManifest,
  draftRows,
  encodeCsv,
  decodeCsv,
  placeHeaders,
  parseDay,
  type ReviewManifest,
} from "../src/ingestion/overtureReview";

const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
function fixture(): ReviewManifest {
  return createManifest([
    {
      id,
      name: 'Coffee, "Tea"\nHouse',
      addresses: [
        { locality: "Lenexa", freeform: "1 Main St", postcode: "66219" },
      ],
      taxonomy: { primary: "coffee_shop" },
      confidence: 0.95,
      operating_status: "open",
      sources: [
        { dataset: "meta", license: "CDLA-Permissive-2.0", property: "" },
      ],
      latitude: 38.9,
      longitude: -94.7,
    },
  ]);
}
function ready() {
  const manifest = fixture();
  const rows = draftRows(manifest);
  rows.places[0]["Review status"] = "Ready";
  rows.places[0]["Identity reviewed on"] = "2026-10-02";
  return { manifest, ...rows };
}
test("keeps pending/incomplete and excluded rows out, with no unknown hours invented", () => {
  const manifest = fixture(),
    rows = draftRows(manifest);
  expect(
    compileReview(manifest, rows.places, rows.hours, "2026-10-02").records,
  ).toEqual([]);
  const r = ready();
  const batch = compileReview(r.manifest, r.places, r.hours, "2026-10-02");
  expect(batch.records[0].hours).toBeNull();
  expect(batch.records[0].identity.website).toBeNull();
  r.places[0]["Review status"] = "Exclude";
  expect(
    compileReview(r.manifest, r.places, r.hours, "2026-10-02").records,
  ).toEqual([]);
});
test("requires provenance/date and independent evidence for edited facts", () => {
  const r = ready();
  r.places[0]["Name"] = "New name";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("independent source");
  r.places[0]["Identity reuse basis"] = "Business supplied";
  r.places[0]["Identity source URL"] = "https://example.org/contact";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("notes");
  r.places[0]["Review notes"] =
    "Business confirmed supplied facts and permission to publish.";
  expect(
    compileReview(r.manifest, r.places, r.hours, "2026-10-02").records[0]
      .identity.name,
  ).toBe("New name");
  r.places[0]["Identity reviewed on"] = "2026-10-03";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("nonfuture");
});
test("rejects missing required identity, invalid coordinates, timezone, and duplicate rows", () => {
  const r = ready();
  r.places[0]["Address"] = "";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("Address");
  r.places[0]["Address"] = "1 Main St";
  r.places[0]["Latitude"] = "";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("latitude");
  r.places[0]["Latitude"] = "38.9";
  r.places[0]["Time zone"] = "Not/Azone";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("time zone");
  r.places[0]["Time zone"] = "America/Chicago";
  r.places.push({ ...r.places[0] });
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("duplicate");
});
test("requires every day and distinct hours provenance", () => {
  const r = ready();
  const h = r.hours[0];
  h["Hours status"] = "Ready";
  h["Hours source URL"] = "https://example.org/hours";
  h["Hours observed on"] = "2026-10-01";
  h["Hours reuse basis"] = "Business supplied";
  h["Hours notes"] = "Owner supplied schedule and authorized reuse.";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("Every day");
  for (const day of [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ])
    h[day] = "09:00-17:00";
  h.Sunday = "Closed";
  h.Monday = "09:00-12:00;13:00-17:00";
  const batch = compileReview(r.manifest, r.places, r.hours, "2026-10-02");
  expect(batch.records[0].hours?.periods).toHaveLength(8);
  expect(batch.records[0].hours?.observedOn).toBe("2026-10-01");
  r.places[0]["Review status"] = "Pending";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("Ready identity");
});

test("matches sorted hours by source ID and rejects case variants of the same KC3 target", () => {
  const manifest = fixture();
  const secondId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  manifest.records.push({
    ...manifest.records[0],
    id: secondId,
    name: "Second place",
  });
  const rows = draftRows(manifest);
  for (const row of rows.places) {
    row["Review status"] = "Ready";
    row["Identity reviewed on"] = "2026-10-02";
  }
  const h = rows.hours[1];
  Object.assign(h, {
    "Hours status": "Ready",
    "Hours source URL": "https://example.org/hours",
    "Hours observed on": "2026-10-02",
    "Hours reuse basis": "Business supplied",
    "Hours notes": "Owner supplied schedule and permission.",
  });
  for (const day of [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ])
    h[day] = "Closed";
  rows.hours.reverse();
  const batch = compileReview(manifest, rows.places, rows.hours, "2026-10-02");
  expect(batch.records.find((r) => r.overtureId === id)?.hours).toBeNull();
  expect(
    batch.records.find((r) => r.overtureId === secondId)?.hours?.periods,
  ).toHaveLength(7);
  rows.places[0]["KC3 place ID"] = id;
  rows.places[1]["KC3 place ID"] = id.toUpperCase();
  expect(() =>
    compileReview(manifest, rows.places, rows.hours, "2026-10-02"),
  ).toThrow("duplicated KC3 target");
});
test("rejects overlaps within a day and across the Saturday/Sunday boundary", () => {
  expect(parseDay("22:00-02:00+1", 6)[0].closesNextDay).toBe(true);
  expect(() => parseDay("22:00-02:00", 6)).toThrow("ambiguous");
  expect(() => parseDay("09:00-12:00;11:00-13:00", 0)).toThrow("Overlapping");
  const r = ready(),
    h = r.hours[0];
  Object.assign(h, {
    "Hours status": "Ready",
    "Hours source URL": "https://example.org/hours",
    "Hours observed on": "2026-10-02",
    "Hours reuse basis": "Permitted source",
    "Hours notes": "Publication reuse confirmed by operator.",
  });
  for (const day of [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ])
    h[day] = "Closed";
  h.Saturday = "22:00-02:00+1";
  h.Sunday = "01:00-03:00";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("boundaries");
});
test("CSV survives quotes, multiline names, BOM and XLSX instruction rows, but rejects malformed input", () => {
  const rows = draftRows(fixture()).places;
  const text = encodeCsv(placeHeaders, rows);
  expect(decodeCsv(`\uFEFFTitle\r\n\r\n${text}`, placeHeaders)).toEqual(rows);
  expect(() =>
    decodeCsv('Review status,Name\nPending,"unclosed', placeHeaders),
  ).toThrow("Unclosed");
  expect(() =>
    decodeCsv(text.replace("Review status", "Status"), placeHeaders),
  ).toThrow("header");
});
test("review batches are repeatable and source license changes cannot be hidden", () => {
  const r = ready();
  expect(compileReview(r.manifest, r.places, r.hours, "2026-10-02")).toEqual(
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  );
  r.manifest.records[0].sources[0].license = "unreviewed";
  expect(() =>
    compileReview(r.manifest, r.places, r.hours, "2026-10-02"),
  ).toThrow("license");
});

test("unknown lifecycle cannot default to an active Ready place", () => {
  const manifest = fixture();
  manifest.records[0].operatingStatus = null;
  const rows = draftRows(manifest);
  expect(rows.places[0]["Place status"]).toBe("");
  rows.places[0]["Review status"] = "Ready";
  rows.places[0]["Identity reviewed on"] = "2026-10-02";
  expect(() =>
    compileReview(manifest, rows.places, rows.hours, "2026-10-02"),
  ).toThrow("Place status");
  rows.places[0]["Place status"] = "active";
  expect(() =>
    compileReview(manifest, rows.places, rows.hours, "2026-10-02"),
  ).toThrow("independent source");
});
