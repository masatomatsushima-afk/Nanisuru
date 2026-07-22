# Preference Discovery Engine — 設計書

**このドキュメントは設計のみです。コード変更・UI変更・API変更は行いません。**

Nanisuru の中核価値は「グルメ / 買い物 / 観光を選ぶだけ」ではなく、  
簡単な質問と利用行動から、**本人も言語化しきれていない好み**を発見し、  
本当に合う旅行先・店舗・体験を提案することです。

本設計は、そのための **Preference Discovery Engine（好み発見エンジン）** の骨格です。

---

## 0. 位置づけと既存モジュールとの関係

| ドキュメント / モジュール | 役割 |
| --- | --- |
| `docs/NANISURU_MVP_RULES.md` | 赤エラー禁止・画面破壊禁止・大規模リファクタ禁止 |
| `docs/PLAN_GENERATION_RULES.md` | destination lock / 通貨 / 時間 / Maps・SNS |
| `docs/GOOGLE_PLACES_INTEGRATION_PLAN.md` | Places 候補取得と AI スケジューラの流れ |
| `docs/PRODUCT_ROADMAP.md` | 最終プロダクト目標 |
| **Trip DNA** (`src/lib/trip-dna/*`) | **旅程の骨格**（カテゴリ配分・時間帯・禁止カテゴリ・検証） |
| **Purpose Profile** (`src/lib/purpose-profiles.ts`) | Trip DNA と並ぶ **目的別構成比**（現行の生成後補正） |
| **Preference Profile（本設計）** | **個人の好み**（何が好きか / 避けたいか / 確信度） |

### Trip DNA と Preference Profile の役割分担（破棄しない）

```
[Preference Profile]          個人の好み・制約・確信度
        ↓ 検索意図 / ランキング重み / 説明文の根拠
[Google Places Candidates]
        ↓
[Trip DNA / Purpose Profile]  旅程骨格（配分・時間帯・禁止・充実度）
        ↓
[OpenAI Scheduler]            候補から日別配置（店名創作禁止）
        ↓
[Validation]                  destination / 重複 / 出発 / 食事間隔
```

| | Trip DNA / Purpose | Preference Profile |
| --- | --- | --- |
| 答える問い | 「この旅の型は何か」 | 「この人は何を好むか」 |
| 例 | グルメ旅なら food+cafe 45–60% | 地元寄り・カジュアル・海鮮好き |
| 寿命 | 1回のプラン生成コンテキスト | ユーザー横断で蓄積・更新 |
| 失敗時 | 配分が崩れる | 好みが浅い（有名店寄りに戻る） |
| 拡張方法 | 設定オブジェクト追加 | スキーマ + シグナル定義追加 |

**禁止**: 目的×好みの組み合わせごとの巨大 if / 韓国専用設計 / 固定アンケートの肥大化。

---

## 1. プロダクト原則

1. **Progressive Profiling** — 最初から大量質問しない。情報価値の高い質問だけ出す。
2. **Config-driven** — 好み軸・質問・シグナル・ランキング重みは設定で増やす。コード分岐を増やさない。
3. **Confidence-aware** — 確信度が低い推定は断定しない。UI・説明文・ランキングへの影響を弱める。
4. **Explicit > Inferred** — 明示選択を推定より優先。衝突時は明示を残し、推定は下げる。
5. **Destination-agnostic** — 好みスキーマは世界中・地方都市でも同じ。都市固有ハードコード禁止。
6. **Explainable** — 「評価が高いから」だけで終わらせない。好み根拠を返す。
7. **User-controllable** — 推定の確認・修正・学習リセットが可能。
8. **Soft learning** — 1回の行動で強く断定しない。シグナル蓄積で徐々に更新。

---

## 2. レイヤー設計

### 2.1 Travel Intent（何をしたいか）

旅行の主目的。**最大3個・優先順位付き**。

| id | 意味 |
| --- | --- |
| `gourmet` | 食・カフェ・市場 |
| `shopping` | 買い物・ブランド・お土産 |
| `sightseeing` | 名所・文化・視点場 |
| `nature` | 自然・絶景・屋外 |
| `relaxation` | のんびり・スパ・余白 |
| `nightlife` | 夜・バー・ナイトビュー |
| `adventure` | 体験・アクティビティ |
| `family` / `couple` / `solo` | 同行スタイル由来の補助 intent（任意） |

