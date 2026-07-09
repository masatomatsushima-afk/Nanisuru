/**
 * Destination lock for MVP plan generation — works for ANY destination worldwide, not just a
 * fixed list of cities.
 *
 * Core idea ("destination lock"): whatever the user typed becomes the one and only allowed
 * travel area for that generation. We normalize it into a small, generic shape so prompts,
 * fallback plans, and post-generation checks can all refer to "the destination" without needing
 * to know anything specific about it. A tiny list of well-known cities is layered on top purely
 * as an optional quality boost (real neighborhood names for the fallback plan) — the app must
 * keep working correctly for destinations that are NOT in that list.
 */

export type DestinationScope = 'city' | 'country' | 'unknown';

export type NormalizedDestination = {
  /** Exactly what the user typed, trimmed. */
  originalInput: string;
  /** Human-friendly label for prompts/UI. May annotate country-only input, e.g. "韓国（ソウル中心）". */
  destinationLabel: string;
  /** Best-effort city name. Falls back to the raw input when unknown. */
  city: string;
  /** Best-effort country name, or null when unknown. */
  country: string | null;
  scope: DestinationScope;
  /** Internal key into the small optional quality-boost registry below, or null. */
  knownKey: KnownCityKey | null;
};

type KnownCityKey = 'tokyo' | 'osaka' | 'kyoto' | 'seoul' | 'melbourne' | 'sydney';

/** Broad place type — kept in sync with `ItineraryItem['category']` in `@/types/plan`. */
export type PlaceCategory = 'food' | 'cafe' | 'sightseeing' | 'shopping' | 'nightlife' | 'activity';

/** Kept in sync with `ItineraryItem['popularityType']` in `@/types/plan`. */
export type PopularityType = 'popular' | 'hidden_gem' | 'local' | 'classic' | 'fallback';

/**
 * A curated real neighborhood/landmark. `label` is what we show the user (may be Japanese);
 * `mapsName` is the specific, romanized/English name used to build a destination-scoped Google
 * Maps query (e.g. label "広蔵市場" -> mapsName "Gwangjang Market"). `category`/`popularityType`
 * let templates pick an area that actually matches the activity being built (e.g. never pair a
 * landmark-only spot with "でローカルグルメ").
 */
export type SafeArea = {
  label: string;
  mapsName: string;
  category: PlaceCategory;
  popularityType: PopularityType;
};

type KnownCityEntry = {
  key: KnownCityKey;
  country: string;
  city: string;
  /** Keywords (JP/EN) that identify this city from free-text input. */
  keywords: readonly string[];
  /** This city's own name variants — used to avoid banning a destination's own name. */
  ownMarkers: readonly string[];
  /**
   * Curated real neighborhood names — OPTIONAL quality boost for the fallback plan only. Not
   * required for the app to work: destinations without an entry here still get a safe, generic
   * fallback plan (see GENERIC_AREA_PHRASES).
   */
  safeAreas: readonly SafeArea[];
};

/**
 * Small optional registry — improves fallback plan quality for a handful of well-known cities.
 * This is NOT the mechanism that makes destination-lock work; it must stay small and additive.
 */
