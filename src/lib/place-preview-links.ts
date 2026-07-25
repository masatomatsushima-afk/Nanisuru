/**
 * Safe Instagram / TikTok / Google Images search links for itinerary spots.
 * Never open weak queries (name-only / area-only / abstract titles) or broken URLs.
 */

import type { ItineraryItem } from '@/types/plan';

const BROKEN_TOKEN_PATTERN = /(?:^|[^\w])(?:undefined|null|NaN|invalid)(?:$|[^\w])/i;

const ABSTRACT_QUERY_PATTERNS: RegExp[] = [
  /人気カフェ/,
  /市場を散策/,
  /美しい公園/,
  /自由時間/,
  /エリア散策/,
  /周辺を散策/,
  /買い物スポット/,
  /韓国料理ディナー/,
  /UI確認|テスト用/,
  /^(カフェ|ランチ|ディナー|散策|観光)$/i,
];

export type SocialDestinationContext = {
  /** Full trip location string, e.g. "ソウル, 韓国" */
  location?: string;
  city?: string;
  country?: string;
  area?: string;
};

export type SocialLinkType = 'instagram' | 'tiktok' | 'google_images';

export type SafeSocialLinks = {
  query: string;
  instagram: string;
  tiktok: string;
  googleImages: string;
};

function cleanToken(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^(undefined|null|nan|invalid)$/i.test(text)) return null;
  if (BROKEN_TOKEN_PATTERN.test(text)) return null;
  return text;
}

function dedupeJoin(parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const cleaned = cleanToken(part);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out.join(' ').trim();
}

/** Split "ソウル, 韓国" / "Seoul, Korea" into city + country hints. */
export function parseLocationCityCountry(location?: string): {
  city?: string;
  country?: string;
} {
  const cleaned = cleanToken(location);
  if (!cleaned) return {};
  const parts = cleaned.split(/[,/|、]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts[parts.length - 1] };
  }
  if (/韓国|Korea|日本|Japan|台湾|Taiwan|タイ|Thailand/i.test(cleaned)) {
    return { country: cleaned };
  }
  return { city: cleaned };
}

function looksAbstractQuery(query: string): boolean {
  return ABSTRACT_QUERY_PATTERNS.some((re) => re.test(query));
}

/**
 * A social query is "strong" only when it has a concrete place signal
 * plus destination scope (area/city/country), and is not a single weak token.
 */
export function isSafeSocialQuery(query: string | null | undefined): boolean {
  const cleaned = cleanToken(query);
  if (!cleaned) return false;
  if (BROKEN_TOKEN_PATTERN.test(cleaned)) return false;
  if (looksAbstractQuery(cleaned)) return false;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;

  if (tokens.length === 2) {
    const hasGeoHint = tokens.some((t) =>
      /seoul|korea|tokyo|japan|osaka|fukuoka|busan|ソウル|韓国|東京|日本|大阪|福岡|釜山/i.test(t),
    );
    if (!hasGeoHint) return false;
  }

  return true;
}

function resolveArea(item: ItineraryItem, context?: SocialDestinationContext): string | null {
  return cleanToken(context?.area) || cleanToken(item.placeAddress) || null;
}

function resolveCityCountry(
  item: ItineraryItem,
  context?: SocialDestinationContext,
): { city: string | null; country: string | null } {
  const fromLocation = parseLocationCityCountry(context?.location);
  const city = cleanToken(context?.city) || cleanToken(fromLocation.city) || null;
  const country = cleanToken(context?.country) || cleanToken(fromLocation.country) || null;
  return { city, country };
}

/**
 * Priority:
 * 1) placeName + area + city + country
 * 2) mapsQuery (when already destination-scoped / strong)
 * 3) socialQuery (when strong)
 */
