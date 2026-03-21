/**
 * Claude ガイド - Model (MVC)
 * データ管理・状態管理レイヤー
 */

const ClaudeModel = (function () {
  'use strict';

  // ── 状態 ──────────────────────────────
  const state = {
    updates:       [],
    lastChecked:   null,
    dataTimestamp: null,
    isLoading:     false,
    hasNewUpdates: false,
  };

  // ── Observer リスト ───────────────────
  const listeners = {};

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }

  // ── ローカルストレージ ─────────────────
  const STORAGE_KEY = 'claude_guide_updates';

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveToStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {/* ストレージ容量超過等を無視 */}
  }

  // ── 更新データ取得 ──────────────────────
  // サーバー（server.js）が生成する updates.json を取得
  // 失敗時はフォールバックとして静的な初期データを使用
  async function fetchUpdates() {
    state.isLoading = true;
    emit('loading', true);

    // まず前回のキャッシュを即時表示
    const cached = loadFromStorage();
    if (cached) {
      _applyUpdateData(cached, false);
    }

    try {
      // ── サーバーから取得 ──
      const res = await fetch('./data/updates.json?t=' + Date.now(), {
        cache: 'no-store',
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      _applyUpdateData(data, true);
      saveToStorage(data);
      emit('updatesFetched', state.updates);

    } catch (err) {
      // サーバーが起動していない場合: 静的フォールバック
      console.info('updates.json 取得失敗 → フォールバック使用');
      const fallback = _getFallbackData();
      _applyUpdateData(fallback, false);
      emit('updatesFetched', state.updates);
    } finally {
      state.isLoading = false;
      emit('loading', false);
    }
  }

  function _applyUpdateData(data, markNew) {
    state.updates       = data.updates || [];
    state.dataTimestamp = data.generatedAt || data.timestamp || new Date().toISOString();
    state.lastChecked   = new Date().toISOString();
    if (markNew && data.hasNew) {
      state.hasNewUpdates = true;
      emit('newUpdates', state.updates.filter(u => u.isNew));
    }
  }

  // ── フォールバックデータ ─────────────────
  function _getFallbackData() {
    return {
      generatedAt: new Date().toISOString(),
      hasNew: false,
      updates: [
        {
          id: 'init-001',
          date: '2025-03',
          title: 'Claude 4ファミリー 提供開始',
          body: 'Claude Opus 4.6、Sonnet 4.6、Haiku 4.5 が提供中です。',
          category: 'model',
          isNew: false,
        },
        {
          id: 'init-002',
          date: '2025-03',
          title: 'Claude Code 一般提供',
          body: 'CLIベースのコーディングエージェント Claude Code が利用可能です。',
          category: 'product',
          isNew: false,
        },
      ],
    };
  }

  // ── 定期チェック ────────────────────────
  // 5分おきに updates.json を再取得
  function startPolling(intervalMinutes = 5) {
    fetchUpdates();
    setInterval(fetchUpdates, intervalMinutes * 60 * 1000);
  }

  // ── Public API ──────────────────────────
  return {
    on,
    emit,
    startPolling,
    fetchUpdates,
    getState:      () => ({ ...state }),
    getUpdates:    () => [...state.updates],
    getTimestamp:  () => state.dataTimestamp,
    hasNewUpdates: () => state.hasNewUpdates,
  };
})();
