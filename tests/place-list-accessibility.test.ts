import { focusFilterModalEntry } from "../src/features/places/PlaceListScreen";

jest.mock("../src/data/publicPlaces", () => ({
  getPublicPlaceDetail: jest.fn(),
  listPublicPlaceSummaries: jest.fn(),
  PUBLIC_PLACE_DETAILS_ERROR_MESSAGE:
    "We couldn't load place details right now. Please try again.",
  PUBLIC_PLACES_ERROR_MESSAGE:
    "We couldn't load places right now. Please try again.",
}));

describe("place-list accessibility", () => {
  it("focuses the filter-dialog entry control on Web and native", () => {
    const webFocus = jest.fn();
    focusFilterModalEntry({ focus: webFocus } as never, "web");
    expect(webFocus).toHaveBeenCalledTimes(1);

    const setNativeFocus = jest.fn();
    focusFilterModalEntry({} as never, "ios", () => 42, setNativeFocus);
    expect(setNativeFocus).toHaveBeenCalledWith(42);
  });
});
