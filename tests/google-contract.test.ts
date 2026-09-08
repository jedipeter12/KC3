import {
  GOOGLE_PLACE_DETAILS_FIELD_MASK,
  classifyLocationChange,
  classifyTextChange,
  normalizeCosmeticText,
  normalizeGoogleRegularHours,
} from "../src/ingestion/googleContract";

describe("Google ingestion contract", () => {
  it("uses the approved minimal Place Details field mask", () => {
    expect(GOOGLE_PLACE_DETAILS_FIELD_MASK).toBe(
      "id,displayName.text,formattedAddress,addressComponents,location,businessStatus,primaryType,types,regularOpeningHours.periods,timeZone.id,movedPlaceId,googleMapsUri,rating,userRatingCount,websiteUri,priceLevel",
    );
    expect(GOOGLE_PLACE_DETAILS_FIELD_MASK).not.toContain("PhoneNumber");
    expect(GOOGLE_PLACE_DETAILS_FIELD_MASK).not.toContain("restroom");
    expect(GOOGLE_PLACE_DETAILS_FIELD_MASK).not.toContain("outdoorSeating");
  });

  it.each([
    ["Black-Dog Coffeehouse", "Black Dog Coffeehouse"],
    ["Beans and Leaves", "Beans & Leaves"],
    ["Homer’s Coffee House", "HOMER'S   COFFEE HOUSE"],
  ])("normalizes cosmetic spelling differences: %s", (first, second) => {
    expect(normalizeCosmeticText(first)).toBe(normalizeCosmeticText(second));
    expect(classifyTextChange(first, second)).toBe("cosmetic");
  });

  it("classifies missing, unchanged, and substantive text separately", () => {
    expect(classifyTextChange("Station 3 Coffee", undefined)).toBe("missing");
    expect(classifyTextChange("Station 3 Coffee", "Station 3 Coffee")).toBe(
      "unchanged",
    );
    expect(
      classifyTextChange("Station 3 Coffee", "Station 3 Coffee & Kitchen"),
    ).toBe("substantive");
  });

  it("screens material coordinate movement without treating normal jitter as a move", () => {
    const current = { latitude: 38.9536, longitude: -94.7336 };

    expect(classifyLocationChange(current, undefined)).toEqual({
      kind: "missing",
    });
    expect(classifyLocationChange(null, current)).toEqual({
      kind: "initialize",
    });
    expect(
      classifyLocationChange(current, {
        latitude: 38.9537,
        longitude: -94.7336,
      }).kind,
    ).toBe("unchanged");
    expect(
      classifyLocationChange(current, {
        latitude: 39.0997,
        longitude: -94.5786,
      }).kind,
    ).toBe("review");
  });

  it("preserves prior hours when regular hours are omitted", () => {
    expect(normalizeGoogleRegularHours(undefined)).toEqual({
      disposition: "preserve",
      reason: "missing",
    });
    expect(normalizeGoogleRegularHours({})).toEqual({
      disposition: "preserve",
      reason: "missing",
    });
  });

  it("does not replace normal hours with an empty schedule during temporary closure", () => {
    expect(
      normalizeGoogleRegularHours({ periods: [] }, "CLOSED_TEMPORARILY"),
    ).toEqual({
      disposition: "preserve",
      reason: "temporary_closure",
    });
  });

  it("represents an explicit empty regular schedule as seven closed days", () => {
    const result = normalizeGoogleRegularHours({ periods: [] }, "OPERATIONAL");

    expect(result.disposition).toBe("replace");
    if (result.disposition === "replace") {
      expect(result.rows).toHaveLength(7);
      expect(result.rows.every((row) => row.isClosed)).toBe(true);
    }
  });

  it("normalizes split intervals, overnight hours, and truly closed days", () => {
    const result = normalizeGoogleRegularHours({
      periods: [
        {
          open: { day: 1, hour: 8, minute: 0 },
          close: { day: 1, hour: 12, minute: 0 },
        },
        {
          open: { day: 1, hour: 13, minute: 0 },
          close: { day: 1, hour: 17, minute: 0 },
        },
        {
          open: { day: 5, hour: 18, minute: 0 },
          close: { day: 6, hour: 2, minute: 0 },
        },
      ],
    });

    expect(result.disposition).toBe("replace");
    if (result.disposition === "replace") {
      expect(
        result.rows.filter((row) => row.dayOfWeek === 1 && !row.isClosed),
      ).toHaveLength(2);
      expect(result.rows).toContainEqual({
        dayOfWeek: 5,
        openTime: "18:00",
        closeTime: "02:00",
        isClosed: false,
        closesNextDay: true,
      });
      expect(
        result.rows.some((row) => row.dayOfWeek === 6 && row.isClosed),
      ).toBe(false);
      expect(result.rows).toContainEqual({
        dayOfWeek: 0,
        openTime: null,
        closeTime: null,
        isClosed: true,
        closesNextDay: false,
      });
    }
  });

  it("expands Google's documented 24/7 sentinel into seven daily intervals", () => {
    const result = normalizeGoogleRegularHours({
      periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
    });

    expect(result.disposition).toBe("replace");
    if (result.disposition === "replace") {
      expect(result.rows).toHaveLength(7);
      expect(
        result.rows.every((row) => row.closesNextDay && !row.isClosed),
      ).toBe(true);
    }
  });

  it.each([
    ["missing close", { periods: [{ open: { day: 1, hour: 8, minute: 0 } }] }],
    [
      "invalid point",
      {
        periods: [
          {
            open: { day: 7, hour: 8, minute: 0 },
            close: { day: 1, hour: 17, minute: 0 },
          },
        ],
      },
    ],
    [
      "overlap",
      {
        periods: [
          {
            open: { day: 1, hour: 8, minute: 0 },
            close: { day: 1, hour: 12, minute: 0 },
          },
          {
            open: { day: 1, hour: 11, minute: 0 },
            close: { day: 1, hour: 13, minute: 0 },
          },
        ],
      },
    ],
  ])("rejects an incomplete or invalid schedule: %s", (_label, hours) => {
    expect(normalizeGoogleRegularHours(hours).disposition).toBe("reject");
  });
});
