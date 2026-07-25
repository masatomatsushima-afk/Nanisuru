/**
 * Soft venue setting for Places weather-fit.
 * Prefer explicit venueSetting; otherwise category only — never invent from place names.
 */

import type { PlaceCandidate, PlaceVenueSetting } from '@/types/place-candidate';
import type { PlaceCategory } from '@/lib/destination-safety';

export type VenueSetting = PlaceVenueSetting | 'unknown';

/** Resolve indoor/outdoor leaning without dangerous name-based guesses. */
export function resolveVenueSetting(candidate: PlaceCandidate): VenueSetting {
  if (
    candidate.venueSetting === 'indoor' ||
    candidate.venueSetting === 'outdoor' ||
    candidate.venueSetting === 'mixed'
  ) {
    return candidate.venueSetting;
  }
  return venueSettingFromCategory(candidate.category);
}

export function venueSettingFromCategory(category: PlaceCategory | undefined): VenueSetting {
  switch (category) {
    case 'cafe':
    case 'shopping':
      return 'indoor';
    case 'food':
    case 'nightlife':
      return 'mixed';
    case 'sightseeing':
    case 'activity':
      // Parks vs museums both map here — do not assert outdoor from category alone.
      return 'unknown';
    default:
      return 'unknown';
  }
}
