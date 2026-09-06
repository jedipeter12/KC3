import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";

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

  it("shows an intentional empty state", async () => {
    await render(<PlaceListScreen loadPlaces={async () => []} />);

    expect(await screen.findByText("No places yet")).toBeOnTheScreen();
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
