import { GOOGLE_PLACE_DETAILS_FIELD_MASK } from "./googleContract";

export const GOOGLE_TEXT_SEARCH_FIELD_MASK = "places.id,nextPageToken";
export const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";

export const MVP_CITIES = ["Lenexa", "Overland Park", "Olathe"] as const;
export const MVP_PLACE_CATEGORIES = [
  "coffee_shop",
  "cafe",
  "boba_tea",
  "library",
  "coworking",
  "park",
] as const;

export type MvpCity = (typeof MVP_CITIES)[number];
export type MvpPlaceCategory = (typeof MVP_PLACE_CATEGORIES)[number];

const categoryQueries: Record<
  MvpPlaceCategory,
  { text: string; googleType: string }
> = {
  coffee_shop: { text: "coffee shop", googleType: "coffee_shop" },
  cafe: { text: "cafe", googleType: "cafe" },
  boba_tea: { text: "boba tea", googleType: "tea_house" },
  library: { text: "library", googleType: "library" },
  coworking: { text: "coworking space", googleType: "coworking_space" },
  park: { text: "park", googleType: "park" },
};

type Fetch = typeof fetch;

export type DiscoveredPlaceId = Readonly<{
  googlePlaceId: string;
  city: MvpCity;
  category: MvpPlaceCategory;
}>;

export type GoogleDiscoveryResult = Readonly<{
  places: readonly DiscoveredPlaceId[];
  pagesFetched: number;
  capped: boolean;
}>;

export class GooglePlacesProviderError extends Error {
  constructor(
    readonly operation: "search" | "details",
    readonly status?: number,
  ) {
    super(
      `Google Places ${operation} failed${status ? ` (HTTP ${status})` : ""}.`,
    );
    this.name = "GooglePlacesProviderError";
  }
}

export class GooglePlacesClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImplementation: Fetch = fetch,
    private readonly baseUrl = GOOGLE_PLACES_BASE_URL,
  ) {}

  async discover(
    city: MvpCity,
    category: MvpPlaceCategory,
    maxPages: number,
  ): Promise<GoogleDiscoveryResult> {
    const discovered: DiscoveredPlaceId[] = [];
    let pageToken: string | undefined;
    let pagesFetched = 0;
    let capped = false;

    for (let page = 0; page < maxPages; page += 1) {
      const categoryQuery = categoryQueries[category];
      const body: Record<string, unknown> = {
        textQuery: `${categoryQuery.text} in ${city}, Kansas`,
        includedType: categoryQuery.googleType,
        strictTypeFiltering: true,
        pageSize: 20,
      };
      if (pageToken) {
        body.pageToken = pageToken;
      }

      const response = await this.request(
        `${this.baseUrl}/places:searchText`,
        "search",
        {
          method: "POST",
          headers: this.headers(GOOGLE_TEXT_SEARCH_FIELD_MASK),
          body: JSON.stringify(body),
        },
      );
      if (!isRecord(response)) {
        throw new GooglePlacesProviderError("search");
      }
      pagesFetched += 1;

      const places = response.places;
      if (places != null && !Array.isArray(places)) {
        throw new GooglePlacesProviderError("search");
      }
      for (const place of places ?? []) {
        if (
          isRecord(place) &&
          typeof place.id === "string" &&
          place.id.trim()
        ) {
          discovered.push({
            googlePlaceId: place.id.trim(),
            city,
            category,
          });
        }
      }

      if (response.nextPageToken == null || response.nextPageToken === "") {
        break;
      }
      if (typeof response.nextPageToken !== "string") {
        throw new GooglePlacesProviderError("search");
      }
      if (page + 1 >= maxPages) {
        capped = true;
        break;
      }
      pageToken = response.nextPageToken;
    }

    return { places: discovered, pagesFetched, capped };
  }

  async getDetails(googlePlaceId: string): Promise<unknown> {
    return this.request(
      `${this.baseUrl}/places/${encodeURIComponent(googlePlaceId)}`,
      "details",
      { headers: this.headers(GOOGLE_PLACE_DETAILS_FIELD_MASK) },
    );
  }

  private headers(fieldMask: string): HeadersInit {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Goog-Api-Key": this.apiKey,
      "X-Goog-FieldMask": fieldMask,
    };
  }

  private async request(
    url: string,
    operation: "search" | "details",
    init: RequestInit,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        ...init,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new GooglePlacesProviderError(operation);
    }

    if (!response.ok) {
      throw new GooglePlacesProviderError(operation, response.status);
    }

    try {
      return await response.json();
    } catch {
      throw new GooglePlacesProviderError(operation, response.status);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