const KNOWN_CITY_REGISTRY: readonly KnownCityEntry[] = [
  {
    key: 'tokyo',
    country: 'Japan',
    city: 'Tokyo',
    keywords: ['tokyo', '東京', '渋谷', '新宿', '浅草', '銀座', '原宿', '表参道', '六本木', '上野', '秋葉原'],
    ownMarkers: ['tokyo', '東京'],
    safeAreas: [
      { label: '渋谷', mapsName: 'Shibuya', category: 'shopping', popularityType: 'popular' },
      { label: '原宿', mapsName: 'Harajuku', category: 'shopping', popularityType: 'popular' },
      { label: '表参道', mapsName: 'Omotesando', category: 'cafe', popularityType: 'popular' },
      { label: '新宿', mapsName: 'Shinjuku', category: 'nightlife', popularityType: 'popular' },
      { label: '浅草', mapsName: 'Asakusa', category: 'sightseeing', popularityType: 'classic' },
      { label: '上野', mapsName: 'Ueno', category: 'food', popularityType: 'classic' },
      { label: '銀座', mapsName: 'Ginza', category: 'shopping', popularityType: 'classic' },
      { label: '代官山', mapsName: 'Daikanyama', category: 'cafe', popularityType: 'hidden_gem' },
      { label: '下北沢', mapsName: 'Shimokitazawa', category: 'shopping', popularityType: 'local' },
      { label: '吉祥寺', mapsName: 'Kichijoji', category: 'cafe', popularityType: 'local' },
    ],
  },
  {
    key: 'osaka',
    country: 'Japan',
    city: 'Osaka',
    keywords: ['osaka', '大阪', '道頓堀', '心斎橋', '梅田', '通天閣', '難波', 'usj', '中崎町', '天王寺'],
    ownMarkers: ['osaka', '大阪'],
    safeAreas: [
      { label: '梅田', mapsName: 'Umeda', category: 'shopping', popularityType: 'popular' },
      { label: '難波', mapsName: 'Namba', category: 'nightlife', popularityType: 'popular' },
      { label: '心斎橋', mapsName: 'Shinsaibashi', category: 'shopping', popularityType: 'popular' },
      { label: '道頓堀', mapsName: 'Dotonbori', category: 'food', popularityType: 'popular' },
      { label: '中崎町', mapsName: 'Nakazakicho', category: 'cafe', popularityType: 'hidden_gem' },
      { label: '天王寺', mapsName: 'Tennoji', category: 'sightseeing', popularityType: 'classic' },
      { label: '新世界', mapsName: 'Shinsekai', category: 'food', popularityType: 'local' },
      { label: '大阪城公園', mapsName: 'Osaka Castle Park', category: 'sightseeing', popularityType: 'classic' },
      { label: '堀江', mapsName: 'Horie', category: 'shopping', popularityType: 'hidden_gem' },
      { label: '福島', mapsName: 'Fukushima', category: 'food', popularityType: 'local' },
    ],
  },
  {
    key: 'kyoto',
    country: 'Japan',
    city: 'Kyoto',
    keywords: ['kyoto', '京都'],
    ownMarkers: ['kyoto', '京都'],
    safeAreas: [],
  },
  {
    key: 'seoul',
    country: 'Korea',
    city: 'Seoul',
    keywords: ['seoul', 'ソウル', 'korea', '韓国', '明洞', '江南', '弘大', '梨泰院'],
    ownMarkers: ['seoul', 'ソウル', 'korea', '韓国'],
    safeAreas: [
      { label: '明洞', mapsName: 'Myeongdong', category: 'shopping', popularityType: 'popular' },
      { label: '弘大', mapsName: 'Hongdae', category: 'nightlife', popularityType: 'popular' },
      { label: '聖水', mapsName: 'Seongsu', category: 'cafe', popularityType: 'hidden_gem' },
      { label: '益善洞', mapsName: 'Ikseondong', category: 'food', popularityType: 'local' },
      { label: '景福宮', mapsName: 'Gyeongbokgung Palace', category: 'sightseeing', popularityType: 'classic' },
      { label: '北村韓屋村', mapsName: 'Bukchon Hanok Village', category: 'sightseeing', popularityType: 'classic' },
      { label: '広蔵市場', mapsName: 'Gwangjang Market', category: 'food', popularityType: 'popular' },
      { label: '南大門市場', mapsName: 'Namdaemun Market', category: 'food', popularityType: 'classic' },
      { label: '南山ソウルタワー', mapsName: 'N Seoul Tower', category: 'sightseeing', popularityType: 'popular' },
      { label: '漢江公園', mapsName: 'Hangang Park', category: 'activity', popularityType: 'popular' },
      { label: '東大門', mapsName: 'Dongdaemun', category: 'shopping', popularityType: 'popular' },
      { label: '江南', mapsName: 'Gangnam', category: 'nightlife', popularityType: 'popular' },
      { label: '梨泰院', mapsName: 'Itaewon', category: 'nightlife', popularityType: 'local' },
    ],
  },
  {
    key: 'melbourne',
    country: 'Australia',
    city: 'Melbourne',
    keywords: ['melbourne', 'メルボルン', 'victoria', 'vic'],
    ownMarkers: ['melbourne', 'メルボルン'],
    safeAreas: [
      { label: 'CBD', mapsName: 'Melbourne CBD', category: 'shopping', popularityType: 'popular' },
      { label: 'Fitzroy', mapsName: 'Fitzroy', category: 'cafe', popularityType: 'hidden_gem' },
      { label: 'Carlton', mapsName: 'Carlton', category: 'food', popularityType: 'local' },
      { label: 'Southbank', mapsName: 'Southbank', category: 'sightseeing', popularityType: 'popular' },
      { label: 'St Kilda', mapsName: 'St Kilda', category: 'activity', popularityType: 'popular' },
      { label: 'South Yarra', mapsName: 'South Yarra', category: 'shopping', popularityType: 'popular' },
      { label: 'Queen Victoria Market', mapsName: 'Queen Victoria Market', category: 'food', popularityType: 'popular' },
      { label: 'Docklands', mapsName: 'Docklands', category: 'sightseeing', popularityType: 'classic' },
      { label: 'Richmond', mapsName: 'Richmond', category: 'food', popularityType: 'local' },
      { label: 'Collingwood', mapsName: 'Collingwood', category: 'nightlife', popularityType: 'hidden_gem' },
    ],
  },
  {
    key: 'sydney',
    country: 'Australia',
    city: 'Sydney',
    keywords: ['sydney', 'シドニー', 'nsw', 'bondi'],
    ownMarkers: ['sydney', 'シドニー'],
    safeAreas: [
      { label: 'Circular Quay', mapsName: 'Circular Quay', category: 'sightseeing', popularityType: 'popular' },
      { label: 'The Rocks', mapsName: 'The Rocks', category: 'sightseeing', popularityType: 'classic' },
      { label: 'Darling Harbour', mapsName: 'Darling Harbour', category: 'activity', popularityType: 'popular' },
      { label: 'Bondi Beach', mapsName: 'Bondi Beach', category: 'activity', popularityType: 'popular' },
      { label: 'Surry Hills', mapsName: 'Surry Hills', category: 'cafe', popularityType: 'hidden_gem' },
      { label: 'Newtown', mapsName: 'Newtown', category: 'food', popularityType: 'local' },
      { label: 'Manly', mapsName: 'Manly', category: 'activity', popularityType: 'classic' },
      { label: 'Sydney Opera House area', mapsName: 'Sydney Opera House', category: 'sightseeing', popularityType: 'popular' },
      { label: 'Barangaroo', mapsName: 'Barangaroo', category: 'nightlife', popularityType: 'popular' },
      { label: 'Paddington', mapsName: 'Paddington', category: 'shopping', popularityType: 'hidden_gem' },
    ],
  },
];

