import { scopeMapsQueryToLocation } from '@/lib/destination-safety';
import { normalizeUserInput } from '@/lib/normalize-user-input';

export type AccommodationFields = {
  accommodation?: string;
  accommodationName?: string;
  accommodationArea?: string;
  accommodationNote?: string;
};

/** Normalize a single optional text field into payload-friendly accommodation fields. */
export function normalizeAccommodationFields(raw?: string | null): AccommodationFields {
  const trimmed = normalizeUserInput(raw ?? '');
  if (!trimmed) return {};

  return {
    accommodation: trimmed,
    accommodationName: trimmed,
    accommodationArea: trimmed,
    accommodationNote: undefined,
  };
}

export function hasAccommodation(fields: AccommodationFields): boolean {
  return Boolean(fields.accommodation?.trim());
}

/**
 * Destination-scoped Google Maps query for the accommodation — never usable as "current location".
 * Example: "Solaria Nishitetsu Hotel Seoul Myeongdong Seoul Korea"
 */
export function buildAccommodationMapsQuery(accommodation: string, destination: string): string {
  return scopeMapsQueryToLocation(accommodation, destination);
}

/** Prompt block injected into MVP / generate-plan when accommodation is provided. */
export function buildAccommodationPromptSection(
  fields: AccommodationFields,
  destination: string,
): string | null {
  if (!hasAccommodation(fields) || !fields.accommodation) return null;

  const mapsExample = buildAccommodationMapsQuery(fields.accommodation, destination);

  return [
    `宿泊先: ${fields.accommodation}`,
    '【宿泊先を起点・終点に・重要】The traveler already has accommodation booked. Use it as the daily hub — NOT the user\'s current GPS location.',
    '- When accommodation is provided, keep each day\'s start and end as close to the accommodation area as practical',
    '- Mornings: begin with spots that are easy to reach from the hotel/base',
    '- Evenings: finish in an area that makes returning to the accommodation easy',
    '- Day 1: respect arrivalTime and the accommodation location when scheduling the first activities',
    '- Last day: respect departureTime — end near the accommodation or on the way to airport/station, avoiding unnecessary backtracking',
    '- Minimize wasteful round trips across the city',
    `- If mapsQuery references the hotel/accommodation, always include destination city/country (example: "${mapsExample}") — never treat it as device current location`,
  ].join('\n');
}
