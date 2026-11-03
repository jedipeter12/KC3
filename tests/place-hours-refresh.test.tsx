import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react-native";
import {
  AccessibilityInfo,
  AppState,
  Platform,
  type AppStateStatus,
} from "react-native";

import { PlaceListScreen } from "../src/features/places/PlaceListScreen";
import { PlaceDetailScreen } from "../src/features/places/PlaceDetailScreen";
import { useHoursRefresh } from "../src/features/places/useHoursRefresh";
import { makePlaceDetail, makePlaceSummary } from "./place-fixtures";

jest.mock("../src/data/publicPlaces", () => ({
  getPublicPlaceDetail: jest.fn(),
  listPublicPlaceSummaries: jest.fn(),
  PUBLIC_PLACE_DETAILS_ERROR_MESSAGE:
    "We couldn't load place details right now. Please try again.",
  PUBLIC_PLACES_ERROR_MESSAGE:
    "We couldn't load places right now. Please try again.",
}));

const START = "2026-10-03T16:00:00Z";
const TRANSITION = "2026-10-03T16:00:10Z";
const originalAppState = Object.getOwnPropertyDescriptor(
  AppState,
  "currentState",
)!;
const open = () =>
  makePlaceSummary({
    regular_hours_available: true,
    regular_hours_observed_at: START,
    regular_hours_state: "open",
    regular_hours_next_transition_at: TRANSITION,
  });
const closed = () =>
  makePlaceSummary({
    ...open(),
    regular_hours_state: "closed",
    regular_hours_next_transition_at: "2026-10-03T17:00:00Z",
  });

async function advance(ms: number) {
  await act(async () => jest.advanceTimersByTime(ms));
}

