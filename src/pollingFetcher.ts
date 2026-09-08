// Polling fetcher with throttling, in-flight guard, and last-known-good
// retention. The usage-quota tracker's fetchUsage/refreshUsage pattern,
// generalized: any plugin polling an authenticated endpoint needs exactly
// this — fetch on an interval, don't refetch while one is in flight, keep
// the last success on failure.

export interface PollingFetcherOptions<T> {
  /** The async fetch function. Returns null on failure (keeps last value). */
  readonly fetch: () => Promise<T | null>
  /** Polling interval in ms. */
  readonly intervalMs: number
  /** Minimum gap between fetches in ms (throttle). Defaults to intervalMs. */
  readonly throttleMs?: number
  /** Called with the fresh value on successful fetch. */
  readonly onResult?: (value: T) => void
  /** Called on fetch error (after all retries). */
  readonly onError?: (err: unknown) => void
}

export interface PollingFetcher {
  /** Trigger a fetch immediately (respects throttle + in-flight). */
  readonly refresh: () => void
  /** Stop polling (call from cleanup). */
  readonly stop: () => void
  /** Whether a fetch is currently in flight. */
  readonly inFlight: () => boolean
}

/**
 * Create a polling fetcher. Fetches on an interval, guards against
 * concurrent fetches, and throttles to avoid hammering the endpoint.
 */
export function createPollingFetcher<T>(options: PollingFetcherOptions<T>): PollingFetcher {
  const { fetch, intervalMs, throttleMs = intervalMs, onResult, onError } = options

  let lastFetch = 0
  let inFlightFlag = false
  let timer: ReturnType<typeof setInterval> | null = null

  async function doFetch(): Promise<void> {
    if (inFlightFlag) return
    inFlightFlag = true
    try {
      const result = await fetch()
      if (result !== null) {
        onResult?.(result)
      }
    } catch (err) {
      onError?.(err)
    } finally {
      inFlightFlag = false
    }
  }

  function refresh(): void {
    const now = Date.now()
    if (now - lastFetch < throttleMs) return
    lastFetch = now
    void doFetch()
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  // Kick off the first fetch immediately. Going through refresh() records
  // the timestamp, so the initial fetch counts toward the throttle window.
  refresh()

  // Start the polling timer.
  timer = setInterval(refresh, intervalMs)

  return {
    refresh,
    stop,
    inFlight: () => inFlightFlag,
  }
}
