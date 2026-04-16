/**
 * Shared retry helper for Supabase Edge Functions.
 * Handles transient Gemini API errors with exponential backoff.
 */

export interface RetryOptions {
  maxAttempts?: number;   // default: 3
  baseDelayMs?: number;   // default: 500ms
  maxDelayMs?: number;    // default: 8000ms
  retryOn?: number[];     // HTTP status codes to retry (default: 429, 500, 502, 503)
}

// Note: 429 is intentionally NOT retried - it burns more quota and the user gets
// a misleading wait. Let it surface immediately so the app shows a clear error.
const DEFAULT_RETRY_STATUS_CODES = [500, 502, 503, 504];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes `fn` with exponential backoff retry.
 * Throws the last error if all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    retryOn = DEFAULT_RETRY_STATUS_CODES,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      const isRetryableStatus =
        typeof err?.status === 'number' && retryOn.includes(err.status);
      const isNetworkError =
        err instanceof TypeError && err.message.includes('fetch');

      const shouldRetry = isRetryableStatus || isNetworkError;

      if (!shouldRetry || attempt === maxAttempts) {
        throw err;
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const jitter = Math.random() * delay * 0.25;
      console.warn(
        `[retry] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${Math.round(delay + jitter)}ms...`
      );
      await sleep(delay + jitter);
    }
  }

  throw lastError;
}

/**
 * Fetches a URL and throws a typed error if the response is not ok,
 * so withRetry can inspect the HTTP status code.
 */
export async function fetchWithStatus(
  url: string,
  init: RequestInit
): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(`HTTP ${res.status}: ${body}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res;
}
