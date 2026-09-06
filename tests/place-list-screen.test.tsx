import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo, Platform } from "react-native";

import { PlaceListScreen } from "../src/features/places/PlaceListScreen";
import type { PublicPlace } from "../src/types/database";

jest.mock("../src/data/publicPlaces", () => ({
  listPublicPlaces: jest.fn(),
  PUBLIC_PLACES_ERROR_MESSAGE:
    "We couldn't load places right now. Please try again.",
}));

const PLACES: PublicPlace[] = [
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

  it("exposes pressed filter states and list items on Web", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    await render(<PlaceListScreen loadPlaces={async () => PLACES} />);
    const allCities = await screen.findByRole("button", { name: "All cities" });
    expect(allCities).toHaveProp("aria-pressed", true);
    const olathe = screen.getByRole("button", { name: "Olathe" });
    expect(olathe).toHaveProp("aria-pressed", false);
    await fireEvent.press(olathe);
    expect(screen.getByRole("button", { name: "Olathe" })).toHaveProp(
      "aria-pressed",
      true,
    );
    expect(screen.getByRole("button", { name: "All cities" })).toHaveProp(
      "aria-pressed",
      false,
    );
    expect(screen.getByTestId(`place-row-${PLACES[0].id}`)).toHaveProp(
      "role",
      "listitem",
    );
  });

  it("announces pending, failed, retrying, and recovered requests on iOS", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});
    const initial = deferred<PublicPlace[]>();
    const retry = deferred<PublicPlace[]>();
    const loadPlaces = jest
      .fn<Promise<PublicPlace[]>, []>()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(retry.promise);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    expect(announce).toHaveBeenLastCalledWith("Finding places…");
    await act(async () => initial.reject(new Error("private provider detail")));
    expect(announce).toHaveBeenLastCalledWith(
      "Places are unavailable. We couldn't load places right now. Please try again.",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(announce).toHaveBeenLastCalledWith("Finding places…");
    await act(async () => retry.resolve(PLACES));
    expect(announce).toHaveBeenLastCalledWith("2 places loaded");
  });

  it("shows an intentional loading state while the request is pending", async () => {
    const request = deferred<PublicPlace[]>();

    await render(<PlaceListScreen loadPlaces={() => request.promise} />);

    expect(screen.getByText("Finding places…")).toBeOnTheScreen();
  });

  it("renders every visible field in the returned order", async () => {
    await render(<PlaceListScreen loadPlaces={async () => PLACES} />);

    await screen.findByText("Second Place");
    const rows = screen.getAllByTestId(/^place-row-/);

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Second Place")).toBeOnTheScreen();
    expect(within(rows[0]).getByText("Olathe")).toBeOnTheScreen();
    expect(within(rows[0]).getByText("2 Main St")).toBeOnTheScreen();
    expect(within(rows[0]).getByText("Library")).toBeOnTheScreen();
    expect(within(rows[1]).getByText("First Place")).toBeOnTheScreen();
    expect(within(rows[1]).getByText("Lenexa")).toBeOnTheScreen();
    expect(within(rows[1]).getByText("1 Main St")).toBeOnTheScreen();
    expect(within(rows[1]).getByText("Coffee shop")).toBeOnTheScreen();
  });

  it("derives city and place-type controls from loaded records", async () => {
    await render(<PlaceListScreen loadPlaces={async () => PLACES} />);

    expect(
      await screen.findByLabelText("Search places by name"),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "All cities" }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Olathe" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Lenexa" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Library" })).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Coffee shop" }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: "Park" }),
    ).not.toBeOnTheScreen();
  });

  it("matches mixed-case names and applies each filter independently", async () => {
    const places: PublicPlace[] = [
      { ...PLACES[0], name: "Central Library" },
      { ...PLACES[1], name: "Central Coffee", city: "Olathe" },
      { ...PLACES[0], id: "third", name: "Central West", city: "Lenexa" },
      { ...PLACES[0], id: "fourth", name: "South Library" },
    ];
    const loadPlaces = jest
      .fn<Promise<PublicPlace[]>, []>()
      .mockResolvedValue(places);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    const search = await screen.findByLabelText("Search places by name");
    const rowNames = () =>
      screen
        .getAllByTestId(/^place-row-/)
        .map((row) => within(row).getByRole("header").props.children);

    await fireEvent.changeText(search, "  cEnTrAl  ");
    expect(rowNames()).toEqual([
      "Central Library",
      "Central Coffee",
      "Central West",
    ]);
    await fireEvent.press(screen.getByRole("button", { name: "Olathe" }));
    expect(rowNames()).toEqual(["Central Library", "Central Coffee"]);
    await fireEvent.press(screen.getByRole("button", { name: "Library" }));
    expect(rowNames()).toEqual(["Central Library"]);
    expect(
      screen.getByRole("button", { name: "Olathe", selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Library", selected: true }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "All cities" }));
    expect(rowNames()).toEqual(["Central Library", "Central West"]);
    await fireEvent.press(screen.getByRole("button", { name: "All types" }));
    expect(rowNames()).toEqual([
      "Central Library",
      "Central Coffee",
      "Central West",
    ]);
    await fireEvent.changeText(search, "   ");
    expect(rowNames()).toEqual(places.map((place) => place.name));
    expect(loadPlaces).toHaveBeenCalledTimes(1);
  });

  it("does not display IDs or unapproved fields on an expanded runtime record", async () => {
    const expandedPlace = {
      ...PLACES[0],
      google_place_id: "private-google-id",
      status: "active",
      seating_notes: "private-curation-note",
      hours: "private-hours",
      google_data: { raw_payload: "private-google-payload" },
    };
    await render(<PlaceListScreen loadPlaces={async () => [expandedPlace]} />);
    await screen.findByText(expandedPlace.name);
    const row = screen.getByTestId(`place-row-${expandedPlace.id}`);
    expect(within(row).getByText(expandedPlace.address)).toBeOnTheScreen();
    for (const value of [
      expandedPlace.id,
      expandedPlace.google_place_id,
      expandedPlace.status,
      expandedPlace.seating_notes,
      expandedPlace.hours,
      expandedPlace.google_data.raw_payload,
    ]) {
      expect(screen.queryByText(value, { exact: false })).not.toBeOnTheScreen();
    }
  });

  it("applies combined filters, shows no matches, and clears locally", async () => {
    const loadPlaces = jest
      .fn<Promise<PublicPlace[]>, []>()
      .mockResolvedValue(PLACES);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);

    await screen.findByText("Second Place");
    await fireEvent.press(screen.getByRole("button", { name: "Olathe" }));
    await fireEvent.press(screen.getByRole("button", { name: "Library" }));

    let rows = screen.getAllByTestId(/^place-row-/);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Second Place")).toBeOnTheScreen();

    await fireEvent.changeText(
      screen.getByLabelText("Search places by name"),
      "  FIRST  ",
    );

    expect(screen.getByText("No matching places")).toBeOnTheScreen();
    expect(screen.queryByText("No places yet")).not.toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole("button", { name: "Clear filters" }),
    );

    rows = screen.getAllByTestId(/^place-row-/);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Second Place")).toBeOnTheScreen();
    expect(within(rows[1]).getByText("First Place")).toBeOnTheScreen();
    expect(screen.getByLabelText("Search places by name")).toHaveProp(
      "value",
      "",
    );
    expect(loadPlaces).toHaveBeenCalledTimes(1);
  });

  it("shows an intentional empty state", async () => {
    await render(<PlaceListScreen loadPlaces={async () => []} />);

    expect(await screen.findByText("No places yet")).toBeOnTheScreen();
    expect(
      screen.queryByLabelText("Search places by name"),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText("No matching places")).not.toBeOnTheScreen();
    expect(
      screen.getByText(
        "Check back soon as we add more Kansas City third places.",
      ),
    ).toBeOnTheScreen();
  });

  it("shows a sanitized error state without provider details", async () => {
    const providerDetails = "private endpoint and database relation";
    await render(
      <PlaceListScreen
        loadPlaces={async () => {
          throw new Error(providerDetails);
        }}
      />,
    );

    expect(await screen.findByText("Places are unavailable")).toBeOnTheScreen();
    expect(
      screen.getByText("We couldn't load places right now. Please try again."),
    ).toBeOnTheScreen();
    expect(screen.queryByText(providerDetails)).not.toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
  });

  it("retries a failed request and renders the recovered result", async () => {
    const retryRequest = deferred<PublicPlace[]>();
    const loadPlaces = jest
      .fn<Promise<PublicPlace[]>, []>()
      .mockRejectedValueOnce(new Error("provider failure"))
      .mockReturnValueOnce(retryRequest.promise);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);

    const retryButton = await screen.findByRole("button", {
      name: "Try again",
    });
    await fireEvent.press(retryButton);

    expect(screen.getByText("Finding places…")).toBeOnTheScreen();
    await act(async () => {
      retryRequest.resolve(PLACES);
    });
    expect(await screen.findByText("Second Place")).toBeOnTheScreen();
    expect(loadPlaces).toHaveBeenCalledTimes(2);
  });
});
