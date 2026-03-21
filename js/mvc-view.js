/**
 * Claude ガイド - View (MVC)
 * UI レンダリング・DOM 操作レイヤー
 */

const ClaudeView = (function () {
  'use strict';

  const CATEGORY_LABELS = {
    model:    '🤖 モデル',
    product:  '📦 製品',
    pricing:  '💳 料金',
    api:      '🔌 API',
    feature:  '✨ 機能',
    general:  '📢 お知らせ',
  };

  // ── タイムスタンプバー ──────────────────
  function renderTimestamp(isoString) {
    const bar = document.getElementById('timestamp-bar');
    if (!bar) return;

    const d = isoString ? new Date(isoString) : new Date();
    const fmt = d.toLocaleString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    });
    bar.innerHTML =
      `<span>📅 この情報は <strong>${fmt}</strong>（JST）時点での情報です</span>`;
  }

  // ── 更新バッジ ──────────────────────────
  function renderUpdateBadge(count) {
    const badge = document.getElementById('update-badge');
    if (!badge) return;

    if (count > 0) {
      badge.querySelector('.badge-text').textContent =
        `更新情報 ${count}件`;
      badge.style.display = 'inline-flex';
      badge.setAttribute('aria-label', `${count}件の更新情報があります`);
    } else {
      badge.querySelector('.badge-text').textContent = '更新情報';
    }
  }

  // ── 更新パネル ──────────────────────────
  function renderUpdatePanel(updates) {
    const panel = document.getElementById('update-panel');
    if (!panel) return;

    if (!updates || updates.length === 0) {
      panel.innerHTML = '<p style="font-size:0.85rem;color:var(--text-muted);">現在、新しい更新情報はありません。</p>';
      return;
    }

    const items = updates.map(u => `
      <div class="update-item">
        <div class="update-date">
          ${_formatDate(u.date)}
          ${u.category ? `<span class="chip chip-teal" style="margin-left:8px;">${CATEGORY_LABELS[u.category] || u.category}</span>` : ''}
          ${u.isNew ? '<span class="chip" style="margin-left:4px;">NEW</span>' : ''}
        </div>
        <strong style="font-size:0.88rem;">${_esc(u.title)}</strong>
        <p style="margin-top:6px;font-size:0.82rem;color:var(--text-sub);">${_esc(u.body)}</p>
      </div>
    `).join('');

    panel.innerHTML = `
      <h3>🔔 更新情報</h3>
      ${items}
    `;
  }

  // ── ローディング表示 ────────────────────
  function setLoading(isLoading) {
    const badge = document.getElementById('update-badge');
    if (!badge) return;
    if (isLoading) {
      badge.querySelector('.badge-text').textContent = '確認中…';
    }
  }

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

  // ── ヘルパー ────────────────────────────
  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function _formatDate(str) {
    if (!str) return '';
    try {
      const d = new Date(str);
      return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' });
    } catch {
      return str;
    }
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
    renderTimestamp,
    renderUpdateBadge,
    renderUpdatePanel,
    setLoading,
    setupMobileNav,
    setupScrollTop,
    setupTabs,
    setActiveNavLink,
  };
})();
