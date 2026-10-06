/**
 * Exponential Backoff Retry Utility for Fetch Requests
 * Specifically handles transient 5xx server errors and network dropouts.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryOnStatuses?: number[];
  onRetry?: (attempt: number, delayMs: number, reason: string) => void;
}

const DEFAULT_RETRY_STATUSES = [500, 502, 503, 504];

/**
 * Fetch with Exponential Backoff
 * Retries on transient 5xx server errors and network exceptions.
 * Does not retry client errors (4xx).
 */
export async function fetchWithExponentialBackoff(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response | null> {
  const {
    maxRetries = 3,
    baseDelayMs = 300,
    maxDelayMs = 3000,
    backoffFactor = 2,
    retryOnStatuses = DEFAULT_RETRY_STATUSES,
    onRetry,
  } = retryOptions;

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, options);

      // If the request succeeded (2xx, 3xx) or is a client error (4xx), return immediately
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // If response matches a transient server error status code and retries remain:
      if (retryOnStatuses.includes(response.status) && attempt < maxRetries) {
        attempt++;
        // Calculate exponential delay with full jitter
        const exponentialDelay = baseDelayMs * Math.pow(backoffFactor, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
        const jitter = Math.random() * (cappedDelay * 0.3); // up to 30% jitter
        const finalDelay = Math.round(cappedDelay + jitter);

        const reason = `HTTP ${response.status} ${response.statusText || 'Server Error'}`;
        if (onRetry) {
          onRetry(attempt, finalDelay, reason);
        } else {
          console.warn(`[Exponential Backoff] ${url} failed with ${reason}. Retrying attempt ${attempt}/${maxRetries} in ${finalDelay}ms...`);
        }

        await new Promise((resolve) => setTimeout(resolve, finalDelay));
        continue;
      }

      return response;
    } catch (networkError: any) {
      // Abort errors should not be retried if manually aborted
      if (networkError?.name === 'AbortError') {
        throw networkError;
      }

      if (attempt < maxRetries) {
        attempt++;
        const exponentialDelay = baseDelayMs * Math.pow(backoffFactor, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
        const jitter = Math.random() * (cappedDelay * 0.3);
        const finalDelay = Math.round(cappedDelay + jitter);

        const reason = networkError?.message || 'Network Failure';
        if (onRetry) {
          onRetry(attempt, finalDelay, reason);
        } else {
          console.warn(`[Exponential Backoff] ${url} failed with ${reason}. Retrying attempt ${attempt}/${maxRetries} in ${finalDelay}ms...`);
        }

        await new Promise((resolve) => setTimeout(resolve, finalDelay));
        continue;
      }

      console.warn(`[Exponential Backoff] ${url} exhausted all ${maxRetries} retries:`, networkError);
      return null;
    }
  }

  return null;
}
