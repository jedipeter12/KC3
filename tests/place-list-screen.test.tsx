import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo, Platform } from "react-native";

import { PlaceListScreen } from "../src/features/places/PlaceListScreen";
import type { PublicPlaceSummary } from "../src/types/database";
import { makePlaceDetail, makePlaceSummary } from "./place-fixtures";

jest.mock("../src/data/publicPlaces", () => ({
  getPublicPlaceDetail: jest.fn(),
  listPublicPlaceSummaries: jest.fn(),
  PUBLIC_PLACE_DETAILS_ERROR_MESSAGE:
    "We couldn't load place details right now. Please try again.",
  PUBLIC_PLACES_ERROR_MESSAGE:
    "We couldn't load places right now. Please try again.",
}));

const PLACES: PublicPlaceSummary[] = [
  makePlaceSummary({
    address: "2 Main St",
    city: "Olathe",
    id: "00000000-0000-0000-0000-000000000002",
    name: "Second Place",
    place_type: "library",
    regular_hours_available: true,
    regular_hours_observed_at: new Date().toISOString(),
    regular_hours_state: "open",
    wifi: "public",
    work_suitability: "good",
  }),
  makePlaceSummary(),
  makePlaceSummary({
    drive_thru_available: true,
    drive_thru_only: true,
    id: "00000000-0000-0000-0000-000000000003",
    name: "Drive-through Place",
  }),
];

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("place-list screen", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders compact summary cards and hides drive-thru-only places by default", async () => {
    await render(<PlaceListScreen loadPlaces={async () => PLACES} />);
    await screen.findByText("Second Place");
    const rows = screen.getAllByTestId(/^place-row-/);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Open 24 hours")).toBeOnTheScreen();
    expect(within(rows[0]).getByText("Good for working")).toBeOnTheScreen();
    expect(within(rows[0]).getByText("Public Wi-Fi")).toBeOnTheScreen();
    expect(
      within(rows[1]).getByText("KC3 details not yet verified"),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Drive-through Place")).not.toBeOnTheScreen();
  });

  it("keeps search immediate while mobile filter changes wait for Apply", async () => {
    const loadPlaces = jest.fn(async () => PLACES);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    const search = await screen.findByLabelText("Search places by name");
    await fireEvent.changeText(search, " second ");
    expect(screen.getAllByTestId(/^place-row-/)).toHaveLength(1);

    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("button", { name: "Lenexa" }));
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("Second Place")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("button", { name: "Lenexa" }));
    await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("No matching places")).toBeOnTheScreen();
    expect(loadPlaces).toHaveBeenCalledTimes(1);
  });

  it("can include verified drive-thru-only places and apply attribute filters", async () => {
    await render(<PlaceListScreen loadPlaces={async () => PLACES} />);
    await screen.findByText("Second Place");
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Hide drive-thru-only places" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Drive-thru available" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getAllByTestId(/^place-row-/)).toHaveLength(1);
    expect(screen.getByText("Drive-through Place")).toBeOnTheScreen();
  });

  it("isolates the Web filter dialog and closes it with Escape", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    await render(<PlaceListScreen loadPlaces={async () => PLACES} />);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Filters" }),
    );
    const dialog = screen.getByLabelText("Filters");
    expect(dialog).toHaveProp("aria-modal", true);
    await fireEvent(dialog, "keyDown", { nativeEvent: { key: "Escape" } });
    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Filters" })).toBeOnTheScreen();
  });

  it("opens details and returns with applied list state intact", async () => {
    const loadPlaceDetail = jest.fn(async (placeId: string) =>
      makePlaceDetail({
        ...PLACES[0],
        id: placeId,
        regular_hours: [
          {
            close_time: "17:00",
            closes_next_day: false,
            day_of_week: 1,
            is_closed: false,
            open_time: "08:00",
          },
        ],
        seating_notes: "Tables near the windows",
      }),
    );
    await render(
      <PlaceListScreen
        loadPlaceDetail={loadPlaceDetail}
        loadPlaces={async () => PLACES}
      />,
    );
    const search = await screen.findByLabelText("Search places by name");
    await fireEvent.changeText(search, "second");
    await fireEvent.press(
      within(screen.getByTestId(`place-row-${PLACES[0].id}`)).getByRole("link"),
    );
    expect(await screen.findByText("Good to know")).toBeOnTheScreen();
    expect(screen.getByText("Tables near the windows")).toBeOnTheScreen();
    expect(screen.getByText("Regular hours")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "‹ Places" }));
    expect(await screen.findByLabelText("Search places by name")).toHaveProp(
      "value",
      "second",
    );
    expect(loadPlaceDetail).toHaveBeenCalledWith(PLACES[0].id);
  });

  it("keeps cached identity visible during a detail failure and retries", async () => {
    const loadPlaceDetail = jest
      .fn()
      .mockRejectedValueOnce(new Error("private failure"))
      .mockResolvedValueOnce(makePlaceDetail(PLACES[0]));
    await render(
      <PlaceListScreen
        loadPlaceDetail={loadPlaceDetail}
        loadPlaces={async () => PLACES}
      />,
    );
    await fireEvent.press(
      within(await screen.findByTestId(`place-row-${PLACES[0].id}`)).getByRole(
        "link",
      ),
    );
    expect(
      await screen.findByText("Place details are unavailable"),
    ).toBeOnTheScreen();
    expect(screen.getByText("Second Place")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Good to know")).toBeOnTheScreen();
  });

  it("announces list request states on iOS", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});
    const initial = deferred<PublicPlaceSummary[]>();
    const retry = deferred<PublicPlaceSummary[]>();
    const loadPlaces = jest
      .fn<Promise<PublicPlaceSummary[]>, []>()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(retry.promise);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    expect(announce).toHaveBeenLastCalledWith("Finding places…");
    await act(async () => initial.reject(new Error("private detail")));
    expect(announce).toHaveBeenLastCalledWith(
      "Places are unavailable. We couldn't load places right now. Please try again.",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await act(async () => retry.resolve(PLACES));
    expect(announce).toHaveBeenCalledWith("3 places loaded");
  });

  it("distinguishes database-empty, no-match, and sanitized error states", async () => {
    const { unmount } = await render(
      <PlaceListScreen loadPlaces={async () => []} />,
    );
    expect(await screen.findByText("No places yet")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Check back soon as we add more Lenexa, Overland Park, and Olathe third places.",
      ),
    ).toBeOnTheScreen();
    unmount();

    await render(
      <PlaceListScreen
        loadPlaces={async () => {
          throw new Error("private endpoint and relation");
        }}
      />,
    );
    expect(await screen.findByText("Places are unavailable")).toBeOnTheScreen();
    expect(
      screen.queryByText("private endpoint and relation"),
    ).not.toBeOnTheScreen();
  });
});
