# Google Places 連携計画（設計のみ — 未実装）

Nanisuru の旅行プランで「明洞で韓国料理」のような**抽象案**ではなく、
「明洞餃子」「土俗村」「Cafe Onion 聖水」のような**実在する具体スポット**を提案するための
将来設計です。

**このドキュメントは設計のみです。API キー追加・実呼び出し・課金・Supabase 永続化・予約機能は
まだ行いません。**

関連コード（現状の MVP）:

- `src/types/spot-candidate.ts` — `SpotCandidate` / `SpotCandidateSource`
- `src/types/plan.ts` — `ItineraryItem.spotCandidates`, `placeId`, `source`
- `src/lib/spot-specificity.ts` — 抽象 item 検出・`isSpecificPlace` 強制
- `src/lib/seoul-spot-seeds.ts` — ソウル限定 seed 候補（Places 導入前の暫定）
- `src/lib/generate-plan.ts` — MVP プロンプト・生成後 validation
- `src/lib/itinerary-schedule-validation.ts` — 重複排除・時間制約
- `docs/PLAN_GENERATION_RULES.md` — destination / 通貨 / 時間 / Maps ルール

---

## 1. 最終的な流れ

### 1.1 入力

プラン生成リクエストから以下を受け取る（既存フィールドをそのまま利用）:

| 入力 | 用途 |
|------|------|
| `destinationLabel` / `city` / `country` | Places 検索の地理スコープ |
| `baseArea` / `accommodation` | Nearby Search の中心・バイアス |
| `arrivalPoint` | 1日目ルートの起点バイアス |
| `travelPurpose` / `travelIntent` / interests | カテゴリ・クエリの選定 |
| `companion` (tripType) | 家族向け・デート向け等のフィルタ方針 |
| `arrivalTime` / `departureTime` | 日程制約（Places 取得後も守る） |
| `currency` / `budget` | 予算フィルタ（`priceLevel` との対応） |

### 1.2 候補取得（Google Places — 将来）

```
[User Form]
    ↓ destination / city / baseArea / interests / tripType
[Places Candidate Fetcher]  ← 新規モジュール（未実装）
    ├─ Text Search   … 有名店・ランドマーク・「明洞餃子」等の名前検索
    ├─ Nearby Search … baseArea / accommodation 周辺の食事・カフェ・観光
    └─ Place Details … placeId ごとに rating / hours / photos 等を enrich
    ↓
[SpotCandidate[]]  … 実在確認済み候補プール（50〜200件/都市規模）
    ↓
[AI Scheduler]  … OpenAI は候補リスト**のみ**から日程を組む
    ↓
[Post-validation]  … 既存: destination lock / duplicate / night view / departure
    ↓
[ItineraryDay[]]  … placeId 付き・isSpecificPlace=true の item のみ Maps 表示
```

**原則: AI は候補に無い店名を invent しない。**

- 候補が足りない slot → `isSpecificPlace=false` のエリア案内（「明洞周辺のカフェ」）に落とす
- 候補ゼロ → seed / safe area fallback（現行と同じ）

### 1.3 候補に保存するフィールド

Place Details / Search レスポンスから正規化して `SpotCandidate` に格納:

| フィールド | 来源（Places API） |
|-----------|-------------------|
| `placeId` | Place ID（不変キー） |
| `placeName` | `displayName` / `name` |
| `address` | `formattedAddress` |
| `area` | address 成分 or ユーザー `baseArea` |
| `city` / `country` | address 成分 or フォーム入力 |
| `coordinates` | `location` (lat/lng) |
| `rating` | `rating` |
| `reviewCount` | `userRatingCount` |
| `priceLevel` | `priceLevel` |
| `openingHours` | `regularOpeningHours` / `currentOpeningHours` |
| `mapsUrl` | Place Details の Google Maps URI |
| `photoUrl` | Place Photos API（参照 URL） |
| `category` | `types[]` → Nanisuru `PlaceCategory` へマップ |
| `source` | `"google_places"` |
| `confidence` | Places 由来は原則 `"high"` |

### 1.4 AI への渡し方（将来プロンプト設計）

```
【候補リスト限定・最重要】
以下は Google Places API で取得した実在スポットのみです。
旅程の各 item は、このリストの placeId / placeName から選んでください。
リストに無い店名・施設名を創作しないこと。
選べない slot は isSpecificPlace=false のエリア案内にしてください。

候補:
[
  { placeId: "ChIJ...", placeName: "明洞餃子", category: "food", rating: 4.2, area: "明洞", ... },
  ...
]
```

AI の出力スキーマでは:

- `placeId` 必須（候補から選んだ場合）
- `source: "google_places"`
- `isSpecificPlace: true`（placeId がある場合のみ）
- `mapsQuery` は `placeName + city + country` または Place の `mapsUrl` 由来

生成後 validation で **placeId が候補プールに存在するか** を検証。不一致 → 削除 or 差し替え。

