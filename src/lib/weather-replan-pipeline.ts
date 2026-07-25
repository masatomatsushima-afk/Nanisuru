/**
 * Shared post-adjustment quality gates for weather replan (β stability).
 * Mirrors normal plan generation: Places rebind → schedule → specificity → finalize locals.
 */

import { flattenItineraryDays } from '@/lib/trip-duration';
import { resolveDestinationDetailsFromPlanInput } from '@/lib/destination-detail-input';
import { validateAndFixItinerarySchedule } from '@/lib/itinerary-schedule-validation';
import { enforcePlaceCandidateSelection } from '@/lib/places/place-candidate-enforcement';
import { fetchPlaceCandidatesForPlanPrompt } from '@/lib/places/plan-places-candidates';
import { enforceSpecificityOnDays, isAbstractItineraryItem } from '@/lib/spot-specificity';
import {
  finalizeItineraryBeforeDisplay,
} from '@/lib/finalize-itinerary';
import { generateOutfitPackingAdvice } from '@/lib/outfit-packing-advice';
import { resolveItineraryMapsLink, sanitizePlaceId } from '@/lib/maps-link-safety';
import type { ItineraryDay, PlanDetails } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type { WeatherContext } from '@/types/weather-context';
import type { WeatherForecast } from '@/lib/weather';
import type { PlaceCandidate } from '@/types/place-candidate';
import type { PlaceWeatherFitContext } from '@/lib/places/place-ranking-context';
import type { PlanInput } from '@/lib/prompts';

export const WEATHER_REPLAN_TIMEOUT_MS = 35_000;

export type WeatherReplanGateResult = {
  days: ItineraryDay[];
  details: PlanDetails;
  googleCandidateCount: number;
  finalSpecificPlaceCount: number;
  abstractItemCount: number;
  invalidMapsItemCount: number;
  scheduleValidationPassed: boolean;
  itemCountByDay: number[];
};

function countSpecific(days: ItineraryDay[]): number {
  return days.reduce(
    (sum, day) =>
      sum + day.items.filter((item) => item.isSpecificPlace === true && Boolean(sanitizePlaceId(item.placeId))).length,
    0,
  );
}

function countAbstract(days: ItineraryDay[]): number {
  return days.reduce(
    (sum, day) => sum + day.items.filter((item) => isAbstractItineraryItem(item)).length,
    0,
  );
}

function countInvalidMaps(days: ItineraryDay[], location: string): number {
  let n = 0;
  for (const day of days) {
    for (const item of day.items) {
      if (item.isSpecificPlace === false) continue;
      if (!resolveItineraryMapsLink(item, location)) n += 1;
    }
  }
  return n;
}

/**
 * Strip bulky hourly rows before route-param serialization (keeps daily for Plan Detail / replan).
 */
export function slimPlanDetailsForRoute(details: PlanDetails): PlanDetails {
  if (!details.weatherContext?.hourly?.length) return details;
  return {
    ...details,
    weatherContext: {
      ...details.weatherContext,
      hourly: [],
    },
  };
}

export function slimWeatherContextForStorage(
  weatherContext: WeatherContext | undefined,
): WeatherContext | undefined {
  if (!weatherContext) return undefined;
  // Keep hourly for modifiers when present, but cap to trip window size to avoid huge payloads.
  if (weatherContext.hourly.length <= 72) return weatherContext;
  return {
    ...weatherContext,
    hourly: weatherContext.hourly.slice(0, 72),
  };
}

/** Seed / unverified "specific" claims must not survive replan as Maps-ready venues. */
export function demoteInventedSpecificClaims(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      if (item.activityCategory === '移動') return item;
      const placeId = sanitizePlaceId(item.placeId);
      if (item.source === 'google_places' && placeId) {
        return { ...item, isSpecificPlace: true, placeId };
      }
      if (item.source === 'seed' || (item.isSpecificPlace === true && !placeId)) {
        return {
          ...item,
          isSpecificPlace: false,
          placeId: null,
          coordinates: null,
          latitude: null,
          longitude: null,
          source: item.source === 'google_places' ? 'fallback' : (item.source ?? 'fallback'),
        };
      }
      return item;
    }),
  }));
}

/**
 * Run the same quality gates used after normal plan generation (without AI partial-fix loops).
 */
