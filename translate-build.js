/**
 * translate-build.js
 * 日本語の原本 HTML を読み取り、各言語の静的翻訳ページを生成する。
 *
 * 使い方:
 *   npm install                # 初回のみ
 *   npm run translate          # 全言語を生成
 *   npm run translate:clean    # 生成済みフォルダを削除してから再生成
 *
 * 出力構造:
 *   /en/index.html, /en/pricing.html, /en/services/api.html ...
 *   内部リンクは相対パスのままなのでそのまま動作する。
 *   i18n.js のパスだけ深さに応じて書き換える。
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const translate = require('google-translate-api-x');

// ── 設定 ──────────────────────────────────────
const ROOT = __dirname;
const LANGS = [
  { code: 'en',    label: 'English' },
  { code: 'zh-CN', label: '中文(简体)' },
  { code: 'zh-TW', label: '中文(繁體)' },
  { code: 'ko',    label: '한국어' },
  { code: 'es',    label: 'Español' },
  { code: 'fr',    label: 'Français' },
  { code: 'de',    label: 'Deutsch' },
  { code: 'pt',    label: 'Português' },
  { code: 'ru',    label: 'Русский' },
  { code: 'ar',    label: 'العربية' },
  { code: 'hi',    label: 'हिन्दी' },
  { code: 'th',    label: 'ภาษาไทย' },
  { code: 'vi',    label: 'Tiếng Việt' },
  { code: 'id',    label: 'Bahasa Indonesia' },
];

const HTML_FILES = [
  'index.html',
  'pricing.html',
  'devices.html',
  'services.html',
  'windows.html',
  'features.html',
  'usage.html',
  'services/chat.html',
  'services/cowork.html',
  'services/code.html',
  'services/skills.html',
  'services/integrations.html',
  'services/api.html',
];

const SKIP_SELECTORS = [
  'script', 'style', 'code', 'pre',
  '.notranslate', '[translate="no"]',
  '#gt-lang-select',
];

const DELAY_BETWEEN_REQUESTS = 1500;
const BATCH_SIZE = 30;

// ── ユーティリティ ────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  削除: ${dir}`);
  }
}

// ── テキストノード収集 ─────────────────────────
function collectTextNodes($, skipSelectors) {
  const texts = [];
  const skipSet = new Set();

  skipSelectors.forEach(sel => {
    $(sel).each(function () {
      $(this).find('*').addBack().each(function () {
        skipSet.add(this);
      });
    });
  });

  function walk(node) {
    if (skipSet.has(node)) return;

    if (node.type === 'text') {
      const text = node.data.trim();
      if (text && text.length > 0 && !/^[\s\n\r]*$/.test(text)) {
        texts.push({ node, original: node.data });
      }
    } else if (node.children) {
      node.children.forEach(child => walk(child));
    }
  }

  $('body').each(function () {
    walk(this);
  });

  return texts;
}

// ── バッチ翻訳 ─────────────────────────────────
async function translateBatch(textArray, targetLang) {
  if (textArray.length === 0) return [];

  const results = [];

  for (let i = 0; i < textArray.length; i += BATCH_SIZE) {
    const batch = textArray.slice(i, i + BATCH_SIZE);
    const textsToTranslate = batch.map(t => t.original);

    try {
      const res = await translate(textsToTranslate, {
        from: 'ja',
        to: targetLang,
      });

      const translated = Array.isArray(res) ? res : [res];
      translated.forEach((r, idx) => {
        results.push({
          node: batch[idx].node,
          translated: r.text,
        });
      });
    } catch (err) {
      console.error(`    翻訳エラー (batch ${i}): ${err.message}`);
      batch.forEach(t => {
        results.push({ node: t.node, translated: t.original });
      });
    }

    if (i + BATCH_SIZE < textArray.length) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  return results;
}

// ── i18n.js スクリプトパス書き換え ──────────────
function fixScriptPaths($, filePath) {
  const isInServices = filePath.startsWith('services/');

  // ルートHTMLの場合: src="i18n.js" → src="../i18n.js"
  // services/HTMLの場合: src="../i18n.js" → src="../../i18n.js"
  $('script[src]').each(function () {
    const src = $(this).attr('src');
    if (src === 'i18n.js') {
      $(this).attr('src', '../i18n.js');
    } else if (src === '../i18n.js') {
      $(this).attr('src', '../../i18n.js');
    }
  });
}

// ── 言語セレクター情報を設定 ─────────────────────
function setLangMeta($, langCode, filePath) {
  const isInServices = filePath.startsWith('services/');
  const currentPage = isInServices
    ? `services/${path.basename(filePath)}`
    : path.basename(filePath);

  $('body').attr('data-current-page', currentPage);
  $('body').attr('data-current-lang', langCode);

  const htmlLang = langCode === 'zh-CN' ? 'zh-Hans' : langCode === 'zh-TW' ? 'zh-Hant' : langCode;
  $('html').attr('lang', htmlLang);
}

// ── 単一ファイルの翻訳処理 ──────────────────────
async function translateFile(filePath, langCode) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`    スキップ (存在しない): ${filePath}`);
    return;
  }

  const html = fs.readFileSync(fullPath, 'utf-8');
  const $ = cheerio.load(html, { decodeEntities: false });

  // テキストノード収集＆翻訳
  const textNodes = collectTextNodes($, SKIP_SELECTORS);
  console.log(`    ${textNodes.length} テキストノード`);

  const translated = await translateBatch(textNodes, langCode);

  // 翻訳結果を DOM に適用
  translated.forEach(({ node, translated: text }) => {
    const original = node.data;
    const leadingSpace = original.match(/^(\s*)/)[1];
    const trailingSpace = original.match(/(\s*)$/)[1];
    node.data = leadingSpace + text + trailingSpace;
  });

  // i18n.js パス修正
  fixScriptPaths($, filePath);

  // 言語メタ情報設定
  setLangMeta($, langCode, filePath);

  // title 翻訳
  const titleEl = $('title');
  if (titleEl.length > 0) {
    try {
      const res = await translate(titleEl.text(), { from: 'ja', to: langCode });
      titleEl.text(res.text);
    } catch (e) { /* 原文のまま */ }
  }

  // meta description 翻訳
  const metaDesc = $('meta[name="description"]');
  if (metaDesc.length > 0) {
    try {
      const res = await translate(metaDesc.attr('content'), { from: 'ja', to: langCode });
      metaDesc.attr('content', res.text);
    } catch (e) { /* 原文のまま */ }
  }

  // 出力
  const outDir = filePath.startsWith('services/')
    ? path.join(ROOT, langCode, 'services')
    : path.join(ROOT, langCode);
  ensureDir(outDir);

  const outFile = path.join(outDir, path.basename(filePath));
  fs.writeFileSync(outFile, $.html(), 'utf-8');
}

// ── メイン処理 ──────────────────────────────────
async function main() {
  const isClean = process.argv.includes('--clean');

  console.log('');
  console.log('Claude Guide — multi-language build');
  console.log('='.repeat(50));

  if (isClean) {
    console.log('Cleaning existing translations...');
    LANGS.forEach(lang => cleanDir(path.join(ROOT, lang.code)));
  }

  for (const lang of LANGS) {
    console.log('');
    console.log(`${lang.label} (${lang.code})...`);
    console.log('-'.repeat(40));

    for (const file of HTML_FILES) {
      console.log(`  ${file}`);
      await translateFile(file, lang.code);
      await sleep(DELAY_BETWEEN_REQUESTS);
    }

    console.log(`  ${lang.label} done`);
  }

  console.log('');
  console.log('='.repeat(50));
  console.log('All languages generated!');
  console.log('');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
