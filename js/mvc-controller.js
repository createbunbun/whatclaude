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

    // ── Model イベント購読 ──────────────
    ClaudeModel.on('loading', isLoading => {
      ClaudeView.setLoading(isLoading);
    });

    ClaudeModel.on('updatesFetched', updates => {
      const ts = ClaudeModel.getTimestamp();
      ClaudeView.renderTimestamp(ts);
      ClaudeView.renderUpdateBadge(updates.length);
      ClaudeView.renderUpdatePanel(updates);
    });

    ClaudeModel.on('newUpdates', newItems => {
      if (newItems.length > 0) {
        _showUpdateNotification(newItems.length);
      }
    });

    // ── 更新バッジのトグル ───────────────
    const badge = document.getElementById('update-badge');
    const panel = document.getElementById('update-panel');
    if (badge && panel) {
      badge.addEventListener('click', () => {
        panel.classList.toggle('visible');
        if (panel.classList.contains('visible')) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    // ── ポーリング開始 ──────────────────
    // 5分ごとに updates.json を再取得
    ClaudeModel.startPolling(5);
  }

  // ── 新着トースト通知 ────────────────────
  function _showUpdateNotification(count) {
    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.innerHTML = `🔔 <strong>${count}件</strong>の新しい更新情報があります`;
    toast.style.cssText = `
      position: fixed; bottom: 80px; right: 24px;
      background: white; border: 1px solid var(--teal);
      color: var(--teal); border-radius: 12px;
      padding: 12px 20px; font-size: 0.85rem;
      box-shadow: 0 4px 20px rgba(0,0,0,.12);
      z-index: 200; animation: slideUp .3s ease;
      font-family: var(--font-main);
    `;

    const style = document.createElement('style');
    style.textContent = `@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  return { init };
})();

// ── DOM 準備完了後に起動 ─────────────────
document.addEventListener('DOMContentLoaded', () => {
  ClaudeController.init();
});
