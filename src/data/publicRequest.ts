/** Shared deadline for anonymous discovery requests on Web and native. */
export const PUBLIC_REQUEST_TIMEOUT_MS = 15_000;

/** Aborts the transport and settles even if a transport ignores cancellation. */
export async function publicRequest<T>(
  start: (signal: AbortSignal) => PromiseLike<T>,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let rejectAbort: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      rejectAbort = () => reject(new Error("Public request cancelled."));
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) {
        cancel();
        return;
      }
      timeout = setTimeout(cancel, PUBLIC_REQUEST_TIMEOUT_MS);
      Promise.resolve(start(controller.signal)).then(resolve, reject);
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
    if (rejectAbort)
      controller.signal.removeEventListener("abort", rejectAbort);
  }
}
