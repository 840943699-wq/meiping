/**
 * 美评 — 明星照片代理（批量版）
 * 一次请求获取多位明星头像，避免并发限制
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const namesParam = req.query?.names || '';
  if (!namesParam) return res.status(400).json({ error: '缺少明星名字' });

  const names = decodeURIComponent(namesParam).split(',').map(n => n.trim()).filter(Boolean);

  // 获取指定标题页面的缩略图
  const getPageThumb = async (lang, title) => {
    try {
      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=300&origin=*`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      for (const pid of Object.keys(data.query?.pages || {})) {
        if (pid === '-1') continue;
        return data.query.pages[pid].thumbnail?.source || null;
      }
      return null;
    } catch (e) { return null; }
  };

  // 搜索维基页面
  const searchPage = async (lang, query) => {
    try {
      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data[1] && data[1].length > 0) ? data[1][0] : null;
    } catch (e) { return null; }
  };

  // 查单个明星照片
  const findPhoto = async (name) => {
    let src = await getPageThumb('zh', name);
    if (src) return src;
    src = await getPageThumb('en', name);
    if (src) return src;
    for (const lang of ['zh', 'en']) {
      const found = await searchPage(lang, name);
      if (found) {
        src = await getPageThumb(lang, found);
        if (src) return src;
      }
    }
    return null;
  };

  // 逐个查询（控制对 Wikipedia 的并发压力）
  const results = {};
  for (const name of names) {
    results[name] = await findPhoto(name);
  }

  return res.status(200).json({ photos: results });
}
