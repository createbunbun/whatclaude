/**
 * Claude ガイド - Model (MVC)
 * データ管理・状態管理レイヤー
 */

const ClaudeModel = (function () {
  'use strict';

  // ── Observer リスト ───────────────────
  const listeners = {};

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }

  // ── Public API ──────────────────────────
  return {
    on,
    emit,
  };
})();
