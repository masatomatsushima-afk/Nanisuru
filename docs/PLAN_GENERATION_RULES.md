# 旅行プラン生成ルール（destination / 通貨 / 時間 / Maps・SNS）

> **Before changing plan generation, Maps, Weather, Places, or itinerary UI,
> read `docs/NANISURU_PRODUCT_BRAIN.md` first.
> Any implementation that violates Product Brain rules is not acceptable.**

Nanisuru の旅行プラン生成（Lightweight MVP モード）に関するルールをまとめたものです。
実装は `src/lib/generate-plan.ts` / `src/lib/destination-safety.ts` /
`src/lib/travel-plan-dev-fallback.ts` / `src/lib/concierge-links.ts` /
`src/lib/place-preview-links.ts` を参照してください。

ユーザー目線の絶対ルール（空港仮定禁止・目的カバレッジ・抽象スポット禁止・失敗時の元プラン保護など）は
`docs/NANISURU_PRODUCT_BRAIN.md` と `npm run verify:beta-acceptance` を正とする。

---

## 1. 目的地（destination）ロックルール

**最重要**: 指定された destination の外の場所を絶対に出さない。これは特定の都市に限定した
ルールではなく、**世界中どの目的地にも同じロジックで適用する**（`src/lib/destination-safety.ts`
の `normalizeDestination()` が担当）。

- 例: 目的地が韓国 → 大阪・東京・日本国内スポットを出さない
- 例: 目的地が福岡 → 大阪・東京・韓国・海外スポットを出さない
- 例: 目的地が Paris → 日本スポットを出さない
- 例: 目的地が Melbourne → 他都市・他国のスポットを出さない
- 目的地が未知（登録リストに無い都市・小さな町など）でも、実在しない偽の店名・施設名を
  無理に作らない（`buildDestinationPromptRules()` / OpenAIプロンプトの destination lock 指示）。
- 自信が持てない具体スポットは、"目的地中心部を散策" "目的地のローカルカフェで休憩" のような
  **安全な一般表現**にする（`genericAreaPhrase()`）。
- 既知の都市（東京・大阪・京都・ソウル・メルボルン・シドニーなど、`KNOWN_CITY_REGISTRY`）は
  安全なエリア候補（safeAreas）を持つが、これは**品質向上のためのオプション**であり、
  未知の目的地でもロジックが破綻しないことが前提。
- AI応答後、`sanitizeItineraryForDestination()` が最小限の "よくある混入ワード" リスト
  （`MINIMAL_CROSS_DESTINATION_MARKERS`）で日本語・英語のクロス汚染をチェックし、
  混入していれば安全な代替アイテムに置き換える。
- 目的地固有の単語を目的地自身のプランで誤って禁止しない（例: 大阪旅行で「大阪」という単語自体は
  禁止しない） — `getBannedKeywordsForDestination()` が自己除外を行う。

### してはいけないこと
- 都市名を固定リストでハードコードして「韓国/大阪/東京だけ」対応するような限定実装
- 目的地不明のときに実在するか分からない店名・施設名を創作する
- 目的地に無関係な有名スポットを「知っているから」という理由で流用する

---

## 2. 通貨ルール

**最重要**: ユーザーが選んだ `currency` を、destination に応じて勝手に変えない。

- 例: destination が韓国でも、ユーザーが JPY を選んでいれば JPY のまま
- 例: destination が Paris でも、ユーザーが JPY を選んでいれば JPY のまま
- `src/lib/generate-plan.ts` では `resolvedCurrency = input.currency` がそのまま採用され、
  `inferCurrencyFromLocation()` のような目的地からの currency 推測ロジックは使わない。
- `src/app/(tabs)/index.tsx` でも、location 入力に応じて currency を自動変更する
  `useEffect` は置かない（`CurrencySelector` のユーザー選択が常に正）。
- 現地通貨の目安が有用な場合、`estimatedCost` の中で補足的に触れるのは可だが、
  主要な予算通貨として扱わない。
- 予算表示（Plan Detail等）は次の優先順位:
  1. `plan.budget.display`（あれば最優先）
  2. 無ければ `budget + currency` を安全に組み立てて表示（`src/lib/format-budget.ts`）

---

## 3. 時間ルール（到着・出発時刻）

