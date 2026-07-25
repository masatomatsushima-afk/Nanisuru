/**
 * Travel timing + arrival/departure context.
 *
 * MVP semantics:
 * - arrivalTime = preferred plan start time (NOT necessarily a flight landing)
 * - departureTime = preferred plan end time (NOT necessarily a flight takeoff)
 * Airport / station assumptions are ONLY allowed when the user explicitly sets them.
 */

export const TRAVEL_TIMING_PLACE_OPTIONS = [
  '空港',
  '駅',
  'ホテル',
  '市内中心部',
  'その他',
] as const;

export type TravelTimingPlaceType = (typeof TRAVEL_TIMING_PLACE_OPTIONS)[number];

export type ArrivalContextType =
  | 'unknown'
  | 'already_in_area'
  | 'airport'
  | 'station'
  | 'hotel'
  | 'custom';

export type DepartureContextType =
  | 'unknown'
  | 'stay_in_area'
  | 'airport'
  | 'station'
  | 'hotel'
  | 'custom';

export type ArrivalContext = {
  type: ArrivalContextType;
  label?: string;
  time?: string;
};

export type DepartureContext = {
  type: DepartureContextType;
  label?: string;
  time?: string;
};

export type TravelTimingSettings = {
  arrivalTime?: string;
  arrivalPlace?: TravelTimingPlaceType;
  arrivalPlaceDetail?: string;
  departureTime?: string;
  departurePlace?: TravelTimingPlaceType;
  departurePlaceDetail?: string;
  hotelCheckInTime?: string;
  dailyStartTime?: string;
  dailyEndTime?: string;
  /** Structured arrival context — preferred over raw place fields when present. */
  arrivalContext?: ArrivalContext;
  /** Structured departure context — preferred over raw place fields when present. */
  departureContext?: DepartureContext;
};

/** Optional multi-day tour / local-experience suggestion (AI or curated). */
export type TourSuggestion = {
  dayNumber?: number;
  title: string;
  description: string;
  needsBooking?: boolean;
};

export function createDefaultTravelTiming(): TravelTimingSettings {
  return {
    hotelCheckInTime: '15:00',
    dailyStartTime: '09:00',
    dailyEndTime: '21:00',
    arrivalContext: { type: 'already_in_area' },
    departureContext: { type: 'stay_in_area' },
  };
}

export function hasTravelTimingConstraints(timing?: TravelTimingSettings | null): boolean {
  if (!timing) return false;
  return Boolean(
    timing.arrivalTime?.trim() ||
      timing.departureTime?.trim() ||
      timing.hotelCheckInTime?.trim() ||
      timing.dailyStartTime?.trim() ||
      timing.dailyEndTime?.trim(),
  );
}

const AIRPORT_HINT =
  /空港|airport|flight|飛行機|フライト|関西空港|成田|羽田|仁川|金浦|伊丹|KIX|NRT|HND|ICN|GMP/i;
const STATION_HINT = /駅|station|新幹線|train|鉄道|新大阪|ソウル駅|東京駅/i;

function placeTypeToArrival(type?: TravelTimingPlaceType): ArrivalContextType | null {
  switch (type) {
    case '空港':
      return 'airport';
    case '駅':
      return 'station';
    case 'ホテル':
      return 'hotel';
    case '市内中心部':
      return 'already_in_area';
    case 'その他':
      return 'custom';
    default:
      return null;
  }
}

function placeTypeToDeparture(type?: TravelTimingPlaceType): DepartureContextType | null {
  switch (type) {
    case '空港':
      return 'airport';
    case '駅':
      return 'station';
    case 'ホテル':
      return 'hotel';
    case '市内中心部':
      return 'stay_in_area';
    case 'その他':
      return 'custom';
    default:
      return null;
  }
}

function inferFromText(text: string | undefined | null): 'airport' | 'station' | null {
  if (!text?.trim()) return null;
  if (AIRPORT_HINT.test(text)) return 'airport';
  if (STATION_HINT.test(text)) return 'station';
  return null;
}

/**
 * Resolve arrival context. Default when only a time is set: already_in_area
 * (do NOT assume airport).
 */
export function resolveArrivalContext(
  timing?: TravelTimingSettings | null,
  arrivalPoint?: string | null,
): ArrivalContext {
  if (timing?.arrivalContext?.type && timing.arrivalContext.type !== 'unknown') {
    return {
      type: timing.arrivalContext.type,
      label: timing.arrivalContext.label,
      time: timing.arrivalContext.time ?? timing.arrivalTime,
    };
  }

  const fromPlace = placeTypeToArrival(timing?.arrivalPlace);
  if (fromPlace) {
    return {
      type: fromPlace,
      label: timing?.arrivalPlaceDetail || timing?.arrivalPlace,
      time: timing?.arrivalTime,
    };
  }

  const inferred =
    inferFromText(arrivalPoint) ||
    inferFromText(timing?.arrivalPlaceDetail) ||
    inferFromText(timing?.arrivalPlace);
  if (inferred === 'airport') {
    return { type: 'airport', label: arrivalPoint ?? timing?.arrivalPlaceDetail, time: timing?.arrivalTime };
  }
  if (inferred === 'station') {
    return { type: 'station', label: arrivalPoint ?? timing?.arrivalPlaceDetail, time: timing?.arrivalTime };
  }

  return {
    type: timing?.arrivalTime?.trim() ? 'already_in_area' : 'unknown',
    time: timing?.arrivalTime,
  };
}

/**
 * Resolve departure context. Default when only a time is set: stay_in_area
 * (do NOT assume airport / 帰路).
 */
export function resolveDepartureContext(
  timing?: TravelTimingSettings | null,
  departurePoint?: string | null,
): DepartureContext {
  if (timing?.departureContext?.type && timing.departureContext.type !== 'unknown') {
    return {
      type: timing.departureContext.type,
      label: timing.departureContext.label,
      time: timing.departureContext.time ?? timing.departureTime,
    };
  }

  const fromPlace = placeTypeToDeparture(timing?.departurePlace);
  if (fromPlace) {
    return {
      type: fromPlace,
      label: timing?.departurePlaceDetail || timing?.departurePlace,
      time: timing?.departureTime,
    };
  }

  const inferred =
    inferFromText(departurePoint) ||
    inferFromText(timing?.departurePlaceDetail) ||
    inferFromText(timing?.departurePlace);
  if (inferred === 'airport') {
    return {
      type: 'airport',
      label: departurePoint ?? timing?.departurePlaceDetail,
      time: timing?.departureTime,
    };
  }
  if (inferred === 'station') {
    return {
      type: 'station',
      label: departurePoint ?? timing?.departurePlaceDetail,
      time: timing?.departureTime,
    };
  }

  return {
    type: timing?.departureTime?.trim() ? 'stay_in_area' : 'unknown',
    time: timing?.departureTime,
  };
}

export function isExplicitTransportHub(
  context: ArrivalContext | DepartureContext,
): context is ArrivalContext | DepartureContext & { type: 'airport' | 'station' } {
  return context.type === 'airport' || context.type === 'station';
}

/** Buffer before departure only when leaving via airport/station. */
export function departureTransferBufferMinutes(context: DepartureContext): number {
  if (context.type === 'airport') return 180;
  if (context.type === 'station') return 60;
  return 0;
}

/** Buffer after arrival only when arriving via airport/station. */
export function arrivalTransferBufferMinutes(context: ArrivalContext): number {
  if (context.type === 'airport') return 90;
  if (context.type === 'station') return 45;
  return 0;
}
