import { createHash } from "node:crypto";

export const OVERTURE_RELEASE = "2026-09-23.1";
export const OVERTURE_URL =
  "https://docs.overturemaps.org/getting-data/duckdb/";
const cities = ["Lenexa", "Overland Park", "Olathe"] as const;
const types = [
  "coffee_shop",
  "cafe",
  "boba_tea",
  "library",
  "coworking",
  "park",
];
const licenses = new Set(["CDLA-Permissive-2.0", "Apache-2.0", "CC0-1.0"]);
const mapping: Record<string, string> = {
  coffee_shop: "coffee_shop",
  cafe: "cafe",
  bubble_tea_shop: "boba_tea",
  tea_room: "boba_tea",
  library: "library",
  coworking_space: "coworking",
  park: "park",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SourceRecord = {
  id: string;
  name: string;
  city: string;
  address: string;
  postcode: string;
  website: string;
  latitude: number;
  longitude: number;
  category: string;
  placeType: string;
  confidence: number | null;
  operatingStatus: string | null;
  sources: {
    dataset: string;
    license: string;
    property: string;
    recordId: string | null;
    updateTime: string | null;
  }[];
};
export type ReviewManifest = {
  schemaVersion: 1;
  release: string;
  records: SourceRecord[];
};
export type ReviewRow = Record<string, string>;
export type Evidence = {
  sourceUrl: string;
  observedOn: string;
  reuseBasis: string;
  notes: string;
};
export type HourPeriod = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  closesNextDay: boolean;
};
export type ReviewedRecord = {
  overtureId: string;
  targetPlaceId: string | null;
  identity: {
    name: string;
    city: string;
    address: string;
    postcode: string | null;
    website: string | null;
    placeType: string;
    addressPrecision: string;
    latitude: number;
    longitude: number;
    timeZone: string;
    status: string;
  };
  identityEvidence: Evidence;
  source: SourceRecord;
  hours: (Evidence & { periods: HourPeriod[] }) | null;
};
export type ReviewBatch = {
  schemaVersion: 1;
  batchId: string;
  release: string;
  manifestSha256: string;
  records: ReviewedRecord[];
};

export const placeHeaders = [
  "Review status",
  "Name",
  "City",
  "Place type",
  "Address",
  "Postcode",
  "Website",
  "Latitude",
  "Longitude",
  "Address precision",
  "Time zone",
  "Initial verification flags",
  "Missing values",
  "Provider operating status",
  "Existence confidence",
  "KC3 place ID",
  "Identity source URL",
  "Identity reviewed on",
  "Identity reuse basis",
  "Review notes",
  "Place status",
  "Overture ID",
];
export const hourHeaders = [
  "Hours status",
  "Name",
  "City",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Hours source URL",
  "Hours observed on",
  "Hours reuse basis",
  "Hours notes",
  "Overture ID",
];