- 1日目は `arrivalTime`（到着時刻）以降から開始する。
- 最終日は `departureTime`（出発時刻）の2〜3時間前までに全アクティビティを終える。
- 中日（2日目〜最終日前日）は朝から夜まで自由に使ってよい。
- 1日あたりのアイテム数は目安 3〜5件。
- 同一エリア内で無理のない移動距離にする（無理な移動距離・不可能な移動を入れない）。
- 実装: `src/lib/generate-plan.ts` の `buildMvpUserPrompt()`（`getEarliestActivityStartMinutes()` /
  `getLatestActivityEndMinutes()` を利用したプロンプト生成）と `MVP_SYSTEM_PROMPT`。

---

## 4. Google Maps / SNS検索クエリルール

**最重要**: Google Maps の検索結果が、ユーザーの現在地周辺になってしまうことを絶対に防ぐ。

- Google Maps を開くときは、必ず `item.mapsQuery` を使う（`title` や `area` をそのまま
  検索クエリに使わない）。
- `mapsQuery` には必ず destination の city / country を含める
  （例: `"Gwangjang Market Seoul Korea"`, `"Fukuoka Hakata ramen Fukuoka Japan"`）。
- `mapsQuery` が目的地を含んでいない場合は、`enforceDestinationScopedQuery()` /
  `scopeMapsQueryToLocation()`（`src/lib/destination-safety.ts`）が**強制的に destination を追記**する。
  これは AI の応答内容に関わらず必ず通る「保険」のロジックであり、削除しないこと。
- `isSpecificPlace === false`（具体的な実在スポットではない抽象アイテム）の場合:
  - 「現在地から道案内」ボタンは**表示しない**（`canOfferDirections()` in
    `src/lib/concierge-links.ts`）。
  - 「Google Mapsで開く」ボタン自体は無効化せず、destination スコープ済みの安全なクエリで開く。
- Instagram / TikTok / Google画像検索も、`item.socialQuery`（無ければ `mapsQuery`）を優先して使う
  （`src/lib/place-preview-links.ts` の `buildPlacePreviewSearchQuery()`）。destination が
  入っていない生の `title` だけで検索しない。
- fallback プラン（`src/lib/travel-plan-dev-fallback.ts`）でも、既知の安全エリアには
  具体的な英語 `mapsQuery`（例: 明洞 → `Myeongdong Seoul Korea`）を用意し、未知の目的地では
  無理に施設名を作らず、`mapsQuery` に必ず destination を含める。

### してはいけないこと
- `title + area` のような曖昧な文字列だけで Google Maps / SNS 検索クエリを作る
- destination を含まない検索クエリを許容する
- 抽象アイテムに対して「現在地から道案内」を出す

---

## 5. Cursorへの作業ルール

Cursor（このリポジトリで作業するAIエージェント）は、このプロジェクトで作業する際に以下を守る:

1. **1回の修正範囲を小さくする** — 依頼された不具合・機能に直接関係するファイルだけを変更する。
2. **変更前に原因を特定する** — 推測でコードを書き換える前に、該当ロジックを実際に読んで
   原因のファイル・行を特定してから直す。
3. **余計なファイルを触らない** — 「ついでの改善」「無関係なリファクタ」はしない。
4. **修正後は変更ファイルとテスト手順を短く報告する** — 長い説明より、
   「何を直したか」「どう確認するか」を簡潔に伝える。
5. **迷ったら実装せずに確認する** — 仕様や優先度が曖昧な場合は、実装を進める前にユーザーに確認する。
6. `docs/NANISURU_MVP_RULES.md` の「まだ戻さない機能」「大規模リファクタ禁止」を必ず尊重する。

---

## 6. 関連ファイル早見表

| 領域 | ファイル |
| --- | --- |
| Lightweight MVP フラグ | `src/lib/lightweight-mvp.ts` |
| プラン生成コア（retry/timeout/prompt/fallback判定） | `src/lib/generate-plan.ts` |
| 目的地正規化・destination lock・Mapsクエリ強制 | `src/lib/destination-safety.ts` |
| 開発用フォールバックプラン | `src/lib/travel-plan-dev-fallback.ts` |
| 予算表示ユーティリティ | `src/lib/format-budget.ts` |
| Google Maps リンク生成 | `src/lib/concierge-links.ts` |
| Instagram/TikTok/Google画像リンク生成 | `src/lib/place-preview-links.ts` |
| Plan Detail 画面 | `src/app/plan-detail.tsx` |
| 行程アイテム表示 + Maps/SNSボタン | `src/components/itinerary-timeline-card.tsx`, `src/components/itinerary-map-actions.tsx`, `src/components/place-atmosphere-links.tsx` |
