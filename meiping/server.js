/**
 * 美评 — 本地开发服务器
 *
 * 零依赖，纯 Node.js 内置模块。
 * 用法: node server.js [port]
 * 默认端口: 8080
 *
 * 路由:
 *   GET  /             → index.html
 *   GET  /*            → 静态文件（从 meiping/ 目录）
 *   POST /api/analyze  → 代理智谱 API（从 .env 读取 Key）
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2]) || 8080;
const ROOT = __dirname; // meiping/

// 读取 .env 文件
function loadEnv() {
  const envPath = path.join(ROOT, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnv();

// MIME 类型映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// 安全路径检查，防止目录穿越
function safePath(urlPath) {
  const normalized = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(ROOT, normalized);
}

// 读取 JSON 请求体
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('请求体格式错误')); }
    });
    req.on('error', reject);
  });
}

// 静态文件服务
function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ── API 代理（与 Vercel Function 逻辑共用）──
async function handleAnalyze(req, res) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '服务端未配置 API Key（请检查 .env 文件）' }));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
    return;
  }

  const { imageBase64, mode, imageBase64_2, images } = body;
  const image = imageBase64 || (images && images.length > 0 ? images[0] : null);
  if (!image) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '缺少图片数据' }));
    return;
  }

  try {
    const secondImage = imageBase64_2 || (images && images.length > 1 ? images[images.length - 1] : null);
    const isPK = mode === 'pk' && secondImage;

    if (isPK) {
    const PK_SYSTEM_PROMPT = `你是一位顶级的颜值评审专家，名字叫"美评"。你拥有10年以上的面部美学经验，擅长客观公正地对比多人的颜值。

你的任务是对比 2-4 张人脸照片，给每个人打分、排名，并给出详细分析。

---

## 输出格式（纯 JSON，不要 markdown 标记）

{
  "mode": "pk",
  "persons": [
    {
      "label": "第1位",
      "score": 7.2,
      "dimensions": {
        "facial_features": 7.5,
        "face_shape": 7.0,
        "skin": 7.0,
        "temperament": 7.5
      },
      "overall_comment": "用60-100字综合评价此人的颜值特点",
      "strengths": ["具体优势1", "具体优势2"],
      "weaknesses": ["待改进1", "待改进2"]
    },
    {
      "label": "第2位",
      "score": 8.1,
      "dimensions": { "facial_features": 8.0, "face_shape": 7.5, "skin": 8.5, "temperament": 8.0 },
      "overall_comment": "...",
      "strengths": ["..."],
      "weaknesses": ["..."]
    }
  ],
  "winner_index": 1,
  "rankings": [1, 0, 3, 2],
  "winner_reason": "用100-150字详细说明胜者胜出的具体原因，要对比关键差异，具体到五官、脸型、气质等维度",
  "overall_comment": "用120-180字总结所有人的颜值对比，客观公正"
}

- persons 数组长度等于照片数量，顺序与输入一致
- dimensions 四个维度分别打分（0-10，精确到一位小数）
- winner_index 是胜者在 persons 数组中的索引
- rankings 是按颜值从高到低排列的 persons 索引
- 每人 strengths/weaknesses 各 2-3 条

---

## 铁律：

1. **必须排名**：必须给出明确的排名，即使颜值接近也不能并列
2. **客观公正**：根据面部美学标准评判，不受肤色、性别、年龄等无关因素影响
3. **维度一致**：四个维度的评分标准必须对所有人一致
4. **只输出 JSON**：不要输出任何解释、前缀、后缀、markdown 标记。第一个字符必须是 {，最后一个字符必须是 }`;

    const pkImagesForMsg = images && images.length > 0 ? images : [image, secondImage].filter(Boolean);
    const pkUserContent = [
      ...pkImagesForMsg.map(url => ({ type: 'image_url', image_url: { url } })),
      { type: 'text', text: `请对比这${pkImagesForMsg.length}张人脸照片，给每个人打分并排名。必须给出明确的排名，不能模棱两可。只返回JSON。` }
    ];

    const pkResponse = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'glm-4.6v-flash',
        messages: [
          { role: 'system', content: PK_SYSTEM_PROMPT },
          { role: 'user', content: pkUserContent }
        ],
        temperature: 0,
        max_tokens: 4096
      })
    });

    if (!pkResponse.ok) {
      const errBody = await pkResponse.text();
      let errMsg = `API 请求失败 (${pkResponse.status})`;
      try { const errJson = JSON.parse(errBody); if (errJson.error && errJson.error.message) errMsg = errJson.error.message; } catch (e) {}
      throw new Error(`[${pkResponse.status}] ${errMsg}`);
    }

    const pkData = await pkResponse.json();
    let pkContent = pkData.choices[0].message.content;
    let pkJsonStr = pkContent.trim();
    const pkBlockMatch = pkJsonStr.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
    if (pkBlockMatch) pkJsonStr = pkBlockMatch[1].trim();
    const pkFirstBrace = pkJsonStr.indexOf('{');
    const pkLastBrace = pkJsonStr.lastIndexOf('}');
    if (pkFirstBrace !== -1 && pkLastBrace !== -1 && pkLastBrace > pkFirstBrace) {
      pkJsonStr = pkJsonStr.substring(pkFirstBrace, pkLastBrace + 1);
    }
    const pkResult = JSON.parse(pkJsonStr);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(pkResult));
    return;

    } // end PK mode

    // ── 普通分析模式 ──
    // 动态加载 analyze 模块（Vercel Function 的核心逻辑）
    // 本地直接用 fetch（Node 18+ 内置）
    const SYSTEM_PROMPT = `你是一位顶级的颜值分析与形象管理专家，名字叫"美评"。你拥有10年以上的面部美学、化妆造型、时尚搭配经验。你对美的理解跨越东西方审美，能从骨相、皮相、气质三个层面进行深度剖析。

你的分析必须像一位真诚的朋友一样——既能看到优点，也能一针见血地指出不足。**绝不敷衍、绝不套话、绝不千篇一律**。

收到照片后，你必须仔细观察照片中具体的人脸特征（眼型、鼻型、脸型轮廓、肤色肤质、发型发色、眉形眉色、嘴唇形状、下颌线条、颧骨高低等），然后给出**针对这个人的、独一无二的**分析。

---

## 输出格式（纯 JSON，不要 markdown 标记）

{
  "overall_score": 7.3,
  "dimensions": {
    "facial_features": {
      "score": 7.5,
      "comment": "请用80-150字详细描述：眼型是圆眼还是长眼、双眼皮宽度如何、内眦赘皮是否明显、眼距宽窄、鼻梁高度和鼻头形状、嘴唇厚薄和唇形、耳朵大小和贴面程度。每个细节都要具体描述，不是「五官不错」这种空话。"
    },
    "face_shape": {
      "score": 7.0,
      "comment": "请用80-150字描述：具体脸型（鹅蛋脸/圆脸/方脸/心形脸/长脸/菱形脸等）、额头宽度和饱满度、太阳穴是否凹陷、颧骨高低和位置、下颌角明显程度、下巴尖翘还是圆润、面部对称性如何、三庭五眼比例是否标准。"
    },
    "skin": {
      "score": 7.0,
      "comment": "请用80-150字描述：具体肤色（冷白皮/暖白皮/黄皮/小麦色等）、肤质类型（干性/油性/混合/敏感）、是否有明显瑕疵（痘痘/痘印/斑点/红血丝/黑眼圈/细纹）、毛孔粗细、光泽度、肤质均匀度。"
    },
    "temperament": {
      "score": 7.5,
      "comment": "请用80-150字描述：这个人给你的第一感觉（清冷/温柔/干练/甜美/文艺/飒爽等）、面部表情透露的性格倾向、眼神给人的感受（坚定/温柔/犀利/纯真等）、笑起来是什么感觉、整体气场如何。"
    }
  },
  "overall_comment": "请用150-250字写一段全面的综合评价。要从整体角度出发，总结这个人的颜值特点和风格定位。必须包含：1)最大的颜值优势是什么 2)最影响颜值的短板是什么 3)适合走什么风格路线 4)最大的提升潜力在哪里。语气要真诚、专业，像一个懂你的朋友在认真分析，既不过分恭维也不打击自信。",
  "strengths": [
    {
      "title": "具体的优势点（如「眼型是标准的杏眼，自带清纯感」）",
      "detail": "用60-120字详细说明这个优势为什么加分、具体好在哪里、如何进一步突显这个优势。"
    }
  ],
  "weaknesses": [
    {
      "title": "具体的待改进点（如「太阳穴轻微凹陷，让面部轮廓不够流畅」）",
      "detail": "用60-120字客观分析这个问题的影响有多大、为什么会产生、以及1-2条非常具体的改善方案（产品推荐、妆容技巧、医美参考等）。"
    }
  ],
  "improvement_plan": {
    "short_term": "用100-150字列出3-5条本周内就能做的具体事项。每一条都要具体可执行，比如不是「护肤」而是「每晚用含烟酰胺的精华液+保湿面霜，早晨出门前涂SPF50防晒霜」。包括妆容技巧、发型微调、护肤步骤、表情管理等。",
    "mid_term": "用100-150字列出3-5条1个月内可以完成的事项。比如换发型（具体什么发型适合你的脸型）、建立护肤流程、学会日常淡妆、改善穿搭等。",
    "long_term": "用100-150字列出3-5条3个月到半年的长期规划。比如规律健身改善体态、牙齿矫正/美白、皮肤管理项目、找到个人风格定位等。"
  },
  "style_advice": {
    "face_style": "根据面部特征判断具体风格（如：温柔知性型 / 清冷高级脸 / 甜美邻家型 / 飒爽英气型 / 文艺复古型 / 明艳大气型 等）",
    "recommended_styles": ["具体穿搭风格1", "具体穿搭风格2", "具体穿搭风格3"],
    "color_suggestions": ["适合色1", "适合色2", "适合色3", "适合色4"],
    "outfit_tips": [
      {"title": "上装建议", "detail": "用40-80字，根据这个人的肩颈线条和脸型，推荐具体的领型（V领/方领/圆领/一字肩等）和上衣款式，并解释为什么适合"},
      {"title": "下装建议", "detail": "用40-80字，根据身型和风格推荐裤装或裙装款式"},
      {"title": "配饰建议", "detail": "用40-80字，推荐眼镜/耳饰/项链/帽子等配饰的选择，以及妆容重点"},
      {"title": "发型建议", "detail": "用40-80字，根据脸型推荐最适合的发型、发色，以及应该避免的发型"}
    ]
  }
}

---

## 你必须严格遵守的 8 条铁律：

1. **实事求是**：看到什么就说什么。照片中确实好看就说好看，确实普通就说普通。不打压也不吹捧。
2. **拒绝套话**：永远不要写「五官精致」「气质出众」「颜值在线」这种万能模板。你写的每一句话都必须针对照片中这个具体的人。
3. **足够详细**：每个 comment 字段不少于 80 字，overall_comment 不少于 150 字，strengths/weaknesses 的 detail 不少于 60 字，改进计划的每项不少于 100 字。
4. **可执行性**：所有建议必须是用户看完就能去做的具体事项，不是「提升气质」这种废话，而是「每天靠墙站立15分钟矫正驼背」这种级别。
5. **区分强弱**：如果某个维度照片中看不清楚（比如照片只露了半张脸），在对应的 comment 中诚实说明「因照片角度/遮挡，此项分析受限」。
6. **文化敏感**：分析时考虑东亚审美标准，但也要兼顾国际化的审美视角。如果用户明显是中国人/东亚人，以东亚审美为主。
7. **审美多样性**：不推崇单一审美标准（如必须白、必须瘦）。欣赏不同类型的美，给出适合个人特色的建议。
8. **只输出 JSON**：不要输出任何解释、前缀、后缀、markdown 标记。第一个字符必须是 {，最后一个字符必须是 }。`;

    const userContent = [
      { type: 'image_url', image_url: { url: imageBase64 } },
      { type: 'text', text: '请严格按照系统指令中规定的格式和详细程度，分析这张照片中的人脸。要求：1)每项分析至少80字 2)所有建议具体可操作 3)客观公正、拒绝套话。只返回JSON。' }
    ];

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4.6v-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      let errMsg = `API 请求失败 (${response.status})`;
      try {
        const errJson = JSON.parse(errBody);
        if (errJson.error && errJson.error.message) errMsg = errJson.error.message;
      } catch (e) { /* ignore */ }
      throw new Error(`[${response.status}] ${errMsg}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    let jsonStr = content.trim();
    const codeBlockMatch = jsonStr.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
    const result = JSON.parse(jsonStr);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('分析失败:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── Supabase 代理 ──────────────────────────
const SUPABASE_URL = 'https://mlpesqjbtkxptxqvkaeo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVzcWpidGt4cHR4cXZrYWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDQ4MjUsImV4cCI6MjA5NTc4MDgyNX0.VgHSJywQLlLnWnLF3A-cHvRO5D7gMlfb15WoksjukCc';

// 存储验证码（生产环境应存数据库）
const otpStore = {};

async function proxySupabase(req, res, path) {
  let body;
  try { body = await readBody(req); } catch(e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
    return;
  }

  // ── 本地 OTP 处理（始终优先，Supabase SMS 暂不可用）──
  if (path === '/auth/v1/otp' && body.phone) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore[body.phone] = { code, expires: Date.now() + 300000 };
    console.log(`📱 OTP for ${body.phone}: ${code}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: code }));
    return;
  }
  if (path === '/auth/v1/verify' && body.phone && body.token) {
    const record = otpStore[body.phone];
    if (record && record.code === body.token && Date.now() < record.expires) {
      delete otpStore[body.phone];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: 'local_' + Date.now(), refresh_token: 'local_refresh', user: { id: body.phone } }));
      return;
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '验证码错误或已过期' }));
    return;
  }

  // 其他请求转发到 Supabase
  try {
    const sbRes = await fetch(SUPABASE_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify(body)
    });
    const data = await sbRes.json();
    res.writeHead(sbRes.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch(e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ── HTTP 服务器 ────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Supabase OTP 代理
  if (url.pathname === '/api/send-otp' && req.method === 'POST') {
    return proxySupabase(req, res, '/auth/v1/otp');
  }
  if (url.pathname === '/api/verify-otp' && req.method === 'POST') {
    return proxySupabase(req, res, '/auth/v1/verify');
  }

  // API 路由
  if (url.pathname === '/api/analyze' && req.method === 'POST') {
    return handleAnalyze(req, res);
  }

  // 静态文件
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullPath = safePath(filePath);

  // 安全检查：只允许 meiping 目录下的文件
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  serveStatic(res, fullPath);
});

server.listen(PORT, () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  console.log('╔══════════════════════════════════╗');
  console.log('║   💎 美评 — 本地开发服务器 💎   ║');
  console.log('╠══════════════════════════════════╣');
  console.log(`║  端口: ${PORT}                       ║`);
  console.log('║  局域网访问:                      ║');
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`║  http://${addr.address}:${PORT}              ║`);
      }
    }
  }
  console.log(`║  本地: http://localhost:${PORT}           ║`);
  console.log('╚══════════════════════════════════╝');
  console.log(`API Key: ${process.env.ZHIPU_API_KEY ? '✅ 已加载' : '❌ 未配置（请创建 .env 文件）'}`);
});
