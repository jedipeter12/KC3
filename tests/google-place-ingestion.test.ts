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

  it("accepts untyped non-city address components while using a typed city", () => {
    const addressComponents = [
      { longText: "West 87th Street Parkway", languageCode: "en" },
      { longText: "Lenexa", types: ["locality", "political"] },
    ];
    const result = normalizeGooglePlaceResponse({
      ...googleFixture,
      addressComponents,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cityCandidate).toBe("Lenexa");
    expect(result.value.provider.addressComponents).toEqual(addressComponents);
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

  it("compares unchanged stored hours structurally rather than by JSON key order", () => {
    const result = normalizeGooglePlaceResponse(googleFixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const storedWithDatabaseKeyOrder = existingFixture.googleHours.map(
      (hour) => ({
        openTime: hour.openTime,
        isClosed: hour.isClosed,
        closeTime: hour.closeTime,
        dayOfWeek: hour.dayOfWeek,
        closesNextDay: hour.closesNextDay,
      }),
    );
    const plan = planGooglePlaceImport(
      result.value,
      "coffee_shop",
      "2026-09-20T12:00:00.000Z",
      [{ ...existingFixture, googleHours: storedWithDatabaseKeyOrder }],
    );

    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
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

  it("preserves normal hours during temporary closure and updates lifecycle state", () => {
    const result = normalizeGooglePlaceResponse({
      ...googleFixture,
      businessStatus: "CLOSED_TEMPORARILY",
      regularOpeningHours: { periods: [] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = planGooglePlaceImport(
      result.value,
      "coffee_shop",
      "2026-09-20T15:00:00.000Z",
      [existingFixture],
    );
    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
    expect(plan.payload.canonical.status).toBe("temporarily_closed");
    expect(plan.payload.hours).toBeUndefined();
  });

  it("stores an explicit closed schedule during permanent closure", () => {
    const result = normalizeGooglePlaceResponse({
      ...googleFixture,
      businessStatus: "CLOSED_PERMANENTLY",
      regularOpeningHours: { periods: [] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = planGooglePlaceImport(
      result.value,
      "coffee_shop",
      "2026-09-20T16:00:00.000Z",
      [existingFixture],
    );
    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
    expect(plan.payload.canonical.status).toBe("permanently_closed");
    expect(plan.payload.hours).toHaveLength(7);
    expect(plan.payload.hours?.every((hour) => hour.isClosed)).toBe(true);
  });

  it("never replaces a KC3-hidden lifecycle state", () => {
    const result = normalizeGooglePlaceResponse({
      ...googleFixture,
      businessStatus: "CLOSED_PERMANENTLY",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = planGooglePlaceImport(
      result.value,
      "coffee_shop",
      "2026-09-20T17:00:00.000Z",
      [{ ...existingFixture, status: "hidden" }],
    );
    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
    expect(plan.payload.canonical.status).toBeUndefined();
  });

  it("skips an incomplete new provider record before persistence", () => {
    const {
      location: _location,
      timeZone: _timeZone,
      ...incomplete
    } = googleFixture;
    const result = normalizeGooglePlaceResponse(incomplete);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      planGooglePlaceImport(
        result.value,
        "coffee_shop",
        "2026-09-20T18:00:00.000Z",
        [],
      ),
    ).toEqual({
      disposition: "skip",
      reason: "new place is missing coordinates, time zone",
    });
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

  it("plans an explicit seed attachment without replacing KC3 identity or type", () => {
    const result = normalizeGooglePlaceResponse(googleFixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const candidate = {
      ...existingFixture,
      googlePlaceId: null,
      placeType: "cafe" as const,
      latitude: null,
      longitude: null,
      timeZone: null,
    };

    const plan = planGooglePlaceImport(
      result.value,
      "coffee_shop",
      "2026-09-20T12:00:00.000Z",
      [candidate],
      { existingPlaceId: candidate.id },
    );

    expect(plan.disposition).toBe("write");
    if (plan.disposition !== "write") return;
    expect(plan.action).toBe("updated");
    expect(plan.payload.expectedPlaceId).toBe("kc3-1");
    expect(plan.payload.placeType).toBe("cafe");
    expect(plan.payload.canonical).toMatchObject({
      latitude: 38.95,
      longitude: -94.73,
      timeZone: "America/Chicago",
    });
    expect(plan.notices).toContain(
      "provider identity attached to an existing KC3 place",
    );
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

    await expect(client.discover("Lenexa", "coffee_shop", 3)).resolves.toEqual({
      places: [
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
      ],
      pagesFetched: 2,
      capped: false,
    });
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

  it("reports when a provider continuation is cut off by the page bound", async () => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            places: [{ id: "google-1" }],
            nextPageToken: "not-fetched",
          }),
          { status: 200 },
        ),
      );
    const client = new GooglePlacesClient("not-a-real-key", fetchMock);

    await expect(client.discover("Lenexa", "park", 1)).resolves.toMatchObject({
      pagesFetched: 1,
      capped: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
      discover: jest.fn().mockResolvedValue({
        places: [
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
        ],
        pagesFetched: 1,
        capped: false,
      }),
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

  it("reports an interrupted discovery without reading or writing database state", async () => {
    const provider = {
      discover: jest.fn().mockRejectedValue(new Error("interrupted-secret")),
      getDetails: jest.fn(),
    };
    const repository = {
      listExisting: jest.fn(),
      importPlace: jest.fn(),
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
      discovered: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
    });
    expect(summary.messages).toEqual([
      "Search failed for coffee_shop in Lenexa.",
    ]);
    expect(summary.messages.join(" ")).not.toContain("interrupted-secret");
    expect(repository.listExisting).not.toHaveBeenCalled();
    expect(repository.importPlace).not.toHaveBeenCalled();
  });
});