describe("current-hours refresh", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(START));
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      writable: true,
      value: "active",
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(AppState, "currentState", originalAppState);
  });

  it("refreshes a list first loaded behind a direct detail view when it becomes visible", async () => {
    const places = [open()];
    const refresh = jest.fn(async () => {});
    const view = await renderHook<Date, { enabled: boolean }>(
      ({ enabled }) => useHoursRefresh(places, refresh, enabled),
      { initialProps: { enabled: false } },
    );
    await advance(120_000);
    expect(refresh).not.toHaveBeenCalled();
    await view.rerender({ enabled: true });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes at closing time and preserves search and applied Open now", async () => {
    const loadPlaces = jest.fn().mockResolvedValueOnce([open()]);
    let resolveClosed!: () => void;
    const pending = new Promise<ReturnType<typeof open>[]>((resolve) => {
      loadPlaces.mockImplementationOnce(() => pending);
      loadPlaces.mockResolvedValue([closed()]);
      // Resolve separately below to check that expired state disappears first.
      resolveClosed = () => resolve([closed()]);
    });
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    await advance(0);
    await fireEvent.changeText(
      screen.getByLabelText("Search places by name"),
      "First",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("button", { name: "Open now" }));
    await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
    expect(loadPlaces).toHaveBeenCalledTimes(1);

    await advance(10_000);
    expect(loadPlaces).toHaveBeenCalledTimes(2);
    expect(screen.getByText("No matching places")).toBeOnTheScreen();
    expect(screen.getByLabelText("Search places by name")).toHaveProp(
      "value",
      "First",
    );
    await act(async () => resolveClosed());
    expect(screen.getByText("No matching places")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("button", { name: "Open now" })).toHaveProp(
      "accessibilityState",
      { selected: true },
    );
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await fireEvent.press(
      screen.getAllByRole("button", { name: "Clear filters" })[0],
    );
    expect(screen.getByText(/^Closed · opens/)).toBeOnTheScreen();
  });

  it("includes a place when a server refresh reports its opening", async () => {
    const loadPlaces = jest
      .fn()
      .mockResolvedValueOnce([
        { ...closed(), regular_hours_next_transition_at: TRANSITION },
      ])
      .mockResolvedValue([
        { ...open(), regular_hours_next_transition_at: "2026-10-03T18:00:00Z" },
      ]);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    await advance(0);
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("button", { name: "Open now" }));
    await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("No matching places")).toBeOnTheScreen();
    await advance(10_000);
    expect(screen.getByText("First Place")).toBeOnTheScreen();
    expect(screen.getByText(/^Open · until/)).toBeOnTheScreen();
  });

  it("retains cards on refresh failure, suppresses expired claims, and allows retry", async () => {
    const loadPlaces = jest
      .fn()
      .mockResolvedValueOnce([open()])
      .mockRejectedValueOnce(new Error("private diagnostic"))
      .mockResolvedValue([closed()]);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    await advance(0);
    await advance(10_000);
    expect(screen.getByText("First Place")).toBeOnTheScreen();
    expect(
      screen.getByText("Current hours status unavailable"),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/We couldn't load places right now/),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/private diagnostic/)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText(/^Closed · opens/)).toBeOnTheScreen();
    expect(
      screen.queryByText(/We couldn't load places right now/),
    ).not.toBeOnTheScreen();
  });

  it("expires continuous-open hours exactly after the 14-day boundary", async () => {
    const place = {
      ...open(),
      regular_hours_observed_at: "2026-09-19T16:00:00Z",
      regular_hours_next_transition_at: null,
    };
    const loadPlaces = jest.fn().mockResolvedValue([place]);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    await advance(0);
    expect(screen.getByText("Open 24 hours")).toBeOnTheScreen();
    await advance(1);
    expect(
      screen.getByText(/Hours may have changed · Last checked/),
    ).toBeOnTheScreen();
    expect(loadPlaces).toHaveBeenCalledTimes(2);
  });

  it("coalesces pending refreshes and cleans up timers on unmount", async () => {
    const loadPlaces = jest
      .fn()
      .mockResolvedValueOnce([open()])
      .mockImplementation(() => new Promise(() => {}));
    const view = await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    await advance(0);
    await advance(130_000);
    expect(loadPlaces).toHaveBeenCalledTimes(2);
    await view.unmount();
    await advance(120_000);
    expect(loadPlaces).toHaveBeenCalledTimes(2);
  });

  it("does not repeat iOS loading/result announcements for unchanged refreshes", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const loadPlaces = jest
      .fn()
      .mockResolvedValue([
        { ...open(), regular_hours_next_transition_at: null },
      ]);
    await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    await advance(0);
    announce.mockClear();
    await advance(60_000);
    expect(loadPlaces).toHaveBeenCalledTimes(2);
    expect(announce).not.toHaveBeenCalled();
  });

  it("pauses native background reads and refreshes on returning to the app", async () => {
    let change!: (state: AppStateStatus) => void;
    const remove = jest.fn();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        change = listener;
        return { remove };
      });
    const loadPlaces = jest.fn().mockResolvedValue([open()]);
    const view = await render(<PlaceListScreen loadPlaces={loadPlaces} />);
    await advance(0);
    await act(async () => {
      jest.replaceProperty(AppState, "currentState", "background");
      change("background");
    });
    await advance(120_000);
    expect(loadPlaces).toHaveBeenCalledTimes(1);
    loadPlaces.mockResolvedValue([closed()]);
    await act(async () => {
      jest.replaceProperty(AppState, "currentState", "active");
      change("active");
    });
    expect(loadPlaces).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/^Closed · opens/)).toBeOnTheScreen();
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("pauses hidden Web tabs and refreshes when the tab becomes visible", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    const originalDocument = Object.getOwnPropertyDescriptor(
      globalThis,
      "document",
    );
    const browserDocument = {
      hidden: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: browserDocument,
    });
    try {
      const loadPlaces = jest.fn().mockResolvedValue([open()]);
      const view = await render(<PlaceListScreen loadPlaces={loadPlaces} />);
      await advance(0);
      const visibility = () =>
        browserDocument.addEventListener.mock.calls.at(-1)![1]();
      await act(async () => {
        browserDocument.hidden = true;
        visibility();
      });
      await advance(120_000);
      expect(loadPlaces).toHaveBeenCalledTimes(1);
      loadPlaces.mockResolvedValue([closed()]);
      await act(async () => {
        browserDocument.hidden = false;
        visibility();
      });
      expect(loadPlaces).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/^Closed · opens/)).toBeOnTheScreen();
      await view.unmount();
      expect(browserDocument.removeEventListener).toHaveBeenCalled();
    } finally {
      if (originalDocument)
        Object.defineProperty(globalThis, "document", originalDocument);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });

  it("refreshes detail without discarding its weekly schedule or navigating away", async () => {
    const detail = makePlaceDetail({
      ...open(),
      regular_hours: [
        {
          day_of_week: 6,
          open_time: "08:00",
          close_time: "11:00",
          is_closed: false,
          closes_next_day: false,
        },
      ],
    });
    const loadPlaceDetail = jest
      .fn()
      .mockResolvedValueOnce(detail)
      .mockRejectedValueOnce(new Error("private diagnostic"))
      .mockResolvedValue({ ...detail, ...closed() });
    const onBack = jest.fn();
    await render(
      <PlaceDetailScreen
        placeId={detail.id}
        loadPlaceDetail={loadPlaceDetail}
        onBack={onBack}
      />,
    );
    await advance(0);
    await advance(10_000);
    expect(
      screen.getByText("Current hours status unavailable"),
    ).toBeOnTheScreen();
    expect(screen.getByText("Regular hours")).toBeOnTheScreen();
    expect(screen.getByText("8:00 AM–11:00 AM")).toBeOnTheScreen();
    expect(
      screen.getByText(/We couldn't load place details right now/),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText(/^Closed · opens/)).toBeOnTheScreen();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("refreshes cached list data on Back and only polls the visible screen", async () => {
    const loadPlaces = jest.fn().mockResolvedValue([open()]);
    const loadPlaceDetail = jest
      .fn()
      .mockResolvedValue(makePlaceDetail({ ...open() }));
    await render(
      <PlaceListScreen
        loadPlaces={loadPlaces}
        loadPlaceDetail={loadPlaceDetail}
      />,
    );
    await advance(0);
    await fireEvent.press(screen.getByRole("link", { name: /^First Place,/ }));
    await advance(0);
    await advance(10_000);
    expect(loadPlaces).toHaveBeenCalledTimes(1);
    expect(loadPlaceDetail).toHaveBeenCalledTimes(2);
    loadPlaces.mockResolvedValue([closed()]);
    await fireEvent.press(screen.getByRole("button", { name: "‹ Places" }));
    await advance(0);
    expect(loadPlaces).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/^Closed · opens/)).toBeOnTheScreen();
  });
});
