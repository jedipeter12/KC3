import {
  buildMapsUrl,
  formatHoursRows,
  getCompactKc3Summary,
  getHoursStatus,
} from "../src/features/places/placePresentation";
import { makePlaceSummary } from "./place-fixtures";

describe("place presentation", () => {
  it("keeps unavailable, stale, and continuous-open states distinct", () => {
    expect(getHoursStatus(makePlaceSummary())).toBe("Hours unavailable");
    expect(
      getHoursStatus(
        makePlaceSummary({
          regular_hours_available: true,
          regular_hours_observed_at: "2026-09-01T12:00:00Z",
          regular_hours_state: "unknown",
        }),
        new Date("2026-09-22T12:00:01Z"),
      ),
    ).toContain("Hours may have changed · Last checked");
    expect(
      getHoursStatus(
        makePlaceSummary({
          regular_hours_available: true,
          regular_hours_observed_at: "2026-09-22T12:00:00Z",
          regular_hours_state: "open",
        }),
        new Date("2026-09-22T12:00:00Z"),
      ),
    ).toBe("Open 24 hours");
  });

  it("formats split, overnight, closed, and 24-hour schedule rows", () => {
    expect(
      formatHoursRows([
        {
          close_time: "12:00",
          closes_next_day: false,
          day_of_week: 1,
          is_closed: false,
          open_time: "08:00",
        },
        {
          close_time: "02:00",
          closes_next_day: true,
          day_of_week: 1,
          is_closed: false,
          open_time: "18:00",
        },
      ]),
    ).toBe("8:00 AM–12:00 PM, 6:00 PM–2:00 AM next day");
    expect(
      formatHoursRows([
        {
          close_time: null,
          closes_next_day: false,
          day_of_week: 2,
          is_closed: true,
          open_time: null,
        },
      ]),
    ).toBe("Closed");
    expect(
      formatHoursRows([
        {
          close_time: "00:00",
          closes_next_day: true,
          day_of_week: 3,
          is_closed: false,
          open_time: "00:00",
        },
      ]),
    ).toBe("Open 24 hours");
  });

  it("limits compact KC3 copy to work plus two ordered positives", () => {
    expect(
      getCompactKc3Summary(
        makePlaceSummary({
          food_beverage: "full",
          outlets: "many",
          wifi: "public",
          work_suitability: "good",
        }),
      ),
    ).toEqual(["Good for working", "Public Wi-Fi", "Many outlets"]);
  });

  it("builds an encoded map search without provider identifiers", () => {
    const url = buildMapsUrl(
      makePlaceSummary({
        address: "1 Main St & Oak Ave",
        city: "Olathe",
        name: "KC3 Place",
      }),
    );
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=KC3%20Place%2C%201%20Main%20St%20%26%20Oak%20Ave",
    );
    expect(url).not.toContain("google_place_id");
  });

  it("builds an Apple Maps URL for the native iOS handoff", () => {
    const url = buildMapsUrl(
      makePlaceSummary({
        address: "670 N Central St, Olathe, KS 66061",
        city: "Olathe",
        name: "Apogee Coffee & Draft",
      }),
      "apple",
    );

    expect(url).toBe(
      "https://maps.apple.com/?q=Apogee%20Coffee%20%26%20Draft%2C%20670%20N%20Central%20St%2C%20Olathe%2C%20KS%2066061",
    );
  });
});
