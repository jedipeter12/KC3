import type { PublicPlace } from "../src/types/database";

type ExpectedPublicPlace = {
  address: string;
  city: string;
  id: string;
  name: string;
  place_type:
    "coffee_shop" | "cafe" | "boba_tea" | "library" | "coworking" | "park";
};

type TypesAreEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

describe("public place database type", () => {
  it("contains exactly the five approved RPC fields", () => {
    const contractIsExact: TypesAreEqual<PublicPlace, ExpectedPublicPlace> =
      true;
    const place: PublicPlace = {
      address: "123 Main St",
      city: "Olathe",
      id: "00000000-0000-0000-0000-000000000001",
      name: "Example Place",
      place_type: "coffee_shop",
    };

    expect(Object.keys(place).sort()).toEqual([
      "address",
      "city",
      "id",
      "name",
      "place_type",
    ]);
    expect(contractIsExact).toBe(true);
  });
});
