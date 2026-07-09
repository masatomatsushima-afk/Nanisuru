# Nanisuru MVP 最優先ルール

このドキュメントは、Nanisuru を **モバイルSafari実機での開発テスト向けMVP** として安定させるための
最優先ルールです。Cursor（AIエージェント）はコード変更前に必ずこのファイルを確認してください。

対象読者: Cursor（このリポジトリで作業するAIエージェント）と開発者本人。

---

## 0. このドキュメントの位置づけ

- `docs/NANISURU_MVP_RULES.md` — 最優先ルール（このファイル）
- `docs/PLAN_GENERATION_RULES.md` — 旅行プラン生成（destination / 通貨 / 時間 / Maps・SNS）の詳細ルール
- `docs/TEST_CHECKLIST.md` — iPhone Safari 実機での確認手順
- `docs/PRODUCT_ROADMAP.md` — Nanisuru の最終目標と、MVPで意図的に後回しにしている機能の一覧

4つとも**ドキュメントのみ**で、アプリ本体の挙動を変えるものではありません。実装は
`src/lib/lightweight-mvp.ts`, `src/lib/generate-plan.ts`, `src/lib/destination-safety.ts` などの
実コードが正です。矛盾があればコードを正としつつ、このドキュメントを更新してください。

---

## 1. 最優先ルール（守れないなら実装しない）

### 1.1 赤エラーを出さない
- Uncaught Error / Console Error（React Native の赤画面）を新たに発生させる変更はしない。
- 開発用の非致命エラーは `console.error` ではなく `console.warn` を使う
  （例: `src/lib/plan-api-health-check.ts`）。
- 修正の最後に必ず「赤エラーが増えていないか」をセルフチェックする。

### 1.2 既存の主要画面を壊さない
以下の画面・フローは、明示的に依頼されない限り変更しない・壊さない:
- Home（`src/app/(tabs)/index.tsx`）
- Discover（発見タブ）
- My Trips（マイトリップ）
- Profile（マイページ）
- Plan Form（旅行プラン作成フォーム）
- Plan Detail（`src/app/plan-detail.tsx`）
- 下タブ（`src/app/(tabs)/_layout.tsx`）

### 1.3 まだ戻さない機能（明示的な指示があるまで）
- custom bottom nav（独自実装の下タブ）
- Discover の重い読み込み（Supabase 全件取得など）
- Supabase 保存の本格実装（トリップ保存の永続化フル機能）
- AI secretary の本番API接続（`src/app/(tabs)/ai.tsx` は現状MVP仮画面のまま）

これらは `src/lib/lightweight-mvp.ts` の `LIGHTWEIGHT_MVP` フラグ（`__DEV__` 時のみ有効）で
意図的に無効化されています。フラグの意味を変えずに個別機能だけ復活させない。

### 1.4 大規模リファクタ禁止
- 「ついでにきれいにする」「型を全体的に見直す」等の広範囲な変更はしない。
- 1つの依頼に対する変更ファイル数・行数は必要最小限にする。
- 既存の命名・ディレクトリ構成・コンポーネント分割方針は踏襲する。

---

## 2. 関連ドキュメント

- 旅行プラン生成（目的地ロック・通貨・時間・Maps/SNS）のルール: `docs/PLAN_GENERATION_RULES.md`
- iPhone Safari 実機テスト手順: `docs/TEST_CHECKLIST.md`
- 最終目標ロードマップ（Google Places連携・予約・AI旅行秘書など将来機能）: `docs/PRODUCT_ROADMAP.md`
- Cursor（AIエージェント）自身の作業ルールは `docs/PLAN_GENERATION_RULES.md` 末尾の
  「Cursorへの作業ルール」を参照。

---

## 3. このルールを変えていいとき

- ユーザー（開発者）が明示的に「この制約を外していい」「本格実装に進みたい」と指示した場合のみ、
  該当セクションを更新してから実装に進む。
- 迷った場合は実装せず、まず確認する（詳細は `docs/PLAN_GENERATION_RULES.md` の
  「Cursorへの作業ルール」参照）。
