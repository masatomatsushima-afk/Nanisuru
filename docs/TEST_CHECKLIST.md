# iPhone Safari 実機テストチェックリスト（Lightweight MVP）

Mac と iPhone を**同じWi-Fi**に接続し、Mac の LAN IP 経由で iPhone Safari から確認するための
最小チェックリストです。`docs/NANISURU_MVP_RULES.md` / `docs/PLAN_GENERATION_RULES.md` の
ルールが守られているかをここで確認します。

> 既存の詳細版チェックリスト（全機能網羅）は `docs/MVP_TEST_CHECKLIST.md` を参照。
> こちらは Lightweight MVP の主要フローだけに絞った短縮版です。

---

## 0. 前提

- Mac 側で開発サーバーを起動しておく（`npx expo start` など）。
- Mac と iPhone が同じ Wi-Fi に接続されていること。
- iPhone Safari で以下の URL を開く（**Mac の現在の LAN IP に合わせて読み替える**）:

  ```
  http://192.168.0.11:8091
  ```

  IP・ポートは環境によって変わるため、`localhost` ではなく必ず Mac の LAN IP を使うこと。

---

## 1. 基本画面・ナビゲーション

- [ ] Home が表示される（真っ白画面・赤エラー画面にならない）
- [ ] 下タブ（Home / Discover / My Trips / Profile など）を一通り移動できる
- [ ] Plan Form（旅行プラン作成フォーム）が表示され、入力できる
- [ ] プラン生成後、Plan Detail 画面が表示される
- [ ] 画面のどこにも赤エラー（Uncaught Error / Console Error の赤画面）が出ない

## 2. 目的地ロック（destination lock）確認

以下の目的地でそれぞれプランを生成し、**目的地外のスポットが出ていないこと**を確認する。

- [ ] **韓国**: 大阪・東京など日本国内スポットが混ざっていない
- [ ] **福岡**: 大阪・東京・韓国・海外スポットが混ざっていない
- [ ] **Paris**: 日本スポットが混ざっていない
- [ ] **Melbourne**: 他都市・他国のスポットが混ざっていない
- [ ] 上記いずれでも、実在するか怪しい店名を無理に作っていない
  （曖昧な場合は「〜中心部を散策」等の安全な表現になっている）

## 3. 通貨（currency）確認

- [ ] destination を変えても、**ユーザーが選んだ currency（JPY / AUD / KRW など）が勝手に変わらない**
- [ ] 例: destination = 韓国、currency = JPY を選択 → プラン内の予算表示が JPY のまま
- [ ] 例: destination = Paris、currency = JPY を選択 → プラン内の予算表示が JPY のまま
- [ ] Plan Detail の予算表示が `plan.budget.display`（あれば）または `budget + currency` で
  正しく表示されている（`undefined` や壊れた表記が出ない）

## 4. Google Maps / SNS ボタン確認

- [ ] 具体的なスポット（`isSpecificPlace: true` 相当）で「Google Mapsで開く」をタップし、
  destination（例: Seoul Korea / Fukuoka Japan）に近い結果が開く（現在地周辺の結果にならない）
- [ ] 抽象的なアイテム（移動・チェックイン等）では「現在地から道案内」ボタンが**出ない**
- [ ] Instagram / TikTok / Google画像 ボタンも、destination を含んだ検索になっている
  （title だけの曖昧な検索になっていない）

## 5. 時間ルール確認

- [ ] 1日目の最初のアイテムが到着時刻（arrivalTime）以降になっている
- [ ] 最終日の最後のアイテムが出発時刻（departureTime）の2〜3時間前までに終わっている
- [ ] 1日あたりのアイテム数がおおよそ 3〜5件で、明らかに無理な移動距離が入っていない

## 6. 壊れていないことの確認（既存機能）

- [ ] Home / Discover / My Trips / Profile が引き続き問題なく開ける
- [ ] custom bottom nav が復活していない（既存の下タブのまま）
- [ ] Discover が重い読み込みをしていない（MVPの軽量版のまま）
- [ ] 旅行秘書タブが MVP 仮画面のまま（本番AI接続していない）

---

## 問題を見つけたときの報告フォーマット

```
端末: iPhone Safari
URL:
目的地 / 通貨:
手順:
期待する結果:
実際の結果:
スクリーンショット: （あれば）
```
