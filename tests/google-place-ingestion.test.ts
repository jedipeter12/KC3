import { getGoogleIngestionConfig } from "../src/config/googleIngestion";
import {
  normalizeGooglePlaceResponse,
  planGooglePlaceImport,
  type ExistingGooglePlace,
} from "../src/ingestion/googlePlaceIngestion";
import { runGoogleImport } from "../src/ingestion/googleImportRunner";
import {
  GOOGLE_TEXT_SEARCH_FIELD_MASK,
  GooglePlacesClient,
} from "../src/ingestion/googlePlacesProvider";
import { GOOGLE_PLACE_DETAILS_FIELD_MASK } from "../src/ingestion/googleContract";

const googleFixture = {
  id: "google-1",
  displayName: { text: "Fixture Coffee" },
  formattedAddress: "123 Main St, Lenexa, KS 66215, USA",
  addressComponents: [
    { longText: "Johnson County", types: ["administrative_area_level_3"] },
    { longText: "Lenexa", types: ["locality", "political"] },
  ],
  location: { latitude: 38.95, longitude: -94.73 },
  businessStatus: "OPERATIONAL",
  primaryType: "coffee_shop",
  types: ["coffee_shop", "cafe"],
  regularOpeningHours: {
    periods: [
      {
        open: { day: 1, hour: 8, minute: 0 },
        close: { day: 1, hour: 17, minute: 0 },
      },
    ],
  },
  timeZone: { id: "America/Chicago" },
  googleMapsUri: "https://maps.google.com/example",
  rating: 4.6,
  userRatingCount: 50,
  websiteUri: "https://example.com",
  priceLevel: "PRICE_LEVEL_INEXPENSIVE",
};

const existingFixture: ExistingGooglePlace = {
  id: "kc3-1",
  name: "Fixture Coffee",
  city: "Lenexa",
  address: "123 Main St, Lenexa, KS 66215, USA",
  placeType: "coffee_shop",
  googlePlaceId: "google-1",
  latitude: 38.95,
  longitude: -94.73,
  timeZone: "America/Chicago",
  status: "active",
  googleBusinessStatus: "OPERATIONAL",
  googleHours: [
    {
      dayOfWeek: 1,
      openTime: "08:00",
      closeTime: "17:00",
      isClosed: false,
      closesNextDay: false,
    },
    ...Array.from({ length: 6 }, (_, index) => {
      const dayOfWeek = index === 0 ? 0 : index + 1;
      return {
        dayOfWeek,
        openTime: null,
        closeTime: null,
        isClosed: true,
        closesNextDay: false,
      };
    }).sort((first, second) => first.dayOfWeek - second.dayOfWeek),
  ].sort((first, second) => first.dayOfWeek - second.dayOfWeek),
};

