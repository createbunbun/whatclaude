/**
 * Claude ガイド - View (MVC)
 * UI レンダリング・DOM 操作レイヤー
 */

const ClaudeView = (function () {
  'use strict';

  // ── モバイルナビ ────────────────────────
  function setupMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const links  = document.getElementById('nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });

    // ページ外クリックで閉じる
    document.addEventListener('click', e => {
      if (!toggle.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('open');
      }
    });
  }

  // ── スクロールトップ ────────────────────
  function setupScrollTop() {
    const btn = document.getElementById('scroll-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });

    btn.addEventListener('click', () =>
      window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ── タブ ────────────────────────────────
  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.tabGroup || 'default';
        const target = btn.dataset.tab;

        document.querySelectorAll(`.tab-btn[data-tab-group="${group}"]`)
          .forEach(b => b.classList.remove('active'));
        document.querySelectorAll(`.tab-panel[data-tab-group="${group}"]`)
          .forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const panel = document.querySelector(`.tab-panel[data-tab="${target}"][data-tab-group="${group}"]`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ── アクティブナビリンク ─────────────────
  function setActiveNavLink() {
    const current = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href').split('/').pop();
      if (href === current) a.classList.add('active');
    });
  }

  // ── Public ─────────────────────────────
  return {
    setupMobileNav,
    setupScrollTop,
    setupTabs,
    setActiveNavLink,
  };
})();
