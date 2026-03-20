# AIガイドブック for Claude

AnthropicのAIアシスタント「Claude」に関する情報を日本語で解説する非公式情報サイト。  
Node.jsによる自動更新システム内蔵。APIキー不要。

---

## ⚠️ 重要事項

- 本サイトは **Anthropicとは無関係の独立した非公式情報サイト** です
- 「Claude」「Anthropic」はAnthropic PBCの商標です
- 情報は参考目的のみです。正確性・最新性は保証しません
- 商用利用の場合は利用規約・商標ポリシーを遵守してください

---

## ファイル構成

```
claude-site/
├── data/
│   ├── content.json          # コンテンツデータ（単一ソース・自動更新対象）
│   └── .hash_cache.json      # ハッシュキャッシュ（自動生成）
├── scripts/
│   ├── build.js              # HTMLビルダー（content.json → dist/index.html）
│   └── updater.js            # 自動更新チェッカー（Anthropic公式ページを監視）
├── dist/
│   └── index.html            # 生成されたウェブサイト（公開用）
├── logs/
│   └── updater.log           # 更新ログ（自動生成）
├── package.json
└── README.md
```

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

> Node.js 18以上が必要。Node 18+はfetchが組み込みのため、node-fetchは Node 16以下向けのフォールバックです。

### 2. HTMLを初回ビルド

```bash
npm run build
```

`dist/index.html` が生成されます。これをウェブサーバーに配置してください。

### 3. 更新チェックのテスト（dry-run）

```bash
npm run update:dry
```

Anthropic公式ページをフェッチし、差分を確認します（ファイルは更新しません）。

### 4. 更新チェックを実行

```bash
npm run update
```

変更が検出された場合、`data/content.json` を更新し `dist/index.html` を再生成します。

---

## 自動実行の設定（cron）

### Linux / macOS

```bash
# crontab を編集
crontab -e

# 毎日午前3時に実行
0 3 * * * cd /path/to/claude-site && node scripts/updater.js >> logs/updater.log 2>&1

# より頻繁に（6時間ごと）
0 */6 * * * cd /path/to/claude-site && node scripts/updater.js >> logs/updater.log 2>&1
```

### Windows（タスクスケジューラ）

```
操作: C:\Program Files\nodejs\node.exe
引数: C:\path\to\claude-site\scripts\updater.js
開始場所: C:\path\to\claude-site
トリガー: 毎日 午前3:00
```

### GitHub Actions（推奨）

```yaml
# .github/workflows/update.yml
name: Auto Update
on:
  schedule:
    - cron: '0 18 * * *'  # 日本時間 午前3時 = UTC 18時
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: node scripts/updater.js
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add -A
          git diff --staged --quiet || git commit -m "Auto update $(date '+%Y-%m-%d')"
          git push
```

---

## コンテンツの手動更新

`data/content.json` を直接編集し、`npm run build` を実行してください。

### モデル情報の更新例

```json
// data/content.json の models 配列に追加
{
  "id": "haiku",
  "name": "Haiku",
  "version": "4.6",       // ← バージョンを更新
  "model_id": "claude-haiku-4-6",
  "price_input": "$0.70", // ← 料金を更新
  ...
}
```

### 更新情報の手動追加

```json
// data/content.json の updates 配列の先頭に追加
{
  "date": "2026-04-01",
  "date_label": "2026年4月1日",
  "version": "手動更新",
  "items": [
    {
      "category": "モデル",
      "type": "new",
      "title": "Claude Haiku 4.6 リリース",
      "detail": "新しいHaikuモデルが登場。より高速・低コストに。"
    }
  ]
}
```

---

## ウェブサーバーへの配置

`dist/index.html` は単一ファイルの静的サイトです。

### Nginx設定例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/claude-site/dist;
    index index.html;

    # HTMLキャッシュを短く設定（自動更新を素早く反映）
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }

    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
}
```

### Cloudflare Pages / Netlify / Vercel

`dist/` ディレクトリをデプロイ対象に指定してください。

---

## セキュリティ・法的事項

| 項目 | 対応 |
|------|------|
| APIキー | **一切使用しない**（パブリックページのみ参照） |
| ユーザーデータ収集 | なし |
| Anthropic商標 | 「Claude」「Anthropic」の商標使用について、情報提供目的の範囲で使用 |
| 免責表示 | サイト上部・フッターに明示 |
| AI作成明示 | フッターに「Claudeによって作成」を表示 |
| robots.txt | 必要に応じて配置 |

---

## robots.txt（推奨）

```
# /dist/robots.txt
User-agent: *
Allow: /
Sitemap: https://your-domain.com/sitemap.xml

# Claudeガイドボット（自動更新専用）
User-agent: ClaudeGuideBot
Allow: /
```

---

## ライセンス

本サイトのオリジナルコードは UNLICENSED（非公開ライセンス）です。  
「Claude」「Anthropic」の名称・ロゴはAnthropicの商標です。
