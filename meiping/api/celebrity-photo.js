/**
 * 美评 — 明星照片代理（百度图片版）
 * 从百度图片搜索获取明星头像
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const name = req.query?.name || '';
  if (!name) return res.status(400).json({ error: '缺少明星名字' });

  try {
    // 百度图片搜索 JSON 接口
    const searchUrl = `https://image.baidu.com/search/acjson?tn=resultjson_com&word=${encodeURIComponent(name + ' 写真')}&pn=0&rn=3&width=300&height=300`;
    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://image.baidu.com/',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) return res.status(200).json({ url: null });

    const text = await resp.text();
    // 百度返回的 JSON 可能有前缀回调，先清洗
    const jsonStr = text.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    const data = JSON.parse(jsonStr);

    // 提取第一张有效图片
    const items = data?.data || [];
    for (const item of items) {
      const url = item?.thumbURL || item?.middleURL;
      if (url && !url.includes('loading') && url.startsWith('http')) {
        return res.status(200).json({ url });
      }
    }
    return res.status(200).json({ url: null });
  } catch (e) {
    return res.status(200).json({ url: null });
  }
}
