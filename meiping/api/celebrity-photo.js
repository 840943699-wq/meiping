/**
 * 美评 — 明星照片代理（Wikidata 版）
 * 服务端调用 Wikidata API 获取明星头像
 * 流程：搜索明星 → 获取 Q-ID → 获取 P18 图片 → 返回 Commons URL
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const name = req.query?.name || '';
  if (!name) return res.status(400).json({ error: '缺少明星名字' });

  try {
    // 第1步：搜索 Wikidata 获取实体 ID
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=zh&format=json&origin=*`;
    const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    if (!searchResp.ok) return sendNull(res);

    const searchData = await searchResp.json();
    const results = searchData?.search || [];
    if (results.length === 0) return sendNull(res);

    // 取第一个搜索结果
    const qid = results[0].id; // 如 Q242641

    // 第2步：获取实体 P18（图片）声明
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&property=P18&entity=${qid}&format=json&origin=*`;
    const claimsResp = await fetch(claimsUrl, { signal: AbortSignal.timeout(5000) });
    if (!claimsResp.ok) return sendNull(res);

    const claimsData = await claimsResp.json();
    const p18Claims = claimsData?.claims?.P18 || [];
    if (p18Claims.length === 0) return sendNull(res);

    // 获取图片文件名
    const filename = p18Claims[0]?.mainsnak?.datavalue?.value;
    if (!filename) return sendNull(res);

    // 构造 Commons 图片 URL（300px 宽度缩略图）
    const encodedFilename = encodeURIComponent(filename.replace(/ /g, '_'));
    const imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFilename}?width=300`;

    return res.status(200).json({ url: imageUrl });
  } catch (e) {
    return sendNull(res);
  }

  function sendNull(res) {
    return res.status(200).json({ url: null });
  }
}
