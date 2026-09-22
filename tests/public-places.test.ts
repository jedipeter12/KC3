import { supabase } from "../src/lib/supabase";
import {
  getPublicPlaceDetail,
  listPublicPlaceSummaries,
  listPublicPlaces,
  PUBLIC_PLACES_ERROR_CODE,
  PUBLIC_PLACES_ERROR_MESSAGE,
} from "../src/data/publicPlaces";

jest.mock("../src/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockRpc = supabase.rpc as jest.Mock;

const summaryFixture = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Fixture Place",
  city: "Lenexa",
  address: "1 Main St",
  address_precision: "street_address",
  place_type: "coffee_shop",
  regular_hours_available: true,
  regular_hours_state: "open",
  regular_hours_next_transition_at: "2026-09-21T22:00:00+00:00",
  regular_hours_observed_at: "2026-09-21T12:00:00+00:00",
  outlets: "many",
  wifi: "public",
  work_suitability: "good",
  food_beverage: "light",
  phone_calls_allowed: true,
  bathroom_available: false,
  drive_thru_available: true,
  drive_thru_only: false,
  kc3_last_verified_at: "2026-09-21",
  kc3_verification_state: "current",
};

describe("public place data layer", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("calls the public RPC and preserves its ordering and exact projection", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "00000000-0000-0000-0000-000000000002",
          name: "Second Place",
          city: "Olathe",
          address: "2 Main St",
          place_type: "library",
          unexpected_provider_field: "must not escape",
        },
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "First Place",
          city: "Lenexa",
          address: "1 Main St",
          place_type: "coffee_shop",
        },
      ],
      error: null,
    });

    await expect(listPublicPlaces()).resolves.toEqual([
      {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Second Place",
        city: "Olathe",
        address: "2 Main St",
        place_type: "library",
      },
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "First Place",
        city: "Lenexa",
        address: "1 Main St",
        place_type: "coffee_shop",
      },
    ]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("list_public_places");
  });

  it("returns an empty array for a successful empty response", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await expect(listPublicPlaces()).resolves.toEqual([]);
  });

  it("sanitizes provider errors", async () => {
    const providerDetails = "database credential and internal relation name";
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: providerDetails },
    });

    const request = listPublicPlaces();

    await expect(request).rejects.toMatchObject({
      code: PUBLIC_PLACES_ERROR_CODE,
      message: PUBLIC_PLACES_ERROR_MESSAGE,
      name: "PublicPlacesError",
    });
    await request.catch((error: unknown) => {
      expect(String(error)).not.toContain(providerDetails);
    });
  });

  it.each([
    ["null data", null],
    ["a non-array response", {}],
    ["a malformed place", [{ id: "missing-approved-fields" }]],
  ])("sanitizes %s", async (_description, data) => {
    mockRpc.mockResolvedValue({ data, error: null });

    await expect(listPublicPlaces()).rejects.toMatchObject({
      code: PUBLIC_PLACES_ERROR_CODE,
      message: PUBLIC_PLACES_ERROR_MESSAGE,
    });
  });

  it("sanitizes rejected provider requests", async () => {
    const providerDetails = "fetch failed for a private endpoint";
    mockRpc.mockRejectedValue(new Error(providerDetails));

    const request = listPublicPlaces();

    await expect(request).rejects.toMatchObject({
      code: PUBLIC_PLACES_ERROR_CODE,
      message: PUBLIC_PLACES_ERROR_MESSAGE,
    });
    await request.catch((error: unknown) => {
      expect(String(error)).not.toContain(providerDetails);
    });
  });

  it("validates and narrows the expanded summary projection", async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...summaryFixture, google_place_id: "must not escape" }],
      error: null,
    });

    await expect(listPublicPlaceSummaries()).resolves.toEqual([summaryFixture]);
    expect(mockRpc).toHaveBeenCalledWith("list_public_place_summaries");
  });

  it("loads a detail with normalized weekly rows", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          ...summaryFixture,
          seating_notes: "Tables near the windows",
          regular_hours: [
            {
              day_of_week: 0,
              open_time: "08:00",
              close_time: "17:00",
              is_closed: false,
              closes_next_day: false,
              source: "must not escape",
            },
            {
              day_of_week: 1,
              open_time: null,
              close_time: null,
              is_closed: true,
              closes_next_day: false,
            },
          ],
        },
      ],
      error: null,
    });

    await expect(getPublicPlaceDetail(summaryFixture.id)).resolves.toEqual({
      ...summaryFixture,
      seating_notes: "Tables near the windows",
      regular_hours: [
        {
          day_of_week: 0,
          open_time: "08:00",
          close_time: "17:00",
          is_closed: false,
          closes_next_day: false,
        },
        {
          day_of_week: 1,
          open_time: null,
          close_time: null,
          is_closed: true,
          closes_next_day: false,
        },
      ],
    });
    expect(mockRpc).toHaveBeenCalledWith("get_public_place_detail", {
      target_place_id: summaryFixture.id,
    });
  });

  it("returns null when a detail ID is unavailable", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await expect(getPublicPlaceDetail("missing")).resolves.toBeNull();
  });

  it.each([
    [
      "an invalid drive-thru combination",
      [
        {
          ...summaryFixture,
          drive_thru_available: false,
          drive_thru_only: true,
        },
      ],
      listPublicPlaceSummaries,
    ],
    [
      "a missing nullable summary field",
      [
        Object.fromEntries(
          Object.entries(summaryFixture).filter(
            ([key]) => key !== "kc3_last_verified_at",
          ),
        ),
      ],
      listPublicPlaceSummaries,
    ],
    [
      "a malformed detail schedule",
      [
        {
          ...summaryFixture,
          seating_notes: null,
          regular_hours: [
            {
              day_of_week: 7,
              open_time: "08:00",
              close_time: "17:00",
              is_closed: false,
              closes_next_day: false,
            },
          ],
        },
      ],
      () => getPublicPlaceDetail(summaryFixture.id),
    ],
  ])("sanitizes %s", async (_description, data, request) => {
    mockRpc.mockResolvedValue({ data, error: null });

    await expect(request()).rejects.toMatchObject({
      code: PUBLIC_PLACES_ERROR_CODE,
      message: PUBLIC_PLACES_ERROR_MESSAGE,
    });
  });
});