### 1.5 存在しない店名を作らせない仕組み（多層防御）

| 層 | 役割 | 状態 |
|----|------|------|
| 1. 候補プール限定プロンプト | AI に invent 禁止を明示 | 将来 |
| 2. JSON schema | `placeId` / `source` フィールド | 型は既存 |
| 3. `enforceItemSpecificity()` | 抽象 item → `isSpecificPlace=false` | **MVP 稼働中** |
| 4. placeId 照合 | 候補外 placeId → 差し替え/削除 | 将来 |
| 5. UI | `isSpecificPlace=false` なら Maps・道案内非表示 | **MVP 稼働中** |

---

## 2. 必要そうな Google Places API

Places API (New) を前提に記載。旧 Places API ではなく **Places API (New)** の
[Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search) /
[Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search) /
[Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details) /
[Place Photos (New)](https://developers.google.com/maps/documentation/places/web-service/place-photos) /
[Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
を想定。

### 2.1 Text Search

**用途**: 都市名 + カテゴリ + 有名店名で候補を広く取得。

```
例: "Myeongdong Kyoja restaurant Seoul Korea"
例: "Gyeongbokgung Palace Seoul"
例: "Cafe Onion Seongsu Seoul"
```

- `includedType` / `textQuery` で food / cafe / tourist_attraction 等を指定
- `locationBias` に `city` / `baseArea` の lat/lng を渡す
- ページネーションで 20〜60 件/クエリ

### 2.2 Nearby Search

**用途**: `baseArea` / `accommodation` / `arrivalPoint` 周辺の候補。

- 中心: geocoding 済み coordinates（将来は Places Geocoding or フォーム lat/lng）
- 半径: 1〜3 km（食事・カフェ）、5 km（観光）
- `includedTypes`: restaurant, cafe, tourist_attraction, shopping_mall 等

### 2.3 Place Details

**用途**: Search 結果の `placeId` ごとに詳細 enrich。

取得フィールド（FieldMask）:

- `id`, `displayName`, `formattedAddress`, `location`
- `rating`, `userRatingCount`, `priceLevel`
- `regularOpeningHours`, `currentOpeningHours`
- `googleMapsUri`, `photos`
- `types`, `primaryType`

**バッチ方針**: Search で得た placeId を N 件ずつ Details 取得（レート制限・コスト考慮）。

### 2.4 Place Photos

**用途**: Plan Detail / 候補カードのサムネイル。

- `photos[].name` → Place Photos API で media URL 生成
- MVP 本番前は photo 無しでも可（`photoUrl?: string`）

### 2.5 Autocomplete

**用途**: フォーム入力補助（将来）。

| フィールド | Autocomplete 用途 |
|-----------|------------------|
| 都市 | `city` 確定 + lat/lng 取得 |
| 拠点エリア | `baseArea` + bias |
| 宿泊先 | `accommodation` → coordinates |
| 到着場所 | `arrivalPoint` → coordinates |

**MVP ではチップ + 自由入力のまま。Autocomplete は Places フェーズ2。**

### 2.6 コスト・レート制限（設計メモ）

- 1 プラン生成 ≒ Text Search 3〜5 回 + Details 30〜50 件 + Photos 0〜10 件
- キャッシュ必須: `(city, category, query)` → SpotCandidate[] TTL 24h
- 開発環境: seed / mock のみ（API 呼び出しなし）

---

## 3. MVP でまだやらないこと

以下は**意図的に後回し**。このドキュメント作成時点では実装しない。

| 項目 | 理由 |
|------|------|
| API キー追加（`.env` / EAS secrets） | 課金・セキュリティレビュー前 |
| 本番課金・Billing 設定 | トラフィック未確定 |
| Google Places の実 HTTP 呼び出し | 上記 + キャッシュ設計が先 |
| Supabase への候補永続保存 | MVP はインメモリ / 短期キャッシュで十分 |
| 予約機能（Reservations / 外部 OTA） | スポット特定後の別フェーズ |
| フォーム Autocomplete UI | チップ + 自由入力で MVP 継続 |
| custom bottom nav 復帰 | 別タスク |

---

## 4. 先に作るべき内部構造

### 4.1 SpotCandidate（目標型）

現行 `src/types/spot-candidate.ts` を拡張する想定。**今は型コメントのみで、フィールド追加は Places 実装時。**

```typescript
type SpotCandidateSource =
  | 'seed'           // 手動キュレーション（seoul-spot-seeds 等）
  | 'google_places'  // Places API 取得（将来。現 MVP は google_places_later プレースホルダ）
  | 'openai'         // AI が候補リスト内から選択した結果
  | 'fallback';      // 抽象エリア案内

type SpotCandidate = {
  placeName: string;
  placeId?: string | null;       // Google Place ID — 実在の証明
  category?: PlaceCategory;        // food | cafe | sightseeing | shopping | nightlife | activity
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;      // 0–4
  address?: string;
  area?: string;                   // 明洞 / 聖水洞 等
  city?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  mapsUrl?: string;                // Google Maps ディープリンク
  mapsQuery?: string;              // 検索クエリ fallback
  socialQuery?: string;
  photoUrl?: string;
  openingHours?: string;           // 人間可読 or JSON 文字列
  popularityType?: PopularityType;
  source: SpotCandidateSource;
  confidence: 'high' | 'medium' | 'low';
};
```

**命名移行**: 現コードの `google_places_later` → 実装時に `google_places` へ rename。

### 4.2 ItineraryItem との関係（既存）

```typescript
type ItineraryItem = {
  activity: string;              // "明洞餃子でカルグクス"
  placeName?: string;            // "明洞餃子"
  placeId?: string | null;       // 候補と一致必須（Places フェーズ）
  spotCandidates?: SpotCandidate[];  // 生成時に渡した候補サブセット
  source?: SpotCandidateSource;
  isSpecificPlace?: boolean;     // placeId あり & confidence high → true
  mapsQuery?: string;
  // ...
};
```

**ルール**:

- `source === 'google_places'` かつ `placeId` あり → `isSpecificPlace=true` → Maps / 道案内 OK
- それ以外の invent 疑い → `isSpecificPlace=false` → Maps / 道案内 NG

### 4.3 将来モジュール構成（ファイル案 — 未作成）

```
src/lib/places/
  places-client.ts          # HTTP クライアント（FieldMask, API key proxy）
  places-normalize.ts       # Places response → SpotCandidate
  places-candidate-fetch.ts # destination + interests → SpotCandidate[]
  places-cache.ts           # in-memory / optional Redis
  places-category-map.ts    # Google types → PlaceCategory
  places-geocode.ts         # city / baseArea → lat/lng（Autocomplete 連携）
```

**generate-plan.ts への差し込み点（将来）**:

```
1. resolveDestinationDetails()
2. fetchSpotCandidatesForTrip()   ← NEW（Places or seed fallback）
3. buildMvpUserPrompt(candidates) ← 候補リストをプロンプトに注入
4. OpenAI generate
5. validateAndFixItinerarySchedule()
6. validateSpotCandidatesPool()   ← NEW（placeId 照合）
7. enforceSpecificityOnDays()
```

### 4.4 Seed との共存

| ソース | いつ使う |
|--------|---------|
| `google_places` | API 有効 & 候補取得成功 |
| `seed` | API 未設定 / レート制限 / 未知都市 |
| `fallback` | 候補不足 slot |

ソウル seed（`src/lib/seoul-spot-seeds.ts`）は Places 導入後も**オフライン開発・テスト用**として残す。

---

## 5. 今の MVP で守ること（Places 未導入でも継続）

Places 連携前後を通じて**壊してはいけない**ルール:

### 5.1 具体スポットが無い場合

- 無理に店名を作らない
- `isSpecificPlace=false` にする
- `confidence: 'low'`
- UI: Google Maps ボタン・道案内ボタンを**出さない**
- 「候補エリア」表示（`getCandidateAreaLabel()`）で代替

### 5.2 destination lock

- `city` / `country` / `destinationLabel` 外のスポット禁止
- `mapsQuery` には必ず destination を含める
- `sanitizeItineraryForDestination()` 継続

### 5.3 通貨・時間

- ユーザー選択 `currency` を上書きしない
- `arrivalTime` / `departureTime` / 最終日空港ルール（`itinerary-schedule-validation.ts`）を維持

### 5.4 tripType

- おすすめ理由・feedback は `trip-type-copy.ts` で companion 一致
- Places 候補フィルタでも tripType（家族向け等）を将来考慮

### 5.5 AI 失敗時

- timeout / 502 → dev fallback plan（HTTP 200、`console.warn`）
- 赤エラー画面を出さない

---

## 6. 実装フェーズ案（参考 — 未着手）

| Phase | 内容 | 依存 |
|-------|------|------|
| **0（現在）** | seed + 抽象禁止 + validation | — |
| **1** | `SpotCandidate` 型拡張、`places-normalize` mock | なし |
| **2** | サーバープロキシ `/api/places/search` + dev API key | GCP プロジェクト |
| **3** | generate-plan に候補注入 + placeId 照合 | Phase 2 |
| **4** | Autocomplete フォーム連携 | Phase 2 |
| **5** | Supabase キャッシュ / 人気店 pre-index | Phase 3 |
| **6** | Photos UI / 予約リンク（非 Reservations API） | Phase 3 |

---

## 7. 成功指標（Places 導入後）

- 抽象 item（「明洞で韓国料理」）率 < 5%
- `isSpecificPlace=true` item の 95% 以上が placeId 付き
- Maps タップ時の誤場所率（ユーザーフィードバック）< 2%
- 1 プラン生成あたり Places API コスト < 目標上限（TBD）

---

## 8. 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-07-09 | 初版（設計のみ。コード変更なし） |
