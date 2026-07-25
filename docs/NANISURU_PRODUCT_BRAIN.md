# Nanisuru Product Brain

**ユーザー目線で絶対に守るルール。**  
Cursor / 開発者は、プラン生成・Maps・Weather・Places・行程 UI を触る前に必ずこのファイルを読むこと。

> Any implementation that violates Product Brain rules is not acceptable.

関連ドキュメント:

| Doc | 役割 |
| --- | --- |
| **このファイル** | ユーザー目線の絶対ルール（プロダクト判断の基準） |
| `docs/NANISURU_MVP_RULES.md` | 赤エラー禁止・画面破壊禁止・MVP制約 |
| `docs/PLAN_GENERATION_RULES.md` | destination / 通貨 / 時間 / Maps・SNS の詳細 |
| `docs/PREFERENCE_DISCOVERY_ENGINE.md` | 好み発見エンジン（設計） |
| `npm run verify:beta-acceptance` | 本ルールの自動回帰ゲート |

実装の正はコードだが、**プロダクト判断がコードと矛盾したら Product Brain を優先して直す**。

---

## 1. ユーザーが入力していないことを勝手に仮定しない

禁止（明示入力がない限り）:

- 空港・飛行機・フライト
- 新幹線・駅への帰路
- 車・タクシー前提
- 帰宅方法・帰路優先
- 出発地 / 到着方法の補完
- 性別による好み
- 同行者の好みの決めつけ

### arrivalTime / departureTime

明示されていない限り:

| フィールド | 意味 |
| --- | --- |
| `arrivalTime` | **プラン開始希望時刻**（旅行先への到着／飛行機着陸とは限らない） |
| `departureTime` | **プラン終了希望時刻**（空港出発／帰宅とは限らない） |

内部コンテキスト（未入力時のデフォルト）:

- `arrivalContext.type = already_in_area`
- `departureContext.type = stay_in_area`

空港・駅を使ってよいのは、ユーザーが明示した場合のみ  
（`arrivalPlace` / `departurePlace` / `arrivalPoint` / `departurePoint` / transport 文言など）。

帰路未指定の最終日は、拠点エリア・ホテル周辺・解散で終える。  
「空港へ向かう」「空港到着目安」を出さない。

---

## 2. 実在スポット以外を店・施設のように見せない

- Google Places 由来（`placeId` + `source=google_places` 等）なら実在スポットとして扱える
- 実在スポットは `placeName` / 安全な `mapsQuery` / 可能な範囲で座標を保持する
- 実在確認できない場合は `isSpecificPlace=false`
- **架空の店名を作らない**
- 抽象予定は「難波エリアで自由時間」のように正直に表示する

禁止タイトル例（実在スポット扱い禁止）:

- 人気カフェ / 韓国料理ディナー / 買い物スポット
- 市場を散策 / 美しい公園で散歩 / 〇〇で楽しむ
- `日本・大阪（難波拠点）でお土産・ショッピングを楽しむ`
- UI確認用 / テスト用スポット

---

## 3. 目的は最低限プランに反映する

- グルメを選んだら **食事 0 件は禁止**
- 買い物を選んだら **買い物 0 件は禁止**
- 観光を選んだら **観光 0 件は禁止**
- 複数目的なら **全目的を最低 1 回は反映**
- 主目的は多め、補助目的も無視しない（例: primary 55% / secondary 30% / tertiary 15%）

候補不足時は架空店舗で埋めず、エリア自由時間として正直に落とす。

---

## 4. 時間は現実的にする

- 開始希望より前に予定を入れない
- 終了希望より後に予定を入れない
- 食事間隔を壊さない
- 利用可能時間があるのに 1 日 1 件だけにしない
- 夜景を昼に入れない
- 移動時間を無視しない
- **最終日でも帰路未指定なら空港を出さない**

---

## 5. 押せるボタンは必ず動く

対象例:

- Google Maps / 現在地から道案内
- Instagram / TikTok / Google 画像
- ここだけ変更 / 天気に合わせて再調整
- 詳細を見る / 戻る / 閉じる

**動かせないならボタンを出さない。**  
見た目だけ押せる no-op CTA はバグ。

---

## 6. Maps / 外部リンクは壊れた URL を作らない

URL・query・destination に以下を入れたら FAIL:

- `undefined` / `null` / `NaN` / `invalid` / `invalid coord`
- 空 query / 空 destination
- `query_place_id=`（空）
- `destination=undefined` / `destination=null`

`isSpecificPlace=false` の抽象予定に、無理に Maps / 道案内 / SNS を出さない。

---

## 7. 天気は実データがある時だけ断定する

`weatherAvailable=false`（または予報なし）のとき禁止:

- 雨 / 傘 / 防水対策
- 強風 / 猛暑 / 寒さ
- 「屋内中心が安心」など、データ根拠のない断定

予報がない場合は、**季節の一般傾向だけ**を安全に表示する。

---

## 8. 失敗時は元プランを守る

- 無限ローディング禁止（失敗・timeout 後は必ず loading 解除）
- 途中まで壊れたプランを画面に反映しない
- OpenAI timeout でも赤エラーを出さない
- 再調整（天気 / ここだけ変更）失敗時は **元プラン維持**
- 検証を通った payload だけ原子的に差し替える

---

## 9. 知人 β に出せる最低条件

- 実在スポット中心
- 時間破綻なし
- Maps 正常
- 主要ボタンが動く
- 選択目的が反映される
- 失敗しても壊れない
- iPhone Safari で操作可能

満たせない変更はマージ・知人共有しない。

---

## Cursor への作業依頼テンプレ

```text
Before changing plan generation / Maps / Weather / Places / itinerary UI,
read docs/NANISURU_PRODUCT_BRAIN.md and obey it.
Run npm run verify:beta-acceptance before finishing.
Do not invent airport/transport, abstract venue titles, broken Maps URLs,
or weather claims without weatherAvailable=true.
Do not commit unless asked.
```

---

## 変更時チェックリスト（実装者 / Cursor）

1. 未入力の交通・帰路を仮定していないか
2. 選択目的が 0 件になっていないか
3. 抽象タイトルを `isSpecificPlace=true` にしていないか
4. Maps URL に壊れたトークンがないか
5. 押せない CTA を出していないか
6. 天気未取得で傘・雨を断定していないか
7. 失敗時に loading が残り、元プランが壊れていないか
8. `npm run verify:beta-acceptance` が PASS か
