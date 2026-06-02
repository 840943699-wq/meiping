/**
 * 美评 — 明星照片代理
 * 服务端调用 Wikipedia API（绕过浏览器 CORS / 网络限制）
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const name = req.query?.name || '';
  if (!name) return res.status(400).json({ error: '缺少明星名字' });

  // 从 URL 获取名字
  const celebName = decodeURIComponent(name);

  // 获取指定标题页面的缩略图
  const getPageThumb = async (lang, title) => {
    try {
      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=300&origin=*`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      for (const pid of Object.keys(data.query?.pages || {})) {
        if (pid === '-1') continue;
        const src = data.query.pages[pid].thumbnail?.source;
        if (src) return src;
      }
      return null;
    } catch (e) { return null; }
  };

  // 搜索维基页面
  const searchPage = async (lang, query) => {
    try {
      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data[1] && data[1].length > 0) return data[1][0];
      return null;
    } catch (e) { return null; }
  };

  try {
    // 先直接查
    let src = await getPageThumb('zh', celebName);
    if (src) return res.status(200).json({ url: src });

    src = await getPageThumb('en', celebName);
    if (src) return res.status(200).json({ url: src });

    // 搜索兜底
    for (const lang of ['zh', 'en']) {
      const found = await searchPage(lang, celebName);
      if (found) {
        src = await getPageThumb(lang, found);
        if (src) return res.status(200).json({ url: src });
      }
    }

    return res.status(200).json({ url: null });
  } catch (e) {
    return res.status(200).json({ url: null });
  }
}