/** Country-only input (no specific city) resolves to a representative city for MVP purposes. */
const COUNTRY_ONLY_DEFAULTS: Record<string, KnownCityKey> = {
  japan: 'tokyo',
  日本: 'tokyo',
  korea: 'seoul',
  韓国: 'seoul',
  australia: 'melbourne',
  オーストラリア: 'melbourne',
  豪州: 'melbourne',
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function findKnownEntryByKeyword(normalized: string): KnownCityEntry | null {
  for (const entry of KNOWN_CITY_REGISTRY) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return entry;
    }
  }
  return null;
}

/**
 * Normalizes any user-typed destination into a generic { city, country, scope } shape.
 * Never throws and never requires the destination to be "known" — unknown destinations are
 * handled explicitly via scope: 'unknown' and are just as usable as known ones.
 */
export function normalizeDestination(rawLocation: string | undefined | null): NormalizedDestination {
  const originalInput = (rawLocation ?? '').trim();
  if (!originalInput) {
    return {
      originalInput,
      destinationLabel: '',
      city: '',
      country: null,
      scope: 'unknown',
      knownKey: null,
    };
  }

  const normalized = normalizeText(originalInput);

  const directMatch = findKnownEntryByKeyword(normalized);
  if (directMatch) {
    return {
      originalInput,
      destinationLabel: originalInput,
      city: directMatch.city,
      country: directMatch.country,
      scope: 'city',
      knownKey: directMatch.key,
    };
  }

  const countryOnlyKey = COUNTRY_ONLY_DEFAULTS[normalized];
  if (countryOnlyKey) {
    const entry = KNOWN_CITY_REGISTRY.find((candidate) => candidate.key === countryOnlyKey)!;
    return {
      originalInput,
      destinationLabel: `${originalInput}（${entry.city}中心）`,
      city: entry.city,
      country: entry.country,
      scope: 'country',
      knownKey: entry.key,
    };
  }

  // Unknown destination: still fully usable — everything downstream treats `city`/`destinationLabel`
  // as plain text and never requires a registry match.
  return {
    originalInput,
    destinationLabel: originalInput,
    city: originalInput,
    country: null,
    scope: 'unknown',
    knownKey: null,
  };
}