```
TravelIntentSelection = {
  intents: Array<{ intentId: TravelIntentId; priority: 1 | 2 | 3 }>  // len 1..3
  selectedAt: ISODateTime
  source: 'explicit_selection' | 'onboarding_question' | 'inferred_behavior'
}
```

- priority=1 が Trip DNA の主解決に最も強く効く。
- 複数 intent は **重み付きブレンド**（例: 0.6 / 0.3 / 0.1）で検索意図・配分に反映。  
  「gourmet+shopping の専用分岐」は作らない。

---

### 2.2 Category Preferences（目的ごとの好み）

選択した Travel Intent ごとに、**そのカテゴリ固有の軸**を持つ。  
軸はレジストリで定義し、カテゴリ追加時はレジストリ追記のみ。

#### Gourmet

| dimensionId | 例値 |
| --- | --- |
| `local_vs_famous` | local / balanced / famous |
| `casual_vs_luxury` | casual / mid / luxury |
| `classic_vs_adventurous` | classic / mixed / adventurous |
| `protein_focus` | meat / seafood / vegetarian / any |
| `food_formats` | cafe / dessert / market_food / restaurant（複数可） |
| `spicy_tolerance` | low / medium / high |
| `reservation_preference` | avoid / optional / prefer |

#### Shopping

| dimensionId | 例値 |
| --- | --- |
| `shopping_focus` | street_fashion / local_brands / cosmetics / vintage / luxury / department / lifestyle / souvenirs / character_goods（複数可） |
| `trend_vs_timeless` | trend / balanced / timeless |
| `budget_vs_quality` | budget / balanced / quality |

#### Sightseeing

| dimensionId | 例値 |
| --- | --- |
| `sight_focus` | history / architecture / art / nature / viewpoints / local_culture / markets / pop_culture（複数可） |
| `iconic_vs_hidden` | iconic / balanced / hidden |
| `photo_vs_learning` | photography / balanced / learning |

#### 他カテゴリ（拡張枠）

| Intent | 主な dimension 例 |
| --- | --- |
| nature | trail_intensity / scenery_vs_activity / weather_sensitivity |
| relaxation | spa_vs_cafe / quiet_vs_social / schedule_density |
| nightlife | bar_vs_club / view_vs_music / alcohol_interest |
| adventure | thrill_level / guided_vs_diy / physical_demand |

**共通ルール**

- 値は enum / multi-enum / scalar(0–1) のいずれか。
- 未回答は `undefined`（中立）。推定で埋める場合は必ず `confidence` を低くする。
- 都市名・店名を dimension 値に入れない（destination 非依存）。

---

### 2.3 Universal Travel Preferences（全カテゴリ共通）

| dimensionId | 例値 |
| --- | --- |
| `pace` | packed / balanced / relaxed |
| `walking_tolerance` | low / medium / high |
| `crowd_tolerance` | avoid / neutral / ok |
| `famous_vs_hidden` | famous / balanced / hidden |
| `indoor_vs_outdoor` | indoor / mixed / outdoor |
| `budget_vs_premium` | budget / balanced / premium |
| `photo_vs_experience` | photo / balanced / experience |
| `planned_vs_spontaneous` | planned / balanced / spontaneous |
| `daypart_bias` | early_morning / daytime / late_night |

Universal は **どの Travel Intent でも常にランキング・旅程密度に効く**。

---

### 2.4 Context and Constraints（文脈・制約）

好みではなく、**今回の旅の制約**（多くは既存フォームから供給）。

| 領域 | 例 | 既存ソース案 |
| --- | --- | --- |
| companion | 一人 / 友達 / カップル / 家族 | `companion` |
| children | 有無・年齢帯 | 将来フィールド |
| budget / currency | 金額・通貨 | `budget` / `currency` |
| arrival / departure | 時刻・空港/駅 | `travelTiming` |
| accommodation / baseArea | 拠点 | destination detail |
| weather | 予報・季節 | weather（将来強化） |
| mobility | 徒歩中心 / 公共交通 | 将来 |
| dietary | アレルギー・宗教食 | 将来（センシティブ扱い） |
| accessibility | 段差・車椅子等 | 将来（センシティブ扱い） |
| reservation | 予約可否・済み | 将来 |

