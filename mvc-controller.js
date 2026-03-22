/**
 * Claude ガイド - Controller (MVC)
 * Model と View を協調させる制御レイヤー
 */

const ClaudeController = (function () {
  'use strict';

  function init() {
    // ── View セットアップ ────────────────
    ClaudeView.setupMobileNav();
    ClaudeView.setupScrollTop();
    ClaudeView.setupTabs();
    ClaudeView.setActiveNavLink();
  }

  return { init };
})();

// ── DOM 準備完了後に起動 ─────────────────
document.addEventListener('DOMContentLoaded', () => {
  ClaudeController.init();
});
