import {
  publicRequest,
  PUBLIC_REQUEST_TIMEOUT_MS,
} from "../src/data/publicRequest";

afterEach(() => jest.useRealTimers());

test("aborts and settles a hung transport at the deadline", async () => {
  jest.useFakeTimers();
  let transportSignal: AbortSignal | undefined;
  const request = publicRequest((signal) => {
    transportSignal = signal;
    return new Promise(() => {});
  });
  const assertion = expect(request).rejects.toThrow("cancelled");
  await jest.advanceTimersByTimeAsync(PUBLIC_REQUEST_TIMEOUT_MS);
  await assertion;
  expect(transportSignal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test("caller cancellation stops transport and ignores its eventual response", async () => {
  const controller = new AbortController();
  let resolve!: (value: string) => void;
  let transportSignal: AbortSignal | undefined;
  const request = publicRequest((signal) => {
    transportSignal = signal;
    return new Promise<string>((done) => {
      resolve = done;
    });
  }, controller.signal);
  const assertion = expect(request).rejects.toThrow("cancelled");
  controller.abort();
  resolve("late response");
  await assertion;
  expect(transportSignal?.aborted).toBe(true);
});

test("already cancelled requests never start the transport", async () => {
  const controller = new AbortController();
  controller.abort();
  const start = jest.fn();
  await expect(publicRequest(start, controller.signal)).rejects.toThrow(
    "cancelled",
  );
  expect(start).not.toHaveBeenCalled();
});

test("successful requests remove their deadline and cancellation listener", async () => {
  jest.useFakeTimers();
  const controller = new AbortController();
  let transportSignal: AbortSignal | undefined;
  await expect(
    publicRequest((signal) => {
      transportSignal = signal;
      return Promise.resolve("result");
    }, controller.signal),
  ).resolves.toBe("result");
  expect(jest.getTimerCount()).toBe(0);
  controller.abort();
  expect(transportSignal?.aborted).toBe(false);
});

test("synchronous transport failure removes the deadline", async () => {
  jest.useFakeTimers();
  await expect(
    publicRequest(() => {
      throw new Error("transport");
    }),
  ).rejects.toThrow("transport");
  expect(jest.getTimerCount()).toBe(0);
});
