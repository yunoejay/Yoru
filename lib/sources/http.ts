/**
 * Polite HTTP helpers for upstream content APIs.
 *
 * MangaDex enforces a *global* limit of roughly 5 requests/second per IP across
 * the whole of api.mangadex.org. Going over it yields HTTP 429, and continuing
 * to push triggers their DDoS protection and a temporary 403 IP ban. Requests
 * MUST carry a real, non-spoofed User-Agent and MUST NOT carry a Via header.
 * https://gitlab.com/mangadex-pub/mangadex-api-docs/-/raw/main/2-limitations.md
 *
 * Everything in this file therefore throttles per host and backs off on 429.
 */

/**
 * Identify the app honestly. Override with SOURCE_USER_AGENT once the project
 * has a public URL or support address so upstream can contact you.
 */
export const USER_AGENT =
  process.env.SOURCE_USER_AGENT ||
  'YoruReader/0.1 (personal, non-commercial reading project; contact: set-SOURCE_USER_AGENT)';

interface BucketState {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, BucketState>();

/** Requests per second allowed for a host. Kept under MangaDex's ~5/s. */
const RATE_PER_SEC = Number(process.env.SOURCE_RATE_PER_SEC || '4');
const BURST = Number(process.env.SOURCE_BURST || '2');

async function acquire(key: string): Promise<void> {
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: BURST, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(BURST, bucket.tokens + elapsedSec * RATE_PER_SEC);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return;
  }

  const waitMs = Math.ceil(((1 - bucket.tokens) / RATE_PER_SEC) * 1000);
  await sleep(waitMs);
  bucket.tokens = 0;
  bucket.lastRefill = Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface FetchOptions {
  /** Throttling bucket. Defaults to the target host. */
  bucket?: string;
  headers?: Record<string, string>;
  /** Extra attempts beyond the first. Defaults to 2. */
  retries?: number;
  /** Redirect following. MangaDex at-home nodes are fine with the default. */
  redirect?: RequestRedirect;
}

/**
 * Fetch with per-host throttling, an honest User-Agent, and backoff on 429.
 * Throws on non-2xx after retries are exhausted.
 */
export async function politeFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { bucket, headers = {}, retries = 2, redirect } = options;

  const target = new URL(url);
  let attempt = 0;

  for (;;) {
    await acquire(bucket ?? target.host);

    let response: Response;
    try {
      response = await fetch(target, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
        redirect,
      });
    } catch (error) {
      if (attempt < retries) {
        attempt += 1;
        await sleep(500 * attempt);
        continue;
      }
      throw error;
    }

    if (response.status === 429 || response.status === 503) {
      if (attempt >= retries) {
        throw new Error(`Upstream rate limited ${target.host} (HTTP ${response.status}) after ${attempt + 1} attempts`);
      }
      const retryAfterSec = Number(response.headers.get('retry-after') || response.headers.get('x-ratelimit-retry-after') || '0');
      const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 1000 * (attempt + 1);
      await sleep(Math.min(waitMs, 15_000));
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const requestId = response.headers.get('x-request-id');
      throw new Error(
        `Request to ${target.host} failed: HTTP ${response.status}${requestId ? ` (X-Request-ID: ${requestId})` : ''}${body ? ` ${body.slice(0, 300)}` : ''}`
      );
    }

    return response;
  }
}

export async function politeJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await politeFetch(url, options);
  return (await response.json()) as T;
}
