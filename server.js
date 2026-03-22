const express = require('express');
const path = require('path');
const translate = require('google-translate-api-x');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// リダイレクト（旧URL互換）
app.get('/api.html',        (req, res) => res.redirect(301, '/services/api.html'));
app.get('/claude-code.html', (req, res) => res.redirect(301, '/services/code.html'));
app.get('/connection.html',  (req, res) => res.redirect(301, '/services/integrations.html'));

// 静的ファイル配信
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
}));

// ── 翻訳キャッシュ（メモリ内） ──
const cache = new Map();
const CACHE_MAX = 5000;

function getCacheKey(text, target) {
  return target + ':' + text;
}

// 翻訳 API エンドポイント
app.post('/api/translate', async (req, res) => {
  const { texts, target } = req.body;

  if (!texts || !Array.isArray(texts) || !target) {
    return res.status(400).json({ error: 'texts (array) and target (string) are required' });
  }

  try {
    const translated = new Array(texts.length);
    const uncachedIndices = [];
    const uncachedTexts = [];

    // キャッシュ確認
    for (let i = 0; i < texts.length; i++) {
      const key = getCacheKey(texts[i], target);
      if (cache.has(key)) {
        translated[i] = cache.get(key);
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    // 未キャッシュ分を翻訳
    if (uncachedTexts.length > 0) {
      const results = await translate(uncachedTexts, { from: 'ja', to: target });
      const arr = Array.isArray(results) ? results : [results];

      for (let j = 0; j < arr.length; j++) {
        const idx = uncachedIndices[j];
        const text = arr[j].text;
        translated[idx] = text;

        // キャッシュ保存
        if (cache.size < CACHE_MAX) {
          cache.set(getCacheKey(uncachedTexts[j], target), text);
        }
      }
    }

    res.json({ translated });
  } catch (err) {
    console.error('Translation error:', err.message);
    res.status(500).json({ error: 'Translation failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
