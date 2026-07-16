/**
 * Google Places API (New) 単独実通信検証（プラン生成・OpenAIとは完全に無関係）。
 *
 * 何をするか:
 * - 稼働中の Expo dev server（`npm run dev:phone` 等）の `/api/places-search`
 *   （= src/app/api/places-search+api.ts、実際の GooglePlacesProvider が使うのと同じサーバー
 *   ルート）へ、固定テストクエリを1回だけ POST する。
 * - レスポンスの ok / errorCode / HTTP 相当ステータス / 候補件数 / 各候補名 / placeId 有無
 *   だけを安全に出力する。API キーの値はこのスクリプトが一切読み書きしないため、表示され得ない。
 *
 * 実行前提: 別ターミナルで `npm run dev:phone`（または `npx expo start --web`）が起動していること。
 * 実行: npm run verify:google-places-live
 * ベースURLを変えたい場合: PLACES_SEARCH_BASE_URL=http://localhost:8091 npm run verify:google-places-live
 */

const DEFAULT_BASE_URL = 'http://localhost:8091';

const TEST_QUERY = {
  query: '明洞 カフェ',
  city: 'Seoul',
  country: 'Korea',
  limit: 5,
} as const;

type PlacesSearchApiCandidate = {
  placeId?: string;
  placeName?: string;
  rating?: number | null;
  reviewCount?: number | null;
  address?: string | null;
};

type PlacesSearchApiResponse = {
  ok: boolean;
  candidates?: PlacesSearchApiCandidate[];
  errorCode?: string;
  warning?: string;
};

function classify(errorCode: string | undefined, warning: string | undefined): string {
  const combined = `${errorCode ?? ''} ${warning ?? ''}`;

  if (combined.includes('missing_api_key')) {
    return 'GOOGLE_PLACES_API_KEY が サーバー側で読み込めていない（.env.local 未設定 or Expo 再起動が必要）';
  }
  if (combined.includes('400')) return 'HTTP 400 Bad Request（リクエスト形式 or FieldMask の問題）';
  if (combined.includes('401')) return 'HTTP 401 Unauthorized（API キーが無効）';
  if (combined.includes('403')) return 'HTTP 403 Forbidden（API 未有効化 / Billing 未設定 / キー制限の可能性）';
  if (combined.includes('429')) return 'HTTP 429 Too Many Requests（レート制限 / Quota 超過）';
  if (combined.includes('no_candidates')) return '通信は成功したが候補0件（クエリに該当なし）';
  if (combined.includes('invalid_request')) return 'リクエストボディが不正（このスクリプト自体の問題）';
  if (combined.includes('search_failed')) return 'Google 呼び出し失敗（詳細は warning を参照）';
  return errorCode ? `未分類のエラーコード: ${errorCode}` : '不明';
}

async function main(): Promise<void> {
  const baseUrl = (process.env.PLACES_SEARCH_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = `${baseUrl}/api/places-search`;
  const textQuery = `${TEST_QUERY.query} ${TEST_QUERY.city} ${TEST_QUERY.country}`;

  console.log('--- Google Places 単独実通信検証 ---');
  console.log(`対象URL: ${url}`);
  console.log(`テストクエリ: "${textQuery}" (maxResultCount=${TEST_QUERY.limit})`);
  console.log('（APIキーはこのスクリプトでは読み書きしません）');
  console.log('');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: textQuery, maxResultCount: TEST_QUERY.limit }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[FAIL] dev server に到達できませんでした。');
    console.error(`  詳細: ${message}`);
    console.error('  → 別ターミナルで `npm run dev:phone` (または `npx expo start --web`) が起動しているか確認してください。');
    process.exitCode = 1;
    return;
  }

  const httpStatusOfThisRoute = response.status; // このルート自体は成功時も失敗時も 200 を返す設計
  let data: PlacesSearchApiResponse;
  try {
    data = (await response.json()) as PlacesSearchApiResponse;
  } catch (error) {
    console.error('[FAIL] /api/places-search のレスポンスをJSONとして解析できませんでした。');
    console.error(`  route HTTP status: ${httpStatusOfThisRoute}`);
    process.exitCode = 1;
    return;
  }

  const candidates = data.candidates ?? [];
  const provider = 'google_places'; // このルートは常に GooglePlacesProvider 相当の Google 実通信のみを行う
  const source = 'google'; // seed/mock 経路ではなく、このスクリプトは常に Google Places の実エンドポイントのみを叩く

  console.log('=== 結果 ===');
  console.log(`provider: ${provider}`);
  console.log(`route HTTP status (/api/places-search 自体): ${httpStatusOfThisRoute}`);
  console.log(`ok: ${data.ok}`);
  console.log(`errorCode: ${data.errorCode ?? '(なし)'}`);
  console.log(`warning: ${data.warning ?? '(なし)'}`);
  console.log(`candidateCount: ${candidates.length}`);
  console.log(`source: ${source}`);
  console.log('');

  if (data.ok && candidates.length > 0) {
    console.log('=== 候補一覧 ===');
    candidates.forEach((candidate, index) => {
      console.log(
        `${index + 1}. placeName="${candidate.placeName ?? '(なし)'}" ` +
          `hasPlaceId=${Boolean(candidate.placeId)} ` +
          `rating=${candidate.rating ?? '(なし)'} ` +
          `reviewCount=${candidate.reviewCount ?? '(なし)'}`,
      );
    });
    console.log('');
    console.log('[OK] Google Places (New) から実在候補を取得できました。');
  } else {
    console.log(`[診断] ${classify(data.errorCode, data.warning)}`);
  }
}

main().catch((error) => {
  console.error('[FAIL] 予期しないエラー:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
