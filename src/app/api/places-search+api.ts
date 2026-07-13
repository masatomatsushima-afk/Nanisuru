/**
 * Server-side Google Places (New) Text Search proxy.
 * API key stays on the server — never sent to the browser.
 * Minimal fields only: place_id / name / rating / address / photo (resource name).
 * レビュー本文・営業時間は取得しない（範囲外）。
 */

const GOOGLE_PLACES_KEY_PLACEHOLDERS = new Set([
  '',
  'your-google-places-api-key',
  'your-google-maps-api-key',
]);

const REQUEST_TIMEOUT_MS = 8_000;

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
  formattedAddress?: string;
  photos?: Array<{ name?: string }>;
};

type MinimalPlaceCandidate = {
  placeId: string;
  placeName: string;
  rating: number | null;
  address: string | null;
  photoRef: string | null;
};

function clampMaxResultCount(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 8;
  return Math.min(10, Math.max(1, n));
}

function safeErrorResponse(errorCode: string, warning?: string): Response {
  return Response.json({ ok: false, errorCode, candidates: [], warning }, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = getServerGooglePlacesApiKey();
  if (!apiKey) {
    // Automatic fallback — no key configured, no external call, no crash.
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
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.rating,places.formattedAddress,places.photos',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount }),
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      console.warn('[api/places-search] Google Places request failed', {
        status: response.status,
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
        address: place.formattedAddress?.trim() || null,
        photoRef: place.photos?.[0]?.name?.trim() || null,
      }));

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
