/**
 * Image proxy helpers.
 *
 * MangaDex will not let a browser load their pages directly: they send no CORS
 * headers for foreign origins and deliberately serve a "wrong response" image to
 * hotlinkers. The only compliant option is to fetch pages from our own server
 * and hand the browser a same-origin URL. That is what this is for.
 *
 * The upstream URL is passed as a base64url blob in `?src=`, then re-validated
 * against a host allowlist on every request so this route can never be turned
 * into an open proxy / SSRF primitive.
 */

const ALLOWED_HOST_SUFFIXES = [
  'mangadex.org', // uploads.mangadex.org covers covers + first-party images
  'mangadex.network', // MangaDex@Home volunteer nodes (random subdomains, any port)
  'placehold.co', // bundled demo placeholders
  // Atsumaru (MangaBaka API source). Its pages and covers are served from the
  // edge CDN `cdn.atsu.moe`; the API itself (atsu.moe) is only fetched
  // server-side, never proxied as an image, but the suffix covers both.
  'atsu.moe',
];

const PRIVATE_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$)/i;

export interface ProxyTarget {
  url: URL;
  requiresReport: boolean;
}

/** Build the same-origin <img> src for an upstream page URL. */
export function encodeProxySrc(upstreamUrl: string, requiresReport: boolean): string {
  const encoded = Buffer.from(upstreamUrl, 'utf8').toString('base64url');
  return `/api/image?src=${encoded}${requiresReport ? '&report=1' : ''}`;
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    suffix => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/** True when a raw absolute URL is an https image on a host we may proxy. */
export function isAllowedImageUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (PRIVATE_HOSTS.test(url.hostname)) return false;
  return isAllowedHost(url.hostname);
}

/**
 * Same-origin <img> src for a cover/asset stored as an absolute upstream URL.
 *
 * Covers are stored as raw CDN links, but some CDNs — Atsumaru's cdn.atsu.moe
 * chief among them — answer 403 to the `Sec-Fetch-Site: cross-site` header a
 * browser always attaches to a cross-origin <img>. Serving covers through the
 * proxy sidesteps that exactly as chapter pages already do, because our own
 * server-side fetch never sends those headers. Anything we are not allowed to
 * proxy (a host off the allowlist, a non-https or malformed URL) is returned
 * unchanged so an unexpected value still renders the way it would have before.
 */
export function toClientImageSrc(upstreamUrl: string): string {
  return isAllowedImageUrl(upstreamUrl) ? encodeProxySrc(upstreamUrl, false) : upstreamUrl;
}

/**
 * Decode and validate a proxy target. Returns null for anything that is not an
 * allowlisted https image URL.
 */
export function decodeProxySrc(encoded: string | null, requiresReport: boolean): ProxyTarget | null {
  if (!encoded) return null;

  let upstream: string;
  try {
    upstream = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  let url: URL;
  try {
    url = new URL(upstream);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (PRIVATE_HOSTS.test(url.hostname)) return null;
  if (!isAllowedHost(url.hostname)) return null;

  return { url, requiresReport };
}

/** True when an at-home style health report should be sent for this host. */
export function hostNeedsReport(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.endsWith('mangadex.network') || (!host.includes('mangadex.org') && !host.endsWith('placehold.co'));
}
