/**
 * Server-side Google Places (New) Text Search proxy.
 * API key stays on the server — never sent to the browser.
 * Fields: place_id / name / rating / reviewCount(userRatingCount) / address / location / openNow /
 * primaryType / photo(resource name) — enough to rank+select candidates. レビュー本文は取得しない。
 */

const GOOGLE_PLACES_KEY_PLACEHOLDERS = new Set([
  '',
  'your-google-places-api-key',
  'your-google-maps-api-key',
]);

const REQUEST_TIMEOUT_MS = 8_000;

/** Dev-only diagnostic logging (no secrets — never logs the API key or full response body). */
const IS_DEV_RUNTIME = process.env.NODE_ENV !== 'production';

function classifyGoogleHttpStatus(status: number): string {
  switch (status) {
    case 400:
      return 'bad_request (fieldmask/body invalid?)';
    case 401:
      return 'unauthorized (invalid API key?)';
    case 403:
      return 'permission_denied (API not enabled / billing off / key restricted?)';
    case 429:
      return 'quota_exceeded (rate limit)';
    default:
      return 'unknown';
  }
}

function getServerGooglePlacesApiKey(): string | undefined {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key || GOOGLE_PLACES_KEY_PLACEHOLDERS.has(key)) return undefined;
  return key;
}

type PlacesSearchRequestBody = {
  query?: string;
  maxResultCount?: number;
};

type GooglePlaceResult = {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  currentOpeningHours?: { openNow?: boolean };
  primaryType?: string;
  photos?: Array<{ name?: string }>;
};

type MinimalPlaceCandidate = {
  placeId: string;
  placeName: string;
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  isOpenNow: boolean | null;
  primaryType: string | null;
  photoRef: string | null;
};

function clampMaxResultCount(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 10;
  return Math.min(10, Math.max(1, n));
}

function safeErrorResponse(errorCode: string, warning?: string): Response {
  return Response.json({ ok: false, errorCode, candidates: [], warning }, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = getServerGooglePlacesApiKey();
  if (!apiKey) {
    // Automatic fallback — no key configured, no external call, no crash.
    if (IS_DEV_RUNTIME) {
      console.warn('[api/places-search] missing_api_key — GOOGLE_PLACES_API_KEY not set on server');
    }
    return safeErrorResponse('missing_api_key');
  }

  let body: PlacesSearchRequestBody;
  try {
    body = (await request.json()) as PlacesSearchRequestBody;
  } catch (error) {
    console.warn('[api/places-search] invalid JSON body', error);
    return safeErrorResponse('invalid_request');
  }

  const query = body.query?.trim();
  if (!query) {
    return safeErrorResponse('invalid_request');
  }

  const maxResultCount = clampMaxResultCount(body.maxResultCount);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Note: currentOpeningHours is requested as a whole object (not the
        // ".openNow" sub-path) — Places API (New) field masks are documented against
        // top-level Place field names, so this avoids any risk of an invalid-fieldmask 400.
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.rating,places.userRatingCount,' +
          'places.formattedAddress,places.location,places.currentOpeningHours,' +
          'places.primaryType,places.photos',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount }),
      signal: controller.signal,
    });

    const text = await response.text();

    if (IS_DEV_RUNTIME) {
      console.log('[api/places-search] Google Places response', {
        httpStatus: response.status,
        ok: response.ok,
      });
    }

    if (!response.ok) {
      console.warn('[api/places-search] Google Places request failed', {
        status: response.status,
        classification: classifyGoogleHttpStatus(response.status),
        body: text.slice(0, 500),
      });
      return safeErrorResponse('search_failed', `Google Places ${response.status}`);
    }

    let parsed: { places?: GooglePlaceResult[] };
    try {
      parsed = JSON.parse(text) as { places?: GooglePlaceResult[] };
    } catch (parseError) {
      console.warn('[api/places-search] failed to parse Google Places response', parseError);
      return safeErrorResponse('search_failed', 'Invalid response from Google Places');
    }

    const candidates: MinimalPlaceCandidate[] = (parsed.places ?? [])
      .filter((place) => Boolean(place.id && place.displayName?.text))
      .map((place) => ({
        placeId: place.id as string,
        placeName: place.displayName!.text as string,
        rating: typeof place.rating === 'number' ? place.rating : null,
        reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
        address: place.formattedAddress?.trim() || null,
        lat: typeof place.location?.latitude === 'number' ? place.location.latitude : null,
        lng: typeof place.location?.longitude === 'number' ? place.location.longitude : null,
        isOpenNow:
          typeof place.currentOpeningHours?.openNow === 'boolean'
            ? place.currentOpeningHours.openNow
            : null,
        primaryType: place.primaryType?.trim() || null,
        photoRef: place.photos?.[0]?.name?.trim() || null,
      }));

    if (IS_DEV_RUNTIME) {
      console.log('[api/places-search] candidates parsed', { count: candidates.length });
    }

    return Response.json({ ok: true, candidates }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Google Places error';
    console.warn('[api/places-search] request failed', message);
    return safeErrorResponse('search_failed', message);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