describe("Google place response transformation", () => {
  it("maps only KC3-24 fields and extracts city by component type priority", () => {
    const result = normalizeGooglePlaceResponse(googleFixture, "google-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cityCandidate).toBe("Lenexa");
    expect(result.value.provider).toEqual({
      name: "Fixture Coffee",
      address: "123 Main St, Lenexa, KS 66215, USA",
      addressComponents: googleFixture.addressComponents,
      latitude: 38.95,
      longitude: -94.73,
      businessStatus: "OPERATIONAL",
      primaryType: "coffee_shop",
      types: ["coffee_shop", "cafe"],
      timeZone: "America/Chicago",
      mapsUri: "https://maps.google.com/example",
      rating: 4.6,
      userRatingCount: 50,
      websiteUri: "https://example.com",
      priceLevel: "PRICE_LEVEL_INEXPENSIVE",
    });
    expect(result.value.hours.disposition).toBe("replace");
  });

  it.each([
    ["wrong id", { ...googleFixture, id: "different" }],
    [
      "partial coordinates",
      { ...googleFixture, location: { latitude: 38.95 } },
    ],
    ["unknown enum", { ...googleFixture, businessStatus: "UNKNOWN" }],
    [
      "malformed hours",
      { ...googleFixture, regularOpeningHours: { periods: [{}] } },
    ],
  ])("rejects a malformed record: %s", (_label, value) => {
    expect(normalizeGooglePlaceResponse(value, "google-1").ok).toBe(false);
  });

  it("preserves canonical values on substantive provider text changes", () => {
    const result = normalizeGooglePlaceResponse({
      ...googleFixture,
      displayName: { text: "Fixture Coffee and Kitchen" },
      formattedAddress: "999 New Name Ave, Lenexa, KS 66215, USA",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = planGooglePlaceImport(
      result.value,
      "cafe",
      "2026-09-08T12:00:00.000Z",
      [existingFixture],
    );
    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
    expect(plan.payload.canonical.name).toBeUndefined();
    expect(plan.payload.canonical.address).toBeUndefined();
    expect(plan.payload.provider.name).toBe("Fixture Coffee and Kitchen");
    expect(plan.payload.placeType).toBe("coffee_shop");
    expect(plan.notices).toEqual([
      "substantive name change",
      "substantive address change",
    ]);
  });

  it("plans an exact repeat without rewriting canonical facts or unchanged hours", () => {
    const result = normalizeGooglePlaceResponse(googleFixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = planGooglePlaceImport(
      result.value,
      "coffee_shop",
      "2026-09-08T12:00:00.000Z",
      [existingFixture],
    );
    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
    expect(plan.action).toBe("updated");
    expect(plan.payload.canonical).toEqual({});
    expect(plan.payload.hours).toBeUndefined();
  });

  it("includes a complete changed schedule in the atomic import payload", () => {
    const result = normalizeGooglePlaceResponse({
      ...googleFixture,
      regularOpeningHours: {
        periods: [
          {
            open: { day: 2, hour: 7, minute: 30 },
            close: { day: 2, hour: 15, minute: 0 },
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = planGooglePlaceImport(
      result.value,
      "coffee_shop",
      "2026-09-08T13:00:00.000Z",
      [existingFixture],
    );
    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
    expect(plan.payload.fetchedAt).toBe("2026-09-08T13:00:00.000Z");
    expect(plan.payload.hours).toHaveLength(7);
    expect(plan.payload.hours).toContainEqual({
      dayOfWeek: 2,
      openTime: "07:30",
      closeTime: "15:00",
      isClosed: false,
      closesNextDay: false,
    });
  });

  it("preserves stored hours when the provider omits regular hours", () => {
    const { regularOpeningHours: _omitted, ...withoutHours } = googleFixture;
    const result = normalizeGooglePlaceResponse(withoutHours);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = planGooglePlaceImport(
      result.value,
      "coffee_shop",
      "2026-09-08T14:00:00.000Z",
      [existingFixture],
    );
    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
    expect(plan.payload.fetchedAt).toBe("2026-09-08T14:00:00.000Z");
    expect(plan.payload.hours).toBeUndefined();
  });

  it("reports a possible canonical duplicate instead of attaching by name", () => {
    const result = normalizeGooglePlaceResponse(googleFixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const candidate = { ...existingFixture, googlePlaceId: null };

    expect(
      planGooglePlaceImport(
        result.value,
        "coffee_shop",
        "2026-09-08T12:00:00.000Z",
        [candidate],
      ),
    ).toEqual({
      disposition: "skip",
      reason:
        "possible duplicate of KC3 place kc3-1; attach or create requires explicit resolution",
    });

    expect(
      planGooglePlaceImport(
        result.value,
        "coffee_shop",
        "2026-09-08T12:00:00.000Z",
        [{ ...candidate, latitude: null, longitude: null }],
      ).disposition,
    ).toBe("skip");
  });
});

describe("Google provider paging and field masks", () => {
  it("follows continuation tokens without broadening either field mask", async () => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            places: [{ id: "google-1" }],
            nextPageToken: "next",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ places: [{ id: "google-2" }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(googleFixture), { status: 200 }),
      );
    const client = new GooglePlacesClient("not-a-real-key", fetchMock);

    await expect(client.discover("Lenexa", "coffee_shop", 3)).resolves.toEqual([
      { googlePlaceId: "google-1", city: "Lenexa", category: "coffee_shop" },
      { googlePlaceId: "google-2", city: "Lenexa", category: "coffee_shop" },
    ]);
    const firstSearch = fetchMock.mock.calls[0][1]!;
    const secondSearch = fetchMock.mock.calls[1][1]!;
    expect(new Headers(firstSearch.headers).get("X-Goog-FieldMask")).toBe(
      GOOGLE_TEXT_SEARCH_FIELD_MASK,
    );
    expect(JSON.parse(firstSearch.body as string)).toEqual({
      textQuery: "coffee shop in Lenexa, Kansas",
      includedType: "coffee_shop",
      strictTypeFiltering: true,
      pageSize: 20,
    });
    expect(JSON.parse(secondSearch.body as string)).toEqual({
      textQuery: "coffee shop in Lenexa, Kansas",
      includedType: "coffee_shop",
      strictTypeFiltering: true,
      pageSize: 20,
      pageToken: "next",
    });

    await client.getDetails("google-1");
    expect(
      new Headers(fetchMock.mock.calls[2][1]?.headers).get("X-Goog-FieldMask"),
    ).toBe(GOOGLE_PLACE_DETAILS_FIELD_MASK);
  });
});

describe("operator configuration and run failures", () => {
  it("requires only non-public server/operator variables and never echoes values", () => {
    expect(() =>
      getGoogleIngestionConfig({ GOOGLE_PLACES_API_KEY: "secret-value" }),
    ).toThrow(
      "Missing server-only ingestion configuration: KC3_SUPABASE_URL, KC3_SUPABASE_SERVICE_ROLE_KEY.",
    );
    try {
      getGoogleIngestionConfig({ GOOGLE_PLACES_API_KEY: "secret-value" });
    } catch (error) {
      expect(String(error)).not.toContain("secret-value");
    }
  });

  it("reports provider and database failures without leaking their errors", async () => {
    const provider = {
      discover: jest.fn().mockResolvedValue([
        {
          googlePlaceId: "google-1",
          city: "Lenexa",
          category: "coffee_shop",
        },
        {
          googlePlaceId: "google-2",
          city: "Lenexa",
          category: "coffee_shop",
        },
      ]),
      getDetails: jest
        .fn()
        .mockResolvedValueOnce(googleFixture)
        .mockRejectedValueOnce(new Error("provider-secret")),
    };
    const repository = {
      listExisting: jest.fn().mockResolvedValue([]),
      importPlace: jest.fn().mockRejectedValue(new Error("database-secret")),
    };

    const summary = await runGoogleImport(
      {
        cities: ["Lenexa"],
        categories: ["coffee_shop"],
        maxPages: 1,
        maxPlaces: 10,
        write: true,
      },
      provider,
      repository,
    );

    expect(summary).toMatchObject({
      discovered: 2,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 2,
    });
    expect(summary.messages.join(" ")).toContain("Database write failed");
    expect(summary.messages.join(" ")).toContain("Details failed");
    expect(summary.messages.join(" ")).not.toMatch(
      /provider-secret|database-secret/,
    );
  });
});