/** Curated safe areas for the destination (optional quality boost — may be empty). */
export function getSafeAreasForDestination(normalized: NormalizedDestination): SafeArea[] {
  const entry = KNOWN_CITY_REGISTRY.find((candidate) => candidate.key === normalized.knownKey);
  return entry ? [...entry.safeAreas] : [];
}

/**
 * Curated safe areas that actually match the requested place type (e.g. only `food` areas for a
 * lunch/dinner slot), so a template never pairs a landmark-only spot with "でローカルグルメ" just
 * because it was next in an unfiltered rotation. Falls back to the full list for the destination
 * when nothing matches that category, so rotation never breaks for destinations with lighter
 * category coverage.
 */
export function getSafeAreasForDestinationByCategory(
  normalized: NormalizedDestination,
  category: PlaceCategory,
): SafeArea[] {
  const all = getSafeAreasForDestination(normalized);
  const matching = all.filter((area) => area.category === category);
  return matching.length > 0 ? matching : all;
}

/**
 * The text every Google Maps / social search query for this destination must ultimately contain,
 * e.g. "Seoul Korea" for a known city, or just the raw user input for an unrecognized one. Always
 * returns a non-empty string when the destination itself is non-empty.
 */
export function buildDestinationMapsSuffix(normalized: NormalizedDestination): string {
  const entry = KNOWN_CITY_REGISTRY.find((candidate) => candidate.key === normalized.knownKey);
  if (entry) return `${entry.city} ${entry.country}`;
  return normalized.city || normalized.originalInput;
}

/**
 * Builds a specific, destination-scoped Google Maps query for a curated safe area, e.g.
 * "Gwangjang Market Seoul Korea". This is what makes the fallback plan's map links resolve to the
 * actual destination instead of the device's current location.
 */
export function buildSafeAreaMapsQuery(area: SafeArea, normalized: NormalizedDestination): string {
  const suffix = buildDestinationMapsSuffix(normalized);
  return suffix ? `${area.mapsName} ${suffix}` : area.mapsName;
}

/**
 * Guarantees a maps/social search query is scoped to the requested destination. If the query
 * doesn't already mention the destination, the destination is appended — this is the hard
 * backstop that prevents "地元の市場散策" style abstract queries from resolving near the user's
 * current location instead of the actual travel destination.
 */
export function enforceDestinationScopedQuery(
  rawQuery: string | undefined | null,
  normalized: NormalizedDestination,
): string {
  const suffix = buildDestinationMapsSuffix(normalized);
  const trimmed = (rawQuery ?? '').trim();

  if (!suffix) return trimmed;
  if (!trimmed) return suffix;

  const lowerTrimmed = trimmed.toLowerCase();
  const suffixTokens = suffix.toLowerCase().split(/\s+/).filter(Boolean);
  const alreadyScoped = suffixTokens.length > 0 && suffixTokens.every((token) => lowerTrimmed.includes(token));

  return alreadyScoped ? trimmed : `${trimmed} ${suffix}`;
}