export function buildSafeSocialSearchQuery(
  item: ItineraryItem,
  context?: SocialDestinationContext | string,
): string | null {
  const ctx: SocialDestinationContext =
    typeof context === 'string' ? { location: context } : (context ?? {});

  if (item.activityCategory === '移動') return null;
  if (item.isSpecificPlace === false) return null;

  const placeName = cleanToken(item.placeName);
  const area = resolveArea(item, ctx);
  const { city, country } = resolveCityCountry(item, ctx);

  const composed = dedupeJoin([placeName, area, city, country]);
  if (placeName && isSafeSocialQuery(composed)) {
    return composed;
  }

  if (placeName) {
    const withLocation = dedupeJoin([placeName, area, cleanToken(ctx.location)]);
    if (isSafeSocialQuery(withLocation)) return withLocation;
  }

  const mapsQuery = cleanToken(item.mapsQuery);
  if (mapsQuery && isSafeSocialQuery(mapsQuery)) {
    return mapsQuery;
  }

  const socialQuery = cleanToken(item.socialQuery);
  if (socialQuery && isSafeSocialQuery(socialQuery)) {
    return socialQuery;
  }

  return null;
}

/** @deprecated Prefer buildSafeSocialSearchQuery */
export function buildPlacePreviewSearchQuery(
  item: ItineraryItem,
  tripLocation?: string,
): string {
  return buildSafeSocialSearchQuery(item, tripLocation) ?? '';
}

export function resolvePlaceCity(
  item: ItineraryItem,
  tripLocation?: string,
): string | undefined {
  const { city, country } = resolveCityCountry(item, { location: tripLocation });
  return city ?? country ?? tripLocation?.trim() ?? undefined;
}

export function assertSafeExternalUrl(url: string | null | undefined): string | null {
  const cleaned = cleanToken(url);
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) return null;
  if (/undefined|null|NaN|invalid/i.test(cleaned)) return null;
  if (/[?&]q=(?:&|$)/i.test(cleaned)) return null;
  if (/[?&]destination=(?:&|$)/i.test(cleaned)) return null;
  return cleaned;
}

export function buildInstagramSearchUrl(query: string): string | null {
  if (!isSafeSocialQuery(query)) return null;
  return assertSafeExternalUrl(
    `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(query)}`,
  );
}

export function buildTikTokSearchUrl(query: string): string | null {
  if (!isSafeSocialQuery(query)) return null;
  return assertSafeExternalUrl(`https://www.tiktok.com/search?q=${encodeURIComponent(query)}`);
}

export function buildGoogleImagesSearchUrl(query: string): string | null {
  if (!isSafeSocialQuery(query)) return null;
  return assertSafeExternalUrl(
    `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
  );
}

export function buildSocialWebSearchFallbackUrl(
  query: string,
  network: SocialLinkType,
): string | null {
  if (!isSafeSocialQuery(query)) return null;
  const suffix =
    network === 'instagram' ? 'instagram' : network === 'tiktok' ? 'tiktok' : 'photos';
  return assertSafeExternalUrl(
    `https://www.google.com/search?q=${encodeURIComponent(`${query} ${suffix}`)}`,
  );
}

export function getPlacePreviewLinks(
  item: ItineraryItem,
  tripLocationOrContext?: string | SocialDestinationContext,
): SafeSocialLinks | null {
  const query = buildSafeSocialSearchQuery(item, tripLocationOrContext);
  if (!query) {
    logSocialLinkDiagnostics(false);
    return null;
  }

  const instagram = buildInstagramSearchUrl(query);
  const tiktok = buildTikTokSearchUrl(query);
  const googleImages = buildGoogleImagesSearchUrl(query);
  if (!instagram || !tiktok || !googleImages) {
    logSocialLinkDiagnostics(false);
    return null;
  }

  logSocialLinkDiagnostics(true);
  return { query, instagram, tiktok, googleImages };
}

export function canShowSocialPreviewLinks(
  item: ItineraryItem,
  tripLocationOrContext?: string | SocialDestinationContext,
): boolean {
  return getPlacePreviewLinks(item, tripLocationOrContext) != null;
}

function logSocialLinkDiagnostics(hasSafeSocialQuery: boolean): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[social-link]', {
    socialLinkType: 'preview_bundle',
    hasSafeSocialQuery,
  });
}