export async function runWeatherReplanQualityGates(params: {
  payload: SavedTripPayload;
  days: ItineraryDay[];
  weather: WeatherForecast;
  weatherContext?: WeatherContext;
  weatherFit?: PlaceWeatherFitContext;
  changePoints?: string[];
  abortSignal?: AbortSignal;
}): Promise<WeatherReplanGateResult> {
  const { payload, weather, weatherContext, weatherFit, abortSignal } = params;
  let days = params.days.map((day) => ({
    ...day,
    items: day.items.map((item) => ({ ...item })),
  }));

  if (abortSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  let candidates: PlaceCandidate[] = [];
  try {
    const planInput = {
      location: payload.location,
      country: payload.details.country,
      city: payload.details.city,
      baseArea: payload.details.baseArea,
      accommodation: payload.details.accommodation,
      destinationLabel: payload.details.destinationLabel,
      tripDate: payload.details.tripDate ?? '',
      tripEndDate: payload.details.tripEndDate,
      tripDuration: payload.tripDuration,
      customDuration: payload.customDuration,
      budget: payload.budget,
      currency: payload.currency,
      people: payload.people,
      companion: payload.companion,
      personality: payload.personality,
      mood: payload.mood ?? '',
    } as PlanInput;
    const places = await fetchPlaceCandidatesForPlanPrompt(planInput, { weatherFit });
    candidates = places.candidates;
  } catch (error) {
    console.warn('[WeatherReplan] places fetch failed during gates', error);
  }

  if (abortSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (candidates.length > 0) {
    const enforced = enforcePlaceCandidateSelection(days, candidates, payload.location);
    days = enforced.days;
  }

  days = demoteInventedSpecificClaims(days);

  // Honest area items only — no Seoul seed hole-fill on replan.
  days = enforceSpecificityOnDays(days, payload.location, { allowSeoulSeeds: false });
  days = demoteInventedSpecificClaims(days);

  const destinationDetails = resolveDestinationDetailsFromPlanInput({
    location: payload.location,
    country: payload.details.country,
    city: payload.details.city,
    baseArea: payload.details.baseArea,
    accommodation: payload.details.accommodation,
    destinationLabel: payload.details.destinationLabel,
  });

  const scheduled = validateAndFixItinerarySchedule({
    days,
    rawLocation: payload.location,
    travelTiming: payload.details.travelTiming,
    destinationDetails,
    allowInventedSpecificPlaces: false,
  });
  days = scheduled.days;
  days = demoteInventedSpecificClaims(days);

  const outfitAdvice = generateOutfitPackingAdvice({
    days,
    weather,
    location: payload.location,
    companion: payload.companion,
    tripDate: payload.details.tripDate,
    dayCount: days.length,
  });

  let details: PlanDetails = {
    ...payload.details,
    weather,
    weatherContext: slimWeatherContextForStorage(weatherContext),
    outfitAdvice,
    rainyDayAlternatives: payload.details.rainyDayAlternatives ?? [],
    weatherReplanChanges: params.changePoints,
  };

  const transportContext = {
    location: payload.location,
    weather,
    travelTiming: payload.details.travelTiming,
    companion: payload.companion,
    budget: payload.budget,
  };

  try {
    const finalized = await finalizeItineraryBeforeDisplay({
      plan: { days, details },
      travelTiming: payload.details.travelTiming,
      dayCount: days.length,
      gourmetTour: false,
      budgetScope: payload.details.budgetScope,
      location: payload.location,
      companion: payload.companion,
      tripDate: payload.details.tripDate,
      weather,
      transportContext,
      allowAiPartialFix: false,
    });
    days = demoteInventedSpecificClaims(finalized.plan.days);
    details = {
      ...finalized.plan.details,
      weather,
      weatherContext: slimWeatherContextForStorage(weatherContext),
      weatherReplanChanges: params.changePoints,
    };
  } catch (error) {
    console.warn('[WeatherReplan] local finalize failed, using schedule-validated plan', error);
  }

  if (abortSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const itemCountByDay = days.map((day) => day.items.filter((i) => i.activityCategory !== '移動').length);

  return {
    days,
    details,
    googleCandidateCount: candidates.length,
    finalSpecificPlaceCount: countSpecific(days),
    abstractItemCount: countAbstract(days),
    invalidMapsItemCount: countInvalidMaps(days, payload.location),
    scheduleValidationPassed: true,
    itemCountByDay,
  };
}

export function buildValidatedReplanPayload(
  base: SavedTripPayload,
  gate: WeatherReplanGateResult,
): SavedTripPayload {
  return {
    ...base,
    days: gate.days,
    items: flattenItineraryDays(gate.days),
    details: gate.details,
  };
}
