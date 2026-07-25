import { normalizeUserInput } from '@/lib/normalize-user-input';
import type { NormalizedDestination } from '@/lib/destination-safety';
import { normalizeDestination } from '@/lib/destination-safety';

export type DestinationDetailFields = {
  country?: string | null;
  city?: string | null;
  baseArea?: string | null;
  accommodation?: string | null;
  arrivalPoint?: string | null;
  /** Legacy single-line destination (行き先) — used when structured fields are empty. */
  legacyLocation?: string | null;
};

export type ResolvedDestinationDetails = {
  country?: string;
  city?: string;
  baseArea?: string;
  accommodation?: string;
  arrivalPoint?: string;
  destinationLabel: string;
  /** Primary destination string for API / normalizeDestination. */
  effectiveLocation: string;
};

export const COUNTRY_SUGGESTIONS = ['日本', '韓国', 'フランス', 'オーストラリア'] as const;

const BASE_AREA_BY_CITY: Record<string, readonly string[]> = {
  大阪: ['難波', '梅田', '心斎橋', '天王寺', '新大阪'],
  osaka: ['難波', '梅田', '心斎橋', '天王寺', '新大阪'],
  ソウル: ['明洞', '弘大', '聖水', '江南', '梨泰院', '東大門'],
  seoul: ['明洞', '弘大', '聖水', '江南', '梨泰院', '東大門'],
  福岡: ['博多', '天神', '中洲'],
  fukuoka: ['博多', '天神', '中洲'],
  東京: ['渋谷', '新宿', '銀座', '浅草', '上野'],
  tokyo: ['渋谷', '新宿', '銀座', '浅草', '上野'],
  paris: ['マレ', 'サンジェルマン', 'モンマルトル', 'オペラ', 'バスティーユ'],
  パリ: ['マレ', 'サンジェルマン', 'モンマルトル', 'オペラ', 'バスティーユ'],
  melbourne: ['CBD', 'フィッツロイ', 'サウスバンク', 'セントキルダ'],
  メルボルン: ['CBD', 'フィッツロイ', 'サウスバンク', 'セントキルダ'],
};

const ARRIVAL_BY_CITY: Record<string, readonly string[]> = {
  ソウル: ['仁川空港', '金浦空港', 'ソウル駅'],
  seoul: ['仁川空港', '金浦空港', 'ソウル駅'],
  大阪: ['関西空港', '新大阪駅', '伊丹空港'],
  osaka: ['関西空港', '新大阪駅', '伊丹空港'],
  福岡: ['福岡空港', '博多駅'],
  fukuoka: ['福岡空港', '博多駅'],
  東京: ['成田空港', '羽田空港', '東京駅'],
  tokyo: ['成田空港', '羽田空港', '東京駅'],
  paris: ['シャルル・ド・ゴール空港', 'オルリー空港', 'Gare du Nord'],
  パリ: ['シャルル・ド・ゴール空港', 'オルリー空港', 'Gare du Nord'],
  melbourne: ['メルボルン空港', 'Southern Cross Station'],
  メルボルン: ['メルボルン空港', 'Southern Cross Station'],
};

function lookupSuggestions(map: Record<string, readonly string[]>, city: string): string[] {
  const trimmed = city.trim();
  if (!trimmed) return [];
  const direct = map[trimmed] ?? map[trimmed.toLowerCase()];
  return direct ? [...direct] : [];
}

export function getBaseAreaSuggestions(city: string): string[] {
  return lookupSuggestions(BASE_AREA_BY_CITY, city);
}

export function getArrivalPointSuggestions(city: string): string[] {
  return lookupSuggestions(ARRIVAL_BY_CITY, city);
}

/** Build human-readable destinationLabel from structured fields. */
export function buildDestinationLabel(fields: {
  country?: string;
  city?: string;
  baseArea?: string;
}): string {
  const country = fields.country?.trim();
  const city = fields.city?.trim();
  const baseArea = fields.baseArea?.trim();

  if (country && city && baseArea) return `${country}・${city}（${baseArea}拠点）`;
  if (country && city) return `${country}・${city}`;
  if (city && baseArea) return `${city}（${baseArea}拠点）`;
  if (country && baseArea) return `${country}（${baseArea}拠点）`;
  if (country) return country;
  if (city) return city;
  if (baseArea) return baseArea;
  return '';
}

export function resolveDestinationDetails(fields: DestinationDetailFields): ResolvedDestinationDetails {
  const country = normalizeUserInput(fields.country ?? '');
  const city = normalizeUserInput(fields.city ?? '');
  const baseArea = normalizeUserInput(fields.baseArea ?? '');
  const accommodation = normalizeUserInput(fields.accommodation ?? '');
  const arrivalPoint = normalizeUserInput(fields.arrivalPoint ?? '');
  const legacyLocation = normalizeUserInput(fields.legacyLocation ?? '');

  const structuredLabel = buildDestinationLabel({ country, city, baseArea });
  const destinationLabel = structuredLabel || legacyLocation;

  return {
    country: country || undefined,
    city: city || undefined,
    baseArea: baseArea || undefined,
    accommodation: accommodation || undefined,
    arrivalPoint: arrivalPoint || undefined,
    destinationLabel,
    effectiveLocation: destinationLabel,
  };
}

