/**
 * i18n.js — 言語切替ナビゲーション
 *
 * 仕組み:
 *  - 日本語ページ: プルダウン選択 → /{lang}/{page} へ遷移
 *  - 翻訳済みページ: data-current-lang/data-current-page を参照して遷移
 *  - 翻訳待ち時間ゼロ（事前ビルド済み静的HTML）
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'claude_guide_lang';

  // ── 現在のページ情報を取得 ──
  function getPageInfo() {
    var body = document.body;
    var currentLang = body.getAttribute('data-current-lang') || 'ja';
    var currentPage = body.getAttribute('data-current-page') || '';

    // 日本語ページ（data属性なし）の場合、パスから推定
    if (!currentPage) {
      var p = location.pathname;
      // services/ 内のページ
      if (p.indexOf('/services/') !== -1) {
        currentPage = 'services/' + p.split('/').pop();
      } else {
        currentPage = p.split('/').pop() || 'index.html';
      }
    }

    return { lang: currentLang, page: currentPage };
  }

  // ── 言語切替先URLを計算 ──
  function getLangUrl(targetLang, info) {
    var isInServices = info.page.startsWith('services/');
    var pageName = isInServices ? info.page.replace('services/', '') : info.page;

    if (info.lang === 'ja') {
      // 日本語ページから翻訳ページへ
      if (targetLang === 'ja') return null;
      if (isInServices) {
        // services/api.html → ../../{lang}/services/api.html
        return '../../' + targetLang + '/services/' + pageName;
      } else {
        // index.html → {lang}/index.html
        return targetLang + '/' + info.page;
      }
    } else {
      // 翻訳ページから
      if (targetLang === 'ja') {
        // 日本語に戻る
        if (isInServices) {
          // /{lang}/services/api.html → ../../services/api.html
          return '../../services/' + pageName;
        } else {
          // /{lang}/index.html → ../index.html
          return '../' + info.page;
        }
      } else {
        // 別の翻訳言語へ
        if (isInServices) {
          // /{lang}/services/api.html → ../../{target}/services/api.html
          return '../../' + targetLang + '/services/' + pageName;
        } else {
          // /{lang}/index.html → ../{target}/index.html
          return '../' + targetLang + '/' + info.page;
        }
      }
    }
  }

  // ── localStorage ──
  function getSavedLang() {
    try { return localStorage.getItem(STORAGE_KEY) || 'ja'; } catch (e) { return 'ja'; }
  }
  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  // ── セレクター構築 ──
  function buildSelector() {
    var wrap = document.getElementById('gt-select-wrap');
    if (!wrap) return;

    var info = getPageInfo();

    var LANGS = [
      ['ja', '日本語'],
      ['en', 'English'], ['zh-CN', '中文(简体)'], ['zh-TW', '中文(繁體)'],
      ['ko', '한국어'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'],
      ['pt', 'Português'], ['ru', 'Русский'], ['ar', 'العربية'],
      ['hi', 'हिन्दी'], ['th', 'ภาษาไทย'], ['vi', 'Tiếng Việt'], ['id', 'Bahasa Indonesia']
    ];

    var sel = document.createElement('select');
    sel.id = 'gt-lang-select';
    sel.className = 'notranslate';
    sel.setAttribute('translate', 'no');

    LANGS.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p[0];
      opt.textContent = p[1];
      if (p[0] === info.lang) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.addEventListener('change', function () {
      var targetLang = this.value;
      saveLang(targetLang);

      var url = getLangUrl(targetLang, info);
      if (url) {
        location.href = url;
      }
    });

    wrap.appendChild(sel);

    // ページ読み込み時: 保存言語と現在言語が異なれば自動遷移
    var saved = getSavedLang();
    if (saved && saved !== info.lang) {
      var url = getLangUrl(saved, info);
      if (url) {
        location.href = url;
      }
    }
  }

  // ── 初期化 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSelector);
  } else {
    buildSelector();
  }
})();
