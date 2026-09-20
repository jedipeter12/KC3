import type { PlaceType } from "../types/database";
import { normalizeCosmeticText } from "./googleContract";
import {
  normalizeGooglePlaceResponse,
  planGooglePlaceImport,
  type ExistingGooglePlace,
  type GoogleImportPayload,
} from "./googlePlaceIngestion";
import type {
  DiscoveredPlaceId,
  MvpCity,
  MvpPlaceCategory,
} from "./googlePlacesProvider";

export type GoogleImportOptions = Readonly<{
  cities: readonly MvpCity[];
  categories: readonly MvpPlaceCategory[];
  maxPages: number;
  maxPlaces: number;
  write: boolean;
}>;

export type GoogleImportSummary = {
  discovered: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  messages: string[];
};

export type GooglePlacesProvider = {
  discover(
    city: MvpCity,
    category: MvpPlaceCategory,
    maxPages: number,
  ): Promise<DiscoveredPlaceId[]>;
  getDetails(googlePlaceId: string): Promise<unknown>;
};

export type GoogleImportRepository = {
  listExisting(): Promise<ExistingGooglePlace[]>;
  importPlace(
    payload: GoogleImportPayload,
  ): Promise<{ placeId: string; action: "inserted" | "updated" }>;
};

export async function runGoogleImport(
  options: GoogleImportOptions,
  provider: GooglePlacesProvider,
  repository: GoogleImportRepository,
  now: () => Date = () => new Date(),
): Promise<GoogleImportSummary> {
  const summary: GoogleImportSummary = {
    discovered: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    messages: [],
  };
  const discoveries = new Map<string, DiscoveredPlaceId>();

  for (const city of options.cities) {
    for (const category of options.categories) {
      if (discoveries.size >= options.maxPlaces) break;
      try {
        const results = await provider.discover(
          city,
          category,
          options.maxPages,
        );
        for (const result of results) {
          if (discoveries.size >= options.maxPlaces) break;
          discoveries.set(
            result.googlePlaceId,
            discoveries.get(result.googlePlaceId) ?? result,
          );
        }
      } catch {
        summary.failed += 1;
        summary.messages.push(`Search failed for ${category} in ${city}.`);
      }
    }
  }
  summary.discovered = discoveries.size;
  if (discoveries.size === 0) return summary;

  let existingPlaces: ExistingGooglePlace[];
  try {
    existingPlaces = await repository.listExisting();
  } catch {
    summary.failed += discoveries.size || 1;
    summary.messages.push(
      "Database state could not be read; no records were written.",
    );
    return summary;
  }

  for (const discovery of discoveries.values()) {
    let rawDetails: unknown;
    try {
      rawDetails = await provider.getDetails(discovery.googlePlaceId);
    } catch {
      summary.failed += 1;
      summary.messages.push(
        `Details failed for Google place ${discovery.googlePlaceId}.`,
      );
      continue;
    }

    const normalized = normalizeGooglePlaceResponse(
      rawDetails,
      discovery.googlePlaceId,
    );
    if (!normalized.ok) {
      summary.skipped += 1;
      summary.messages.push(
        `Skipped Google place ${discovery.googlePlaceId}: ${normalized.reason}.`,
      );
      continue;
    }

    const existing = existingPlaces.find(
      (place) => place.googlePlaceId === discovery.googlePlaceId,
    );
    const effectiveCity = normalized.value.cityCandidate ?? existing?.city;
    if (
      !effectiveCity ||
      normalizeCosmeticText(effectiveCity) !==
        normalizeCosmeticText(discovery.city)
    ) {
      summary.skipped += 1;
      summary.messages.push(
        `Skipped Google place ${discovery.googlePlaceId}: outside the requested city boundary.`,
      );
      continue;
    }

    const plan = planGooglePlaceImport(
      normalized.value,
      discovery.category as PlaceType,
      now().toISOString(),
      existingPlaces,
    );
    if (plan.disposition === "skip") {
      summary.skipped += 1;
      summary.messages.push(
        `Skipped Google place ${discovery.googlePlaceId}: ${plan.reason}.`,
      );
      continue;
    }

    if (options.write) {
      try {
        const result = await repository.importPlace(plan.payload);
        summary[result.action] += 1;
        if (result.action === "inserted") {
          existingPlaces.push(toExistingPlace(plan.payload, result.placeId));
        }
      } catch {
        summary.failed += 1;
        summary.messages.push(
          `Database write failed for Google place ${discovery.googlePlaceId}.`,
        );
        continue;
      }
    } else {
      summary[plan.action] += 1;
      if (plan.action === "inserted") {
        existingPlaces.push(
          toExistingPlace(plan.payload, `dry-run:${discovery.googlePlaceId}`),
        );
      }
    }

    for (const notice of plan.notices) {
      summary.messages.push(
        `Review Google place ${discovery.googlePlaceId}: ${notice}.`,
      );
    }
  }

  return summary;
}

function toExistingPlace(
  payload: GoogleImportPayload,
  placeId: string,
): ExistingGooglePlace {
  return {
    id: placeId,
    name: payload.canonical.name!,
    city: payload.canonical.city!,
    address: payload.canonical.address!,
    placeType: payload.placeType,
    googlePlaceId: payload.googlePlaceId,
    latitude: payload.canonical.latitude ?? null,
    longitude: payload.canonical.longitude ?? null,
    timeZone: payload.canonical.timeZone ?? null,
    status: payload.canonical.status ?? "active",
    googleBusinessStatus: payload.provider.businessStatus ?? null,
    googleHours: payload.hours ? [...payload.hours] : [],
  };
}