export function resolveDestinationDetailsFromPlanInput(input: {
  location?: string;
  country?: string;
  city?: string;
  baseArea?: string;
  accommodation?: string;
  arrivalPoint?: string;
  destinationLabel?: string;
}): ResolvedDestinationDetails {
  const fromFields = resolveDestinationDetails({
    country: input.country,
    city: input.city,
    baseArea: input.baseArea,
    accommodation: input.accommodation,
    arrivalPoint: input.arrivalPoint,
    legacyLocation: input.location,
  });

  if (input.destinationLabel?.trim() && !fromFields.destinationLabel) {
    return {
      ...fromFields,
      destinationLabel: input.destinationLabel.trim(),
      effectiveLocation: input.destinationLabel.trim(),
    };
  }

  return fromFields;
}

/** Merge user-provided structured fields with normalizeDestination heuristics. */
export function normalizeDestinationFromDetails(
  details: ResolvedDestinationDetails,
): NormalizedDestination {
  const base = normalizeDestination(details.effectiveLocation);
  if (!details.effectiveLocation) return base;

  return {
    ...base,
    originalInput: details.effectiveLocation,
    destinationLabel: details.destinationLabel || base.destinationLabel,
    city: details.city || base.city,
    country: details.country || base.country,
    scope: details.city ? 'city' : base.scope,
  };
}

export function destinationDetailsToPayload(details: ResolvedDestinationDetails) {
  return {
    country: details.country,
    city: details.city,
    baseArea: details.baseArea,
    accommodation: details.accommodation,
    arrivalPoint: details.arrivalPoint,
    destinationLabel: details.destinationLabel,
  };
}

/** Prompt block for baseArea / accommodation / arrivalPoint routing rules. */
export function buildDestinationDetailPromptSection(
  details: ResolvedDestinationDetails,
): string | null {
  const lines: string[] = [];

  if (details.destinationLabel) {
    lines.push(
      `【destinationLabel・最優先】Use "${details.destinationLabel}" as the primary destination identity for this entire plan.`,
      'Never treat country-only scope when city or baseArea is provided — lock spots to the specified city.',
    );
  }

  if (details.country) lines.push(`国・地域: ${details.country}`);
  if (details.city) {
    lines.push(
      `都市: ${details.city}`,
      `【city lock】Only suggest spots inside ${details.city}. Do not add attractions from other cities in the same country or region.`,
    );
  }
  if (details.baseArea) {
    lines.push(
      `拠点エリア: ${details.baseArea}`,
      `【baseArea hub】When baseArea is set, mornings and evenings should stay easy to return to ${details.baseArea}. Cluster nearby neighborhoods on the same day; put farther areas (e.g. other districts) on separate days to avoid wasteful round trips.`,
      `【拠点ロック】Do not send the traveler to airports, distant stations, or far districts (e.g. Umeda when base is Namba) unless the user explicitly selected them.`,
    );
  }
  if (details.accommodation) {
    lines.push(
      `宿泊先: ${details.accommodation}`,
      `【accommodation hub】Treat accommodation as daily start/end point — not the user's GPS. Begin near it in the morning; end evenings where returning is easy.`,
    );
  }
  if (details.arrivalPoint) {
    lines.push(
      `到着場所: ${details.arrivalPoint}`,
      `【arrivalPoint・day 1】On day 1, order activities starting from ${details.arrivalPoint} with logical transfer toward baseArea/accommodation. Respect arrivalTime as plan-start preference (not necessarily a flight landing).`,
    );
  } else {
    lines.push(
      '【帰路・到着・禁止】arrivalPoint / return transport is NOT specified. Do NOT invent airport transfers, 「空港到着目安」, or flight-based logistics. End the day near baseArea/accommodation.',
    );
  }

  if (details.city || details.country || details.baseArea) {
    const mapsParts = [details.baseArea, details.city, details.country].filter(Boolean);
    lines.push(
      `【mapsQuery scope】Every mapsQuery must include destination context: ${mapsParts.join(' / ') || details.destinationLabel}. Never use country alone when city/baseArea are known.`,
      'Minimize wasteful back-and-forth movement across the trip.',
    );
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

/** Compact display lines for Plan Detail header. */
export function buildDestinationDetailDisplayLines(details: ResolvedDestinationDetails): string[] {
  const lines: string[] = [];

  const destinationLine =
    details.country && details.city
      ? `${details.country}・${details.city}`
      : details.destinationLabel || details.city || details.country;

  if (destinationLine) lines.push(`目的地：${destinationLine}`);
  if (details.baseArea) lines.push(`拠点：${details.baseArea}`);
  if (details.accommodation) lines.push(`宿泊先：${details.accommodation}`);
  if (details.arrivalPoint) lines.push(`到着場所：${details.arrivalPoint}`);

  return lines;
}