**制約は hard filter / soft penalty に分ける。**

- Hard: destination 外、営業時間外（必要時）、アレルギー絶対NG、アクセシビリティ必須条件
- Soft: 混雑、徒歩距離、予算帯、有名度

センシティブ制約は推定しない。明示入力がある場合のみ使う。

---

## 3. Preference Value（値のメタデータ）

すべての好みスロットは次を持てる。

```
PreferenceValue<T> = {
  value: T
  confidence: number          // 0.0 – 1.0
  source: PreferenceSource
  updatedAt: ISODateTime
  evidenceCount?: number      // 学習に使ったシグナル数
  lastSignalIds?: string[]    // 監査・デバッグ用（個人情報は入れない）
}
```

### PreferenceSource

| source | 意味 | 学習の強さ目安 |
| --- | --- | --- |
| `explicit_selection` | フォーム・設定で明示 | 最高 |
| `onboarding_question` | 短い質問への回答 | 高 |
| `plan_feedback` | 高評価/低評価 | 中 |
| `saved_place` | 保存 | 中 |
| `replaced_place` | ここだけ変更 | 中（置換方向が重要） |
| `skipped_place` | スキップ/削除 | 弱–中 |
| `inferred_behavior` | Maps開く・予約・同カテゴリ反復 | 弱（単発ではほぼ動かさない） |
| `secretary_confirmation` | 旅行秘書での確認回答 | 高 |

### confidence の運用

| confidence | ランキングへの影響 | 説明文 |
| --- | --- | --- |
| ≥ 0.75 | 強く効く | 「〜を好むため」と断定可 |
| 0.45–0.74 | 弱く効く | 「〜の傾向があるため」 |
| < 0.45 | ほぼ中立 | 説明に使わない / 「まだ学習中」 |

更新式（概念）:

```
new = clamp(
  old * (1 - α) + signalStrength * α,
  0, 1
)
α = f(source, evidenceCount)   // explicit は α 大、inferred 単発は α 極小
```

**1回の inferred_behavior だけで value を大きく動かさない。**

---

## 4. Progressive Profiling（段階的プロファイリング）

### 4.1 フロー

```
1. Travel Intent を選ぶ（1〜3・優先順位）
2. 選ばれた intent に対し、情報価値の高い質問を 2〜4 問だけ出す
3. Universal は未設定なら最大 1〜2 問（または後回し）
4. 不足は旅行秘書が「必要な時だけ」確認
5. 保存 / ここだけ変更 / 評価 / Maps などから徐々に学習
```

### 4.2 固定アンケートにしない — 質問選択エンジン

質問は `PreferenceQuestion` レジストリに置き、毎回 **Expected Information Gain** で選ぶ。

各質問候補について概算:

```
score =
  relevance_to_selected_intents
  × uncertainty_reduction     // その dimension の confidence が低いほど高い
  × downstream_impact         // ランキング/検索意図への影響が大きいほど高い
  × low_user_burden           // 回答が簡単・選択肢が少ないほど高い
  - redundancy_penalty        // 既に近い軸が分かっていると減点
  - sensitivity_penalty       // センシティブ質問は原則出さない
```

上位 2〜4 問だけ提示。

### 4.3 MVP で聞くべき質問数

| 段階 | 質問数 | 内容 |
| --- | --- | --- |
| Intent 選択 | 1 操作 | 目的 1〜3（優先付き） |
| 直後の深掘り | **2〜4 問** | 選択 intent の高インパクト軸のみ |
| Universal | 0〜2 問 | pace / crowd / famous_vs_hidden など未設定時 |
| 秘書追加質問 | 0〜2 / セッション | プラン生成や置換で本当に足りない時だけ |

**初回プラン作成の追加質問は合計 2〜4 問を上限とする（Intent 選択自体は除く）。**

例（Gourmet が priority=1 のとき）:

1. 地元寄り vs 有名店寄り  
2. カジュアル vs 少し贅沢  
3. （任意）カフェ・デザート重視か / 食事メインか  
4. （任意）歩くのは苦にならないか（Universal）

Shopping / Sightseeing も同様に「その intent の上位 2〜3 軸」だけ。

---

## 5. Google Places との接続

既存の候補取得（Text Search / orchestration）を壊さず、**Preference を検索意図とランキングに接続**する。

