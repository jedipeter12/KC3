import { supabase } from "../src/lib/supabase";
import {
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
});