export function createManifest(input: unknown): ReviewManifest {
  if (!Array.isArray(input))
    throw new Error("Regional input must be an array.");
  const records: SourceRecord[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object")
      throw new Error("Malformed regional record.");
    const first = item.addresses?.[0];
    const city = cities.find(
      (c) =>
        c.toLowerCase() ===
        String(first?.locality ?? "")
          .trim()
          .toLowerCase(),
    );
    const category = item.taxonomy?.primary;
    if (!city || !Object.hasOwn(mapping, category)) continue;
    if (
      !uuid.test(item.id) ||
      typeof item.name !== "string" ||
      !Array.isArray(item.sources) ||
      item.sources.length === 0
    )
      throw new Error("Missing source identity or provenance.");
    const sources = item.sources.map((s: Record<string, unknown>) => {
      if (typeof s.dataset !== "string" || !licenses.has(String(s.license)))
        throw new Error(
          "Unknown contributor/license. Review before exporting.",
        );
      return {
        dataset: s.dataset,
        license: String(s.license),
        property: String(s.property ?? ""),
        recordId: s.record_id == null ? null : String(s.record_id),
        updateTime: s.update_time == null ? null : String(s.update_time),
      };
    });
    const latitude = coordinate(String(item.latitude), "latitude");
    const longitude = coordinate(String(item.longitude), "longitude");
    if (
      item.confidence != null &&
      (typeof item.confidence !== "number" ||
        item.confidence < 0 ||
        item.confidence > 1)
    )
      throw new Error("Invalid existence confidence.");
    records.push({
      id: item.id,
      name: item.name,
      city,
      address: first?.freeform ?? "",
      postcode: first?.postcode ?? "",
      website: item.websites?.[0] ?? "",
      latitude,
      longitude,
      category,
      placeType: mapping[category],
      confidence: item.confidence ?? null,
      operatingStatus: item.operating_status ?? null,
      sources,
    });
  }
  records.sort(
    (a, b) =>
      a.city.localeCompare(b.city) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  if (new Set(records.map((r) => r.id)).size !== records.length)
    throw new Error("Duplicate external identity.");
  return { schemaVersion: 1, release: OVERTURE_RELEASE, records };
}

export function draftRows(manifest: ReviewManifest) {
  const nameStreet = (r: SourceRecord) =>
    `${r.city}:${r.name.toLowerCase().replace(/[^a-z0-9]/g, "")}:${r.address.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const counts = new Map<string, number>();
  for (const r of manifest.records)
    counts.set(nameStreet(r), (counts.get(nameStreet(r)) ?? 0) + 1);
  const places = manifest.records.map((r) => {
    const warnings = ["Confirm city boundary and category/access"];
    if (r.operatingStatus !== "open")
      warnings.push(
        r.operatingStatus
          ? `Provider marks ${r.operatingStatus}`
          : "Operating status unknown",
      );
    if (r.confidence == null || r.confidence < 0.75)
      warnings.push("Low or missing existence confidence");
    if ((counts.get(nameStreet(r)) ?? 0) > 1)
      warnings.push("Possible duplicate name/address");
    if (r.placeType === "library")
      warnings.push(
        "Confirm public library, not school/parking/business label",
      );
    if (r.placeType === "coworking")
      warnings.push("Confirm coworking identity and visitor access");
    if (/lackman library/i.test(r.name))
      warnings.push(
        "Old branch replaced by Lenexa City Center; verify lifecycle",
      );
    if (/sar.ko.par/i.test(r.name))
      warnings.push("Entrance/address differs from original seed");
    if (/oak park/i.test(r.name))
      warnings.push("Street suffix and same-address alias need review");
    const missing = [
      !r.address && "Address",
      !r.postcode && "Postcode (optional)",
      !r.website && "Website (optional)",
      !sourceStatus(r.operatingStatus) && "Place status",
      "Hours",
      "Identity review date",
    ].filter(Boolean);
    return Object.fromEntries(
      placeHeaders.map((h, i) => [
        h,
        [
          "Pending",
          r.name,
          r.city,
          r.placeType,
          r.address,
          r.postcode,
          r.website,
          String(r.latitude),
          String(r.longitude),
          "unknown",
          "America/Chicago",
          warnings.join("; "),
          missing.join("; "),
          r.operatingStatus ?? "",
          r.confidence == null ? "" : String(r.confidence),
          "",
          OVERTURE_URL,
          "",
          "Overture license",
          "",
          sourceStatus(r.operatingStatus),
          r.id,
        ][i],
      ]),
    ) as ReviewRow;
  });
  const hours = manifest.records.map(
    (r) =>
      Object.fromEntries(
        hourHeaders.map((h, i) => [
          h,
          [
            "Pending",
            r.name,
            r.city,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            r.id,
          ][i],
        ]),
      ) as ReviewRow,
  );
  return { places, hours };
}

export function compileReview(
  manifest: ReviewManifest,
  places: ReviewRow[],
  hours: ReviewRow[],
  today: string,
): ReviewBatch {
  assertDate(today, today);
  if (manifest.schemaVersion !== 1 || manifest.release !== OVERTURE_RELEASE)
    throw new Error("Unsupported manifest version/release.");
  const originals = new Map(manifest.records.map((r) => [r.id, r]));
  if (originals.size !== manifest.records.length)
    throw new Error("Duplicate manifest identity.");
  const reviewed: ReviewedRecord[] = [];
  const seen = new Set<string>();
  const targets = new Set<string>();
  for (const row of places) {
    const id = row["Overture ID"];
    const source = originals.get(id);
    if (!source || seen.has(id))
      throw new Error("Unknown or duplicate place identity.");
    seen.add(id);
    status(row["Review status"]);
    if (row["Review status"] !== "Ready") continue;
    if (
      !source.sources.length ||
      source.sources.some((s) => !licenses.has(s.license))
    )
      throw new Error("Unapproved source license.");
    const identity = {
      name: required(row["Name"], "Name"),
      city: required(row["City"], "City"),
      address: required(row["Address"], "Address"),
      postcode: row["Postcode"]?.trim() || null,
      website: row["Website"]?.trim() || null,
      placeType: required(row["Place type"], "Place type"),
      addressPrecision: required(row["Address precision"], "Address precision"),
      latitude: coordinate(row["Latitude"], "latitude"),
      longitude: coordinate(row["Longitude"], "longitude"),
      timeZone: required(row["Time zone"], "Time zone"),
      status: required(row["Place status"], "Place status"),
    };
    if (
      !cities.includes(identity.city as (typeof cities)[number]) ||
      !types.includes(identity.placeType) ||
      ![
        "active",
        "temporarily_closed",
        "permanently_closed",
        "hidden",
      ].includes(identity.status) ||
      !["unknown", "approximate", "street_address"].includes(
        identity.addressPrecision,
      )
    )
      throw new Error("Unapproved city/type/address precision.");
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: identity.timeZone });
    } catch {
      throw new Error("Invalid IANA time zone.");
    }
    if (identity.website) {
      const url = new URL(identity.website);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Invalid website URL.");
    }
    const evidence = makeEvidence(
      row,
      "Identity source URL",
      "Identity reviewed on",
      "Identity reuse basis",
      "Review notes",
      today,
      true,
    );
    const changed =
      identity.name !== source.name ||
      identity.city !== source.city ||
      identity.address !== source.address ||
      identity.placeType !== source.placeType ||
      (identity.postcode ?? "") !== source.postcode ||
      (identity.website ?? "") !== source.website ||
      Math.abs(identity.latitude - source.latitude) > 1e-9 ||
      Math.abs(identity.longitude - source.longitude) > 1e-9 ||
      identity.addressPrecision !== "unknown" ||
      identity.timeZone !== "America/Chicago" ||
      identity.status !== sourceStatus(source.operatingStatus);
    if (changed && evidence.reuseBasis === "Overture license")
      throw new Error(
        "Changed facts need independent source evidence and a reuse basis.",
      );
    const targetPlaceId = row["KC3 place ID"]?.trim() || null;
    if (
      targetPlaceId &&
      (!uuid.test(targetPlaceId) || targets.has(targetPlaceId.toLowerCase()))
    )
      throw new Error("Invalid or duplicated KC3 target ID.");
    if (targetPlaceId) targets.add(targetPlaceId.toLowerCase());
    reviewed.push({
      overtureId: id,
      targetPlaceId,
      identity,
      identityEvidence: evidence,
      source,
      hours: null,
    });
  }
  const byId = new Map(reviewed.map((r) => [r.overtureId, r]));
  const seenHours = new Set<string>();
  for (const row of hours) {
    const id = row["Overture ID"];
    if (!originals.has(id) || seenHours.has(id))
      throw new Error("Unknown or duplicate hours identity.");
    seenHours.add(id);
    status(row["Hours status"]);
    if (row["Hours status"] !== "Ready") continue;
    const place = byId.get(id);
    if (!place)
      throw new Error(
        "Ready hours require a Ready identity in the same batch.",
      );
    const evidence = makeEvidence(
      row,
      "Hours source URL",
      "Hours observed on",
      "Hours reuse basis",
      "Hours notes",
      today,
      false,
    );
    const periods = hourHeaders
      .slice(3, 10)
      .flatMap((day, index) => parseDay(row[day], index));
    const intervals = periods
      .filter((p) => !p.isClosed)
      .map((p) => ({
        start: p.dayOfWeek * 1440 + minutes(p.openTime!),
        end:
          p.dayOfWeek * 1440 +
          minutes(p.closeTime!) +
          (p.closesNextDay ? 1440 : 0),
      }));
    const repeated = [
      ...intervals,
      ...intervals.map((p) => ({ start: p.start + 10080, end: p.end + 10080 })),
    ].sort((a, b) => a.start - b.start);
    if (repeated.some((p, i) => i > 0 && p.start < repeated[i - 1].end))
      throw new Error("Schedule overlaps across day/week boundaries.");
    place.hours = { ...evidence, periods };
  }
  reviewed.sort((a, b) => a.overtureId.localeCompare(b.overtureId));
  const manifestSha256 = digest(manifest);
  const hash = digest({
    release: manifest.release,
    manifestSha256,
    records: reviewed,
  });
  const batchId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  return {
    schemaVersion: 1,
    batchId,
    release: manifest.release,
    manifestSha256,
    records: reviewed,
  };
}

export function parseDay(value: string, dayOfWeek: number): HourPeriod[] {
  const text = required(value, "Every day of a Ready schedule");
  if (text === "Closed")
    return [
      {
        dayOfWeek,
        openTime: null,
        closeTime: null,
        isClosed: true,
        closesNextDay: false,
      },
    ];
  if (text === "24h")
    return [
      {
        dayOfWeek,
        openTime: "00:00",
        closeTime: "00:00",
        isClosed: false,
        closesNextDay: true,
      },
    ];
  const intervals = text
    .split(";")
    .map((part) => {
      const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})(\+1)?$/.exec(part.trim());
      if (!match)
        throw new Error("Use HH:MM-HH:MM, +1 for overnight, Closed, or 24h.");
      const open = minutes(match[1]),
        close = minutes(match[2]);
      const end = close + (match[3] ? 1440 : 0);
      if (end <= open || end - open > 1440)
        throw new Error("Invalid or ambiguous hours interval.");
      return {
        start: open,
        end,
        period: {
          dayOfWeek,
          openTime: match[1],
          closeTime: match[2],
          isClosed: false,
          closesNextDay: !!match[3],
        },
      };
    })
    .sort((a, b) => a.start - b.start);
  if (intervals.some((r, i) => i > 0 && r.start < intervals[i - 1].end))
    throw new Error("Overlapping hours intervals.");
  return intervals.map((r) => r.period);
}

export function encodeCsv(headers: string[], rows: ReviewRow[]): string {
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return (
    [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ""))]
      .map((row) => row.map(escape).join(","))
      .join("\r\n") + "\r\n"
  );
}

export function decodeCsv(text: string, headers: string[]): ReviewRow[] {
  const grid: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    endedQuote = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        endedQuote = true;
      } else value += c;
    } else if (c === '"') {
      if (value || endedQuote) throw new Error("Malformed CSV quote.");
      quoted = true;
    } else if (c === ",") {
      row.push(value);
      value = "";
      endedQuote = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      grid.push(row);
      row = [];
      value = "";
      endedQuote = false;
    } else {
      if (endedQuote) throw new Error("Unexpected text after CSV quote.");
      value += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (row.length || value || endedQuote) {
    row.push(value);
    grid.push(row);
  }
  const headerIndex = grid.findIndex((r, i) => i < 20 && r[0] === headers[0]);
  if (headerIndex < 0)
    throw new Error("Expected review table header not found.");
  const actual = grid[headerIndex];
  // XLSX exports may include trailing empty columns from the notes area.
  while (actual.at(-1) === "") actual.pop();
  if (
    actual.length !== headers.length ||
    actual.some((h, i) => h !== headers[i])
  )
    throw new Error("Review columns were changed or reordered.");
  return grid
    .slice(headerIndex + 1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      while (r.length > headers.length && r.at(-1) === "") r.pop();
      if (r.length !== headers.length)
        throw new Error("CSV row has an incorrect column count.");
      return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
    });
}

function makeEvidence(
  row: ReviewRow,
  url: string,
  date: string,
  basis: string,
  notes: string,
  today: string,
  allowOverture: boolean,
): Evidence {
  const sourceUrl = required(row[url], url);
  https(sourceUrl);
  const observedOn = required(row[date], date);
  assertDate(observedOn, today);
  const reuseBasis = required(row[basis], basis);
  const allowed = allowOverture
    ? ["Overture license", "Business supplied", "Permitted source"]
    : ["Business supplied", "Permitted source"];
  if (!allowed.includes(reuseBasis))
    throw new Error("Unsupported evidence reuse basis.");
  if (reuseBasis === "Overture license" && sourceUrl !== OVERTURE_URL)
    throw new Error("Overture evidence must reference the manifest's source.");
  const evidenceNotes = row[notes]?.trim() ?? "";
  if (reuseBasis !== "Overture license" && !evidenceNotes)
    throw new Error(
      "Explain the independent source and permission basis in notes.",
    );
  return { sourceUrl, observedOn, reuseBasis, notes: evidenceNotes };
}
function required(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`Missing ${label}.`);
  return value.trim();
}
function status(value: string) {
  if (!["Pending", "Ready", "Exclude"].includes(value))
    throw new Error("Invalid review status.");
}
function coordinate(value: string, axis: string): number {
  if (!value?.trim()) throw new Error(`Missing ${axis}.`);
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > (axis === "latitude" ? 90 : 180))
    throw new Error(`Invalid ${axis}.`);
  return n;
}
function https(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid HTTPS source URL.");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTPS URL without credentials.");
}
function assertDate(value: string, today: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value ||
    value > today
  )
    throw new Error("Use a real, nonfuture YYYY-MM-DD date.");
}
function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) throw new Error("Invalid clock time.");
  return h * 60 + m;
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sourceStatus(operatingStatus: string | null): string {
  if (operatingStatus === "open") return "active";
  if (
    ["temporarily_closed", "permanently_closed"].includes(operatingStatus ?? "")
  )
    return operatingStatus!;
  return "";
}