### 5.1 Search Intent 生成

```
TravelIntent[] + CategoryPreferences + Universal + Context
    ↓（設定駆動の intent builder）
PlaceSearchIntent[]   // 既存 place-search-intent の拡張先
    ↓
Places API (New)
    ↓
PlaceCandidate[]
```

- Trip DNA の `placesCategories` / timeOfDay は骨格として残す。
- Preference は **クエリの具体化**（例: "local seafood market" / "street fashion boutique"）と  
  **候補スコアリング**に使う。
- 都市名ハードコード禁止。destination / city / country / baseArea は既存どおり必須。

### 5.2 ランキング概念（CandidatePreferenceScore）

各候補について:

```
finalScore =
  + w1 * purposeFit              // Travel Intent / Trip DNA 配分適合
  + w2 * categoryPreferenceFit   // Category Preferences
  + w3 * universalPreferenceFit  // Universal
  + w4 * contextFit              // 予算・同行・拠点距離・天候
  + w5 * quality                 // rating / reviewCount（飽和関数で頭打ち）
  + w6 * routeConvenience        // 拠点・前後スポットとの距離/移動
  + w7 * diversityBonus          // 旅程内の多様性（同じ系統の連打を抑える）
  - w8 * constraintViolations    // hard/soft 違反
```

**quality の扱い**

- `rating` / `reviewCount` は品質の一要素に留める。
- log 飽和（例: `log1p(reviewCount)`）で「口コミ数だけ異常に強い有名店」を抑える。
- `famous_vs_hidden = hidden` かつ confidence 高なら、超有名店にペナルティ。

重み `w*` は設定ファイル。Gourmet 専用 if で重みを書き換えない  
（「intent ブレンド結果」や「dimension の有無」で汎用的に決める）。

### 5.3 パイプライン全体（将来像）

```
PreferenceProfile
    → Search intents
    → Google Places candidates
    → Preference ranking (上記スコア)
    → Trip DNA composition / day availability
    → OpenAI schedules from candidates only
    → Validation + Explainable reasons attach
```

---

## 6. Explainability（説明可能性）

各 itinerary item / 候補に、上位理由を 1〜3 個付ける。

```
ExplainableRecommendationReason = {
  code: string                 // 機械可読
  messageKey: string           // i18n キー
  messageParams?: Record<string, string | number>
  relatedDimensions?: string[] // どの好み軸に基づくか
  confidence: number
  strength: 'primary' | 'secondary'
}
```

表示例（ユーザー向け文言）:

- 地元で人気の店を好む設定に合うため  
- ストリートファッションの希望に合うため  
- 混雑を避けたい設定に合うため  
- ホテルから近く、移動が少ないため  
- 予算帯に合うため  

**禁止例**: 「評価が高いから」だけを唯一の理由にする。  
quality 理由は、好み理由の **secondary** に落とすか、好み理由が無いときだけ出す。

confidence が低い dimension は理由に使わない。

---

## 7. Feedback Learning（フィードバック学習）

### 7.1 シグナル種別

| 行動 | PreferenceSignal 例 | 解釈の方向 |
| --- | --- | --- |
| 保存 | `saved_place` | その店の属性を弱く正 |
| ここだけ変更 | `replaced_place` | before を弱く負、after を正 |
| 削除 / スキップ | `skipped_place` | 弱く負 |
| 高評価 / 低評価 | `plan_feedback` | 明示的な強さ |
| Maps を開いた | `inferred_behavior` | 興味の弱シグナル（単発無視可） |
| 予約した | `inferred_behavior` | やや強めの興味 |
| 同カテゴリ反復選択 | `inferred_behavior` | 中期トレンド |

### 7.2 学習ルール

1. シグナルを属性ベクトルに分解（category, priceLevel, local/famous 代理特徴、混雑代理など）。
2. `PreferenceSignal` としてログ（個人を特定する生ログは最小限）。
3. 同一 dimension に対し **N 回以上** または **明示フィードバック** があるまで value を大きく動かさない。
4. explicit / onboarding と矛盾する inferred は、inferred 側を減衰。
5. センシティブ属性（宗教・健康・障害など）は行動から推定しない。

### 7.3 「ここだけ変更」の価値

置換は最強の対比学習:

- 削除された候補の特徴 → 回避方向  
- 選ばれた候補の特徴 → 嗜好方向  
- 同じ slot（時間帯・カテゴリ）内での置換なのでノイズが少ない  

---

## 8. プライバシーとユーザー制御

1. **確認・変更** — 推定を含む Preference Profile をユーザーが一覧・編集できる画面（将来）。
2. **リセット** — 学習分のクリア（explicit だけ残す / 全部消すの2モード）。
3. **明示と推定の区別** — UI 上で source / confidence を区別（「あなたが選んだ」「アプリが推測」）。
4. **センシティブ非推定** — dietary / accessibility / 宗教・政治・健康は明示入力のみ。
5. **最小化** — 説明・ランキングに不要な生行動ログを長く保持しない（保持方針は別途）。
6. **オプトアウト** — 行動学習オフ時は explicit + onboarding のみ使用。

---

## 9. データ構造案

以下は **型設計の提案**（実装は Phase 1）。名前空間例: `src/types/preference-discovery.ts`（将来）。

### 9.1 中核

```
PreferenceProfile = {
  userId?: string                 // 未ログイン時は local profile id
  schemaVersion: number
  travelIntents: TravelIntentSelection
  categoryPreferences: Record<TravelIntentId, CategoryPreference>
  universal: UniversalPreference
  contextDefaults?: Partial<TravelContextConstraints>  // よく使う制約の記憶（任意）
  updatedAt: ISODateTime
}

CategoryPreference = {
  intentId: TravelIntentId
  dimensions: Record<string, PreferenceValue<PreferenceDimensionValue>>
}

UniversalPreference = {
  dimensions: Record<string, PreferenceValue<PreferenceDimensionValue>>
}

PreferenceDimensionValue =
  | string
  | string[]
  | number
  | boolean
```

### 9.2 学習・質問

```
PreferenceSignal = {
  id: string
  profileId: string
  type: PreferenceSource
  placeId?: string
  beforePlaceId?: string          // replaced_place 用
  afterPlaceId?: string
  intentId?: TravelIntentId
  payload: Record<string, unknown> // 属性スナップショット（個人情報を入れない）
  strength: number                // 0–1
  createdAt: ISODateTime
}

PreferenceQuestion = {
  id: string
  intentIds: TravelIntentId[] | ['universal']
  dimensionId: string
  promptKey: string
  choices: Array<{ id: string; labelKey: string; value: PreferenceDimensionValue }>
  informationValueBase: number    // 選択スコアの基礎重み
  sensitivity: 'none' | 'low' | 'high'
  maxTimesShownPerTrip?: number
}

PreferenceAnswer = {
  questionId: string
  value: PreferenceDimensionValue
  answeredAt: ISODateTime
  source: 'onboarding_question' | 'secretary_confirmation'
}

PreferenceConfidence = {
  dimensionId: string
  confidence: number
  source: PreferenceSource
  updatedAt: ISODateTime
}
```

### 9.3 ランキング・説明

```
CandidatePreferenceScore = {
  placeId: string
  finalScore: number
  components: {
    purposeFit: number
    categoryPreferenceFit: number
    universalPreferenceFit: number
    contextFit: number
    quality: number
    routeConvenience: number
    diversity: number
    constraintPenalty: number
  }
  reasons: ExplainableRecommendationReason[]
}

ExplainableRecommendationReason = {
  code: string
  messageKey: string
  messageParams?: Record<string, string | number>
  relatedDimensions?: string[]
  confidence: number
  strength: 'primary' | 'secondary'
}
```

### 9.4 レジストリ（if を増やさないための設定面）

```
PreferenceDimensionRegistry = {
  [dimensionId: string]: {
    scope: TravelIntentId | 'universal'
    valueType: 'enum' | 'multi_enum' | 'scalar'
    allowedValues?: string[]
    rankingHooks: string[]        // どのスコア成分に効くか
    explanationKeys: string[]
  }
}

PreferenceQuestionRegistry = PreferenceQuestion[]
PreferenceRankingWeights = { w1..w8, saturation: {...} }
```

新しい好み軸を足す手順:

1. DimensionRegistry に1行追加  
2. 必要なら QuestionRegistry に1問追加  
3. rankingHooks / explanationKeys を結ぶ  

**エンジン本体の if 分岐は増やさない。**