/**
 * Convenience wrapper for callers that only have a raw location string (e.g. UI components
 * opening a Maps link), not a pre-normalized destination.
 */
export function scopeMapsQueryToLocation(
  rawQuery: string | undefined | null,
  rawLocation: string | undefined | null,
): string {
  const normalized = normalizeDestination(rawLocation);
  if (!normalized.destinationLabel) return (rawQuery ?? '').trim();
  return enforceDestinationScopedQuery(rawQuery, normalized);
}

function genericMapsQueryTerm(kind: GenericAreaPhraseKind): string {
  switch (kind) {
    case 'stroll':
      return '中心部 散策';
    case 'cafe':
      return 'カフェ';
    case 'market':
      return '市場 商店街';
    case 'night':
      return '夜景 スポット';
    case 'dinner':
      return 'レストラン ディナー';
    case 'lunch':
      return 'ランチ';
    case 'shopping':
      return 'ショッピング お土産';
    case 'culture':
      return '観光 文化体験';
  }
}

/**
 * Safe, destination-scoped map query for abstract/generic items (no curated safe area available).
 * Never invents a place name — it always resolves to the destination itself plus a generic
 * activity term, so it can never accidentally match somewhere near the device's current location.
 */
export function genericMapsQuery(normalized: NormalizedDestination, kind: GenericAreaPhraseKind): string {
  const base = `${normalized.destinationLabel} ${genericMapsQueryTerm(kind)}`.trim();
  return enforceDestinationScopedQuery(base, normalized);
}

/**
 * Minimal, hand-picked list of city/region names that are the most common source of
 * cross-destination contamination in practice. This is intentionally NOT an exhaustive
 * world-city blocklist — it's a lightweight safety net on top of the prompt rules and destination
 * lock, not the primary mechanism.
 */
const MINIMAL_CROSS_DESTINATION_MARKERS: readonly string[] = [
  'osaka', '大阪', 'umeda', '梅田', 'namba', '難波', 'dotonbori', '道頓堀', '心斎橋',
  'tokyo', '東京', 'shibuya', '渋谷', 'shinjuku', '新宿', 'asakusa', '浅草',
  'kyoto', '京都',
  'seoul', 'ソウル', 'korea', '韓国',
  'melbourne', 'メルボルン',
  'sydney', 'シドニー',
];

/**
 * Keywords that must not appear in this destination's plan. Always excludes any marker that is
 * part of the destination's own name, so e.g. an Osaka trip never bans "大阪"/"osaka".
 */
export function getBannedKeywordsForDestination(normalized: NormalizedDestination): string[] {
  const ownEntry = KNOWN_CITY_REGISTRY.find((candidate) => candidate.key === normalized.knownKey);
  const ownMarkers = new Set((ownEntry?.ownMarkers ?? []).map((marker) => marker.toLowerCase()));
  const inputLower = normalized.originalInput.toLowerCase();

  return MINIMAL_CROSS_DESTINATION_MARKERS.filter((marker) => {
    const lower = marker.toLowerCase();
    if (ownMarkers.has(lower)) return false;
    if (inputLower.includes(lower)) return false;
    return true;
  });
}

function textContainsBannedKeyword(text: string | undefined | null, bannedKeywords: string[]): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return bannedKeywords.some((keyword) => normalized.includes(keyword));
}

/**
 * Short, strict prompt block telling the AI exactly which destination is locked in. Deliberately
 * destination-agnostic wording — works the same for Fukuoka, Paris, Bangkok, or an unrecognized
 * small town, not just the cities in KNOWN_CITY_REGISTRY.
 */
