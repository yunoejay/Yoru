/**
 * Profile shape shared by the session endpoint, the profile API and the
 * account page.
 *
 * `name` remains the handle (3-30 letters/numbers/underscores, enforced by the
 * auth routes); `displayName` is the free-form name the reader actually sees.
 * This module is deliberately dependency-free so client components can import
 * the types and the website normaliser without pulling Prisma in.
 */

export interface PublicProfile {
  id: string;
  email: string;
  /** Handle/username. */
  name: string | null;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  verified: boolean;
  createdAt: string;
}

/** The minimum User columns needed to serialize a profile. */
export interface ProfileSource {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  verified: boolean;
  createdAt: Date;
}

export function toPublicProfile(user: ProfileSource): PublicProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    bio: user.bio,
    location: user.location,
    website: user.website,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    verified: user.verified,
    createdAt: user.createdAt.toISOString(),
  };
}

/** The name to show in the navbar/hero: display name, then handle, then email. */
export function profileDisplayName(
  user: Pick<PublicProfile, 'displayName' | 'name' | 'email'>,
): string {
  return user.displayName?.trim() || user.name?.trim() || user.email;
}

export interface ProfileFields {
  username: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
}

export type ProfileParseResult = { data: ProfileFields } | { error: string };

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalise a website field: bare domains get `https://`, and anything that is
 * not a well-formed http(s) URL is rejected rather than stored.
 */
export function normalizeWebsite(value: unknown): { url: string | null } | { error: string } {
  const raw = optionalText(value);
  if (!raw) return { url: null };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (withScheme.length > 200) return { error: 'Website must be 200 characters or fewer.' };
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'Website must start with http:// or https://.' };
    }
    return { url: parsed.toString().replace(/\/$/, '') };
  } catch {
    return { error: 'That website address does not look valid.' };
  }
}

/** Validate and normalise a profile update body. */
export function parseProfileFields(body: unknown): ProfileParseResult {
  const input = (body ?? {}) as Record<string, unknown>;
  const username = optionalText(input.username);

  if (!username) return { error: 'Username is required.' };
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
    return { error: 'Username must be 3–30 characters using only letters, numbers, and underscores.' };
  }

  const displayName = optionalText(input.displayName);
  if (displayName.length > 60) return { error: 'Display name must be 60 characters or fewer.' };

  const bio = optionalText(input.bio);
  if (bio.length > 280) return { error: 'Bio must be 280 characters or fewer.' };

  const location = optionalText(input.location);
  if (location.length > 80) return { error: 'Location must be 80 characters or fewer.' };

  const website = normalizeWebsite(input.website);
  if ('error' in website) return website;

  return {
    data: {
      username,
      displayName: displayName || null,
      bio: bio || null,
      location: location || null,
      website: website.url,
    },
  };
}
