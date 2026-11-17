/**
 * Source registry.
 *
 * Adding a new scanlator means writing one file that satisfies
 * `ScanlationSource` and registering it here - nothing in the pages or API
 * routes changes.
 *
 * A disabled adapter stays registered, but `getEnabledSources()` is what the
 * rest of the app should use, so it can never leak a request.
 */

import { ScanlationSource, SourceId } from './types';
import { mangadexSource } from './mangadex';
import { atsumaruSource } from './atsumaru';

const registry = new Map<SourceId, ScanlationSource>([
  [mangadexSource.id, mangadexSource],
  [atsumaruSource.id, atsumaruSource],
]);

export function allSources(): ScanlationSource[] {
  return Array.from(registry.values());
}

export function getEnabledSources(): ScanlationSource[] {
  return allSources().filter(source => source.enabled);
}

export function getSource(id: string): ScanlationSource | undefined {
  return registry.get(id as SourceId);
}

/** Throws instead of returning undefined - for routes that must resolve one. */
export function requireSource(id: string): ScanlationSource {
  const source = getSource(id);
  if (!source) throw new Error(`Unknown source "${id}"`);
  if (!source.enabled) {
    throw new Error(
      `Source "${id}" is disabled. Set ${id.toUpperCase()}_ENABLED=true` +
        (source.legal ? '' : ` and ${id.toUpperCase()}_ACKNOWLEDGE_LEGAL_RISK=true to enable it.`)
    );
  }
  return source;
}

export type { ScanlationSource } from './types';
export { SourceDisabledError } from './types';