export function buildDestinationPromptRules(normalized: NormalizedDestination): string {
  if (!normalized.originalInput) return '';

  return [
    `【destination lock】目的地は「${normalized.destinationLabel}」に固定。この旅行全体でこのエリア以外の場所は一切提案しないこと。`,
    'You must only suggest places inside the requested destination. Never mix another city, country, or region.',
    'If you are not sure a specific venue exists in the destination, use a general area or activity description instead of inventing a place name.',
    'Do not invent fake restaurants or landmarks.',
    '目的地が小都市・地方都市・馴染みの薄い場所であっても、実在するか確信の持てる範囲で役立つプランにすること（無理に有名観光地に寄せない）。',
  ].join('\n');
}

export type GenericAreaPhraseKind =
  | 'stroll'
  | 'cafe'
  | 'market'
  | 'night'
  | 'dinner'
  | 'lunch'
  | 'shopping'
  | 'culture';

/** The `category` a generic/curated spot of this kind should carry on the itinerary item. */
export function categoryForGenericKind(kind: GenericAreaPhraseKind): PlaceCategory {
  switch (kind) {
    case 'lunch':
    case 'dinner':
    case 'market':
      return 'food';
    case 'cafe':
      return 'cafe';
    case 'night':
      return 'nightlife';
    case 'shopping':
      return 'shopping';
    case 'culture':
      return 'sightseeing';
    case 'stroll':
      return 'activity';
  }
}

/** Generic, destination-label-based phrases usable for ANY destination, known or not. */
export function genericAreaPhrase(destinationLabel: string, kind: GenericAreaPhraseKind): string {
  switch (kind) {
    case 'stroll':
      return `${destinationLabel}中心部を散策`;
    case 'cafe':
      return `${destinationLabel}のローカルカフェで休憩`;
    case 'market':
      return `${destinationLabel}の市場・商店街エリアを楽しむ`;
    case 'night':
      return `${destinationLabel}の夜景・川沿い・メインエリアを散策`;
    case 'dinner':
      return `${destinationLabel}らしい夕食を楽しむ`;
    case 'lunch':
      return `${destinationLabel}らしいランチを楽しむ`;
    case 'shopping':
      return `${destinationLabel}でお土産・ショッピングを楽しむ`;
    case 'culture':
      return `${destinationLabel}の文化・体験スポットを楽しむ`;
  }
}

export type DestinationSanitizeResult<Day extends { items: Array<Record<string, unknown>> }> = {
  days: Day[];
  wasModified: boolean;
  needsFullFallback: boolean;
};

type SanitizableItem = {
  activity: string;
  placeAddress?: string;
  reason?: string;
  mapsQuery?: string;
  socialQuery?: string;
  isSpecificPlace?: boolean;
  placeName?: string;
  category?: PlaceCategory;
  popularityType?: PopularityType;
  confidence?: 'high' | 'medium' | 'low';
  [key: string]: unknown;
};

type SanitizableDay = {
  items: SanitizableItem[];
  [key: string]: unknown;
};

const REPLACEMENT_KINDS = ['stroll', 'cafe', 'market', 'night', 'dinner'] as const;

/** Phrasing that matches the replacement kind, so a food-market spot never reads as a generic "stroll". */
function replacementActivityForArea(area: SafeArea, kind: (typeof REPLACEMENT_KINDS)[number]): string {
  switch (kind) {
    case 'cafe':
      return `${area.label}のカフェで休憩`;
    case 'market':
      return `${area.label}でローカルグルメ`;
    case 'night':
      return `${area.label}で夜景を楽しむ`;
    case 'dinner':
      return `${area.label}でディナー`;
    case 'stroll':
      return `${area.label}周辺を散策`;
  }
}

function buildQueryFromItemText(item: SanitizableItem): string {
  const name = typeof item.activity === 'string' ? item.activity.trim() : '';
  const address = typeof item.placeAddress === 'string' ? item.placeAddress.trim() : '';
  return [name, address].filter(Boolean).join(' ');
}

/**
 * Removes/replaces itinerary items that reference a different city/country than the requested
 * destination, and guarantees every item (replaced or not) carries a destination-scoped
 * mapsQuery/socialQuery. Works for any destination: known cities get a real-neighborhood
 * substitute (quality boost) with a specific English mapsQuery, unknown destinations get a safe
 * generic substitute built from the destination label — items are never simply invented from an
 * unrelated fixed city list, and search links can never resolve near the device's current
 * location instead of the destination.
 */