---

## 10. 実装ロードマップ（安全な段階）

いずれも着手前に `NANISURU_MVP_RULES.md` を確認。各 Phase は小さくマージ可能にする。

### Phase 1 — 設計と型（本ドキュメントの次）

- `PreferenceProfile` 等の TypeScript 型のみ追加（UI / API 非接続）
- Dimension / Question レジストリの空 or 最小データ
- Trip DNA との役割コメントをコード側に短く残す程度（大規模接続なし）
- **完了条件**: 型がコンパイルでき、既存プラン生成が無変化

### Phase 2 — カテゴリ別の短い質問 UI

- Intent 選択後に **2〜4 問**だけ表示
- 回答を PreferenceProfile（ローカル保存から開始可）へ
- フォーム本体の大規模改修は避け、最小の追加ステップに限定
- **完了条件**: 質問が情報価値順で選ばれ、明示 preference が保存される

### Phase 3 — Google Places ランキング接続

- 既存候補取得の後段に `CandidatePreferenceScore` を接続
- rating 偏重を抑え、preference fit を混ぜる
- **完了条件**: 同じ destination でもプロファイル差で上位候補が変わる / 説明 reasons が付く

### Phase 4 — プラン生成接続

- OpenAI プロンプトに Preference 要約（短く）を追加
- Trip DNA 配分は維持したまま、候補プールの並びを Preference 順に
- **完了条件**: 生成プランが preference を反映しつつ destination lock / 件数ルールを守る

### Phase 5 — フィードバック学習

- 保存 / ここだけ変更 / 評価 → PreferenceSignal → soft update
- 単発 inferred では大きく動かないことを verify
- **完了条件**: 置換後の再生成で回避・嗜好方向が弱く反映される

### Phase 6 — 旅行秘書による追加質問

- 不足 dimension かつ impact 大のときだけ 1問確認
- `ai.tsx` 本番接続は別途 MVP ルール解除が必要
- **完了条件**: 不要な連問が発生しない / 回答が profile に反映

### Phase 7 — 天気など外部コンテキスト接続

- weather / mobility を contextFit に組み込み
- センシティブ推定は引き続き禁止
- **完了条件**: 雨の日に outdoor 偏重を抑える等が設定駆動で動く

---

## 11. 非目標（やらないこと）

- 目的×好みの総当たりハードコード
- 韓国（または特定都市）専用の好みスキーマ
- 初回 10問超のアンケート
- 評価・口コミ数だけで有名店を独占させるランキング
- センシティブ属性の行動推定
- 今回フェーズでの UI / API / フォーム / Places / OpenAI 実装変更

---

## 12. 成功指標（後で測る）

1. 初回追加質問が **2〜4 問**に収まる  
2. 「評価が高いから」以外の説明理由が主要アイテムの多数で付く  
3. Preference ありなしで候補上位が有意に変わる（同一 destination）  
4. Trip DNA の構成比・最終日充実度ルールが壊れない  
5. 学習リセット後、推定が消え明示だけ残る  

---

## 13. 関連ファイル（現状・将来）

| 現状 | 将来の接続先（実装時） |
| --- | --- |
| `src/lib/trip-dna/*` | 旅程骨格のまま維持 |
| `src/lib/purpose-profiles.ts` | Intent ブレンドの初期橋渡し |
| `src/lib/places/place-search-intent.ts` | Preference から intent 具体化 |
| `src/lib/places/place-candidate-ranking.ts` | preference score 合成 |
| `src/lib/generate-plan.ts` | Preference 要約のプロンプト注入 |
| `src/types/place-candidate.ts` | score / reasons の添付 |

---

## 14. まとめ

Preference Discovery Engine は、Nanisuru を  
「目的を選ぶアプリ」から「**好みを発見して提案するアプリ**」へ進める中核レイヤーである。

- **Trip DNA** = 旅の型（配分・時間・検証）  
- **Preference Profile** = 旅人の個性（軸・確信度・学習）  
- 最初は聞かず、必要な 2〜4 問だけ聞き、行動からゆっくり学ぶ  
- Places は rating だけで並べず、好み適合で並べ、理由を返す  

この設計に沿えば、カテゴリ追加も好み軸追加も **設定追加**で済み、  
組み合わせ爆発と都市縛りを避けたまま拡張できる。
