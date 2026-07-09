# Nanisuru 開発環境セットアップ

iPhone Safari で Web 版を確認するための手順です。

## 開発サーバー起動

```bash
cd ~/Nanisuru/nanisuru
npm run dev:phone
```

`dev:phone` は LAN 上で Web サーバーを起動します（ポート `8091`、キャッシュクリア付き）。

## Mac の IP 確認

```bash
ipconfig getifaddr en0
```

Wi‑Fi 接続の IP アドレスが表示されます（例: `192.168.1.23`）。

## iPhone Safari で開く URL

Mac と iPhone を **同じ Wi‑Fi** に接続したうえで、Safari に次を入力します。

```
http://<MacのIP>:8091
```

例: Mac の IP が `192.168.1.23` の場合

```
http://192.168.1.23:8091
```

### 注意

- **`exp://` は Expo Go 用**です。iPhone Safari では使いません。
- **Mac の IP が変わったら URL も変えてください**（Wi‑Fi 切り替え・再起動後など）。

## サーバーが開かないとき

1. **Mac でサーバーが起動しているか** — ターミナルに `npm run dev:phone` の出力が残っているか確認
2. **同じ Wi‑Fi か** — Mac と iPhone が同じネットワークにいるか確認
3. **IP アドレスが正しいか** — `ipconfig getifaddr en0` を再実行し、URL の IP を更新
4. **ポート 8091 が使われているか** — 別プロセスが占有していないか確認（必要なら `--port` を変更）
5. **Mac のファイアウォール** — ローカルネットワークへの接続がブロックされていないか確認

## その他のコマンド

| コマンド | 用途 |
|---------|------|
| `npm start` | 通常の Expo 開発サーバー |
| `npm run web` | ローカル Web のみ（LAN 公開なし） |