export function sanitizeItineraryForDestination<Day extends SanitizableDay>(
  days: Day[],
  rawLocation: string | undefined | null,
): DestinationSanitizeResult<Day> {
  const normalized = normalizeDestination(rawLocation);

  if (!normalized.destinationLabel) {
    return { days, wasModified: false, needsFullFallback: true };
  }

  const bannedKeywords = getBannedKeywordsForDestination(normalized);

  let wasModified = false;
  let genericCursor = 0;
  const areaCursorByCategory = new Map<PlaceCategory, number>();

  const buildReplacement = (item: SanitizableItem): SanitizableItem => {
    const kind = REPLACEMENT_KINDS[genericCursor % REPLACEMENT_KINDS.length];
    genericCursor += 1;
    const category = categoryForGenericKind(kind);
    // Only pick from areas that actually match this slot's category, so a replacement never pairs
    // e.g. a landmark-only safe area with "でローカルグルメ".
    const areasForKind = getSafeAreasForDestinationByCategory(normalized, category);

    if (areasForKind.length > 0) {
      const cursor = areaCursorByCategory.get(category) ?? 0;
      const area = areasForKind[cursor % areasForKind.length];
      areaCursorByCategory.set(category, cursor + 1);
      const mapsQuery = buildSafeAreaMapsQuery(area, normalized);
      return {
        ...item,
        activity: replacementActivityForArea(area, kind),
        placeAddress: area.label,
        placeName: area.label,
        category: area.category,
        popularityType: area.popularityType,
        confidence: 'high',
        reason: '目的地内の安全なエリアに置き換えました。',
        mapsQuery,
        socialQuery: mapsQuery,
        isSpecificPlace: true,
      };
    }

    const mapsQuery = genericMapsQuery(normalized, kind);
    return {
      ...item,
      activity: genericAreaPhrase(normalized.destinationLabel, kind),
      placeAddress: normalized.destinationLabel,
      placeName: undefined,
      category,
      popularityType: 'fallback',
      confidence: 'low',
      reason: '目的地内の安全な内容に置き換えました。',
      mapsQuery,
      socialQuery: mapsQuery,
      isSpecificPlace: false,
    };
  };

  /** Applied to every non-replaced item: keeps whatever the AI provided, but always scopes it to the destination. */
  const enforceMapsFields = (item: SanitizableItem): SanitizableItem => {
    const baseMapsQuery = item.mapsQuery?.trim() || buildQueryFromItemText(item);
    const scopedMapsQuery = enforceDestinationScopedQuery(baseMapsQuery, normalized);
    const scopedSocialQuery = item.socialQuery?.trim()
      ? enforceDestinationScopedQuery(item.socialQuery, normalized)
      : scopedMapsQuery;

    return {
      ...item,
      mapsQuery: scopedMapsQuery,
      socialQuery: scopedSocialQuery,
      isSpecificPlace:
        typeof item.isSpecificPlace === 'boolean'
          ? item.isSpecificPlace
          : Boolean(item.placeName?.trim()),
      confidence: item.confidence ?? (item.placeName?.trim() ? 'medium' : 'low'),
    };
  };

  const sanitizedDays = days.map((day) => {
    const processedItems: SanitizableItem[] = [];
    let dayWasModified = false;

    for (const item of day.items) {
      const isContaminated =
        bannedKeywords.length > 0 &&
        (textContainsBannedKeyword(item.activity, bannedKeywords) ||
          textContainsBannedKeyword(item.placeAddress, bannedKeywords) ||
          textContainsBannedKeyword(item.reason, bannedKeywords));

      if (isContaminated) {
        dayWasModified = true;
        processedItems.push(buildReplacement(item));
        continue;
      }

      processedItems.push(enforceMapsFields(item));
    }

    if (dayWasModified) wasModified = true;
    return { ...day, items: processedItems };
  });

  return { days: sanitizedDays, wasModified, needsFullFallback: false };
}
