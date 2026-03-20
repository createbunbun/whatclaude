#!/usr/bin/env node
/**
 * updater.js — 自動更新システム
 *
 * 役割:
 *   1. Anthropic公式ページ（docs / news / pricing）をfetch
 *   2. 前回取得内容とハッシュ比較で差分検出
 *   3. 変更があれば data/content.json を更新
 *   4. dist/index.html を再生成
 *   5. ログ出力
 *
 * 実行方法:
 *   node scripts/updater.js           # 手動実行
 *   node scripts/updater.js --dry-run # 差分確認のみ（ファイル書き換えなし）
 *
 * cron設定例（毎日午前3時に実行）:
 *   0 3 * * * cd /path/to/claude-site && node scripts/updater.js >> logs/updater.log 2>&1
 *
 * 依存パッケージ:
 *   npm install node-fetch cheerio
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// Node 18+ は fetch 組み込み。それ以下は node-fetch を使う
const fetch = globalThis.fetch ?? require('node-fetch');

// ── パス定義 ──────────────────────────────────────
const ROOT        = path.join(__dirname, '..');
const CONTENT_JSON = path.join(ROOT, 'data', 'content.json');
const HASH_FILE    = path.join(ROOT, 'data', '.hash_cache.json');
const TEMPLATE_JS  = path.join(__dirname, 'build.js');
const LOG_DIR      = path.join(ROOT, 'logs');
const DRY_RUN      = process.argv.includes('--dry-run');

// ── ロガー ────────────────────────────────────────
function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, 'updater.log'), line + '\n');
  } catch(_) {}
}

// ── ソース定義 ────────────────────────────────────
// Anthropicの公式ページを直接確認（APIキー不要・パブリックページのみ）
const SOURCES = [
  {
    key: 'pricing',
    url: 'https://www.anthropic.com/pricing',
    description: '料金ページ',
  },
  {
    key: 'models',
    url: 'https://docs.anthropic.com/en/docs/about-claude/models/overview',
    description: 'モデル一覧',
  },
  {
    key: 'news',
    url: 'https://www.anthropic.com/news',
    description: 'ニュース',
  },
  {
    key: 'api_ref',
    url: 'https://docs.anthropic.com/en/api/getting-started',
    description: 'API Getting Started',
  },
];

// ── フェッチ（リトライ付き） ──────────────────────
async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClaudeGuideBot/1.0; +https://your-site.example.com/bot)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      log('WARN', `Fetch attempt ${i + 1}/${retries} failed for ${url}: ${e.message}`);
      if (i < retries - 1) await sleep(2000 * (i + 1));
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── ハッシュ計算 ──────────────────────────────────
function hashContent(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex').slice(0, 16);
}

// ── ハッシュキャッシュ読み書き ────────────────────
function loadHashCache() {
  try {
    return JSON.parse(fs.readFileSync(HASH_FILE, 'utf-8'));
  } catch (_) {
    return {};
  }
}

function saveHashCache(cache) {
  fs.writeFileSync(HASH_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

// ── テキスト抽出（HTMLから主要テキストのみ） ────────
function extractText(html) {
  // scriptタグ・styleタグ・コメントを除去
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000); // 上限50KB
}

// ── 変更点の意味解析 ─────────────────────────────
// 注: 正規表現でシンプルに価格・モデル名変更を検出する軽量アプローチ
//     Anthropic APIは使わず、パブリックページのテキスト差分のみで判断
function analyzeChanges(key, oldText, newText) {
  const changes = [];

  if (key === 'models') {
    // 新しいモデル名のパターン検出
    const modelPattern = /claude-(\w+-\d+[\w-]*)/gi;
    const oldModels = new Set([...(oldText || '').matchAll(modelPattern)].map(m => m[0].toLowerCase()));
    const newModels = new Set([...(newText || '').matchAll(modelPattern)].map(m => m[0].toLowerCase()));

    for (const m of newModels) {
      if (!oldModels.has(m)) {
        changes.push({
          category: 'モデル',
          type: 'new',
          title: `新モデル検出: ${m}`,
          detail: `ドキュメントに新しいモデル識別子 ${m} が確認されました。詳細は公式ドキュメントをご確認ください。`,
        });
      }
    }

    // 価格変更の検出（$X.XX パターン）
    const pricePattern = /\$(\d+\.?\d*)\s*\/\s*MTok/gi;
    const oldPrices = [...(oldText || '').matchAll(pricePattern)].map(m => m[0]);
    const newPrices = [...(newText || '').matchAll(pricePattern)].map(m => m[0]);
    if (oldPrices.join() !== newPrices.join() && oldPrices.length > 0) {
      changes.push({
        category: 'モデル',
        type: 'update',
        title: 'API料金の変更を検出',
        detail: '料金ページでAPIトークン価格の変更が確認されました。詳細は公式ページをご確認ください。',
      });
    }
  }

  if (key === 'pricing') {
    // プラン料金変更の検出
    const pricePattern = /\$(\d+)\s*(\/\s*month|per month|\/month)/gi;
    const oldPrices = [...(oldText || '').matchAll(pricePattern)].map(m => m[1]);
    const newPrices = [...(newText || '').matchAll(pricePattern)].map(m => m[1]);
    if (JSON.stringify(oldPrices.sort()) !== JSON.stringify(newPrices.sort()) && oldPrices.length > 0) {
      changes.push({
        category: '料金',
        type: 'update',
        title: 'プラン料金の変更を検出',
        detail: '料金ページでプラン価格の変更が確認されました。詳細は公式ページをご確認ください。',
      });
    }
  }

  if (key === 'news') {
    // 新しい製品名キーワード検出
    const productKeywords = ['Claude Code', 'Cowork', 'Claude in Chrome', 'new model', 'new product', '新製品', 'launch'];
    for (const kw of productKeywords) {
      if ((newText || '').includes(kw) && !(oldText || '').includes(kw)) {
        changes.push({
          category: '製品',
          type: 'new',
          title: `新情報を検出: "${kw}"`,
          detail: `ニュースページで "${kw}" に関する新しいコンテンツが確認されました。公式ページをご確認ください。`,
        });
        break;
      }
    }
  }

  return changes;
}

// ── content.json に更新を追記 ─────────────────────
function appendUpdatesToContent(allChanges) {
  const content = JSON.parse(fs.readFileSync(CONTENT_JSON, 'utf-8'));
  const now = new Date();
  const dateLabel = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateISO = now.toISOString().split('T')[0];

  const entry = {
    date: dateISO,
    date_label: dateLabel,
    version: `自動更新 ${now.toLocaleString('ja-JP')}`,
    items: allChanges,
  };

  // 同日エントリがあればマージ
  const existing = content.updates.find(u => u.date === dateISO);
  if (existing) {
    existing.items.push(...allChanges);
    existing.version = entry.version;
  } else {
    content.updates.unshift(entry);
  }

  // 最新100件まで保持
  if (content.updates.length > 100) {
    content.updates = content.updates.slice(0, 100);
  }

  content._meta.generated_at = now.toISOString();
  content._meta.version = (parseFloat(content._meta.version) + 0.1).toFixed(1);

  if (!DRY_RUN) {
    fs.writeFileSync(CONTENT_JSON, JSON.stringify(content, null, 2), 'utf-8');
    log('INFO', `content.json を更新しました (${allChanges.length}件の変更を追記)`);
  } else {
    log('INFO', `[DRY-RUN] content.json は更新されません (${allChanges.length}件の変更を検出)`);
  }
}

// ── HTML再生成 ────────────────────────────────────
function rebuildHtml() {
  if (DRY_RUN) {
    log('INFO', '[DRY-RUN] HTML再生成はスキップ');
    return;
  }
  try {
    require(TEMPLATE_JS);
    log('INFO', 'dist/index.html を再生成しました');
  } catch (e) {
    log('ERROR', `HTML再生成エラー: ${e.message}`);
  }
}

// ── メイン処理 ────────────────────────────────────
async function main() {
  log('INFO', `===== updater.js 開始 ${DRY_RUN ? '[DRY-RUN]' : ''} =====`);

  const hashCache = loadHashCache();
  const allChanges = [];
  let anyChanged = false;

  for (const source of SOURCES) {
    log('INFO', `チェック中: ${source.description} (${source.url})`);

    const html = await fetchPage(source.url);
    if (!html) {
      log('WARN', `${source.key}: フェッチ失敗 — スキップ`);
      continue;
    }

    const text = extractText(html);
    const newHash = hashContent(text);
    const oldHash = hashCache[source.key];

    if (oldHash === newHash) {
      log('INFO', `${source.key}: 変更なし (hash: ${newHash})`);
      continue;
    }

    log('INFO', `${source.key}: 変更を検出! (${oldHash || 'new'} → ${newHash})`);
    anyChanged = true;

    // 前回テキストを取得（差分分析用）
    const oldTextFile = path.join(ROOT, 'data', `.cache_${source.key}.txt`);
    let oldText = '';
    try { oldText = fs.readFileSync(oldTextFile, 'utf-8'); } catch (_) {}

    // 意味のある変更を分析
    const changes = analyzeChanges(source.key, oldText, text);
    if (changes.length > 0) {
      log('INFO', `${source.key}: ${changes.length}件の意味的変更を検出`);
      allChanges.push(...changes);
    }

    // キャッシュ更新
    if (!DRY_RUN) {
      hashCache[source.key] = newHash;
      fs.writeFileSync(oldTextFile, text, 'utf-8');
    }
  }

  if (!DRY_RUN) {
    saveHashCache(hashCache);
  }

  if (allChanges.length > 0) {
    log('INFO', `合計 ${allChanges.length} 件の変更を content.json に追記します`);
    appendUpdatesToContent(allChanges);
    rebuildHtml();
  } else if (anyChanged) {
    log('INFO', 'ページ変更はありましたが、意味的な差分は検出されませんでした');
    // ページ変更があった場合は念のためHTMLを再生成（タイムスタンプ更新のため）
    if (!DRY_RUN) {
      // _meta.generated_at だけ更新
      const content = JSON.parse(fs.readFileSync(CONTENT_JSON, 'utf-8'));
      content._meta.generated_at = new Date().toISOString();
      fs.writeFileSync(CONTENT_JSON, JSON.stringify(content, null, 2), 'utf-8');
      rebuildHtml();
    }
  } else {
    log('INFO', '変更なし — HTML再生成をスキップ');
  }

  log('INFO', '===== updater.js 完了 =====');
}

main().catch(e => {
  log('ERROR', `予期しないエラー: ${e.stack}`);
  process.exit(1);
});
