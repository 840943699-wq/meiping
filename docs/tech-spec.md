# 美评 — 技术规范 v1.0

---

## 一、技术栈

| 层面 | 选型 | 说明 |
|------|------|------|
| **前端框架** | 无框架，纯 HTML/CSS/JS | 零依赖，单个 HTML 文件包含全部逻辑 |
| **AI 引擎** | 智谱 GLM-4.6V-Flash | 永久免费，视觉多模态，OpenAI 兼容 API |
| **PWA** | manifest.json + Service Worker | 全屏模式 + 离线缓存 |
| **部署** | Vercel | 免费，全球 CDN，自动 HTTPS |
| **存储** | localStorage（浏览器本地） | 历史记录、用户偏好 |

---

## 二、系统架构

```
┌──────────────────────────────────────────┐
│              用户 iPhone                  │
│  ┌────────────────────────────────────┐  │
│  │   Safari → PWA 全屏模式             │  │
│  │                                    │  │
│  │  ┌──────┐  ┌──────┐  ┌─────────┐  │  │
│  │  │ 首页  │→│拍照页│→│ 结果页   │  │  │
│  │  │      │  │      │  │(5 Tab)  │  │  │
│  │  └──────┘  └──┬───┘  └────┬────┘  │  │
│  │               │           │        │  │
│  │         图片→Base64   JSON←AI API  │  │
│  └───────────────┼───────────┼────────┘  │
│                  │           │           │
└──────────────────┼───────────┼───────────┘
                   │           │
                   ▼           ▲
              ┌───────────────────┐
              │  智谱 API 服务器    │
              │  (open.bigmodel.cn)│
              └───────────────────┘
```

### 关键设计决策

1. **前端直连 AI API**：无需后端中转，减少维护成本
2. **图片 Base64 传输**：直接嵌入请求体，无需先上传到图床
3. **单文件架构**：HTML/CSS/JS 合并在一个文件中，部署简单

---

## 三、API 调用规范

### 3.1 智谱 API 基本信息

| 项目 | 值 |
|------|-----|
| **接口地址** | `https://open.bigmodel.cn/api/paas/v4/chat/completions` |
| **认证方式** | Bearer Token（API Key） |
| **请求格式** | OpenAI 兼容格式 |
| **模型名称** | `glm-4.6v-flash` |

### 3.2 请求结构

```javascript
const response = await fetch(
  "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "glm-4.6v-flash",
      messages: [
        {
          role: "system",
          content: "你是一位资深的颜值分析与形象顾问专家..."
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,..." }
            },
            {
              type: "text",
              text: "请分析这张照片中的人脸..."
            }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  }
);
```

### 3.3 响应结构

```json
{
  "choices": [
    {
      "message": {
        "content": "{...JSON字符串...}"
      }
    }
  ]
}
```

### 3.4 图片处理规范

| 参数 | 规范 |
|------|------|
| 格式 | JPEG（推荐）/ PNG |
| 最大尺寸 | 长边不超过 2048px |
| 压缩质量 | 0.7 ~ 0.8 |
| 编码方式 | Base64 Data URL |
| 前缀 | `data:image/jpeg;base64,` |

### 3.5 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| 网络超时 | 30 秒超时，提示用户重试 |
| API 返回错误 | 解析错误码，给出中文提示 |
| 图片过大 | 前端压缩后再上传 |
| 非人脸照片 | AI 返回提示，引导用户上传人脸照片 |
| JSON 解析失败 | 回退显示原始文本 |

---

## 四、前端架构

### 4.1 页面状态机

```
┌──────┐  点击开始  ┌──────┐  选好照片  ┌──────┐  分析完成  ┌──────┐
│ HOME │ ────────→ │ CAM  │ ────────→ │ LOAD │ ────────→ │RESULT│
│ 首页  │          │拍照页 │           │加载页 │           │结果页 │
└──────┘           └──────┘           └──────┘           └──┬───┘
    ↑                ↑   ↑                                 │
    │                │   │              分析失败             │
    └────────────────┴───┴─────────────────────────────────┘
                      重新开始
```

### 4.2 页面 ID 命名

| 页面 | CSS ID |
|------|--------|
| 首页 | `#page-home` |
| 拍照页 | `#page-camera` |
| 加载页 | `#page-loading` |
| 结果页 | `#page-result` |

### 4.3 结果页 Tab

| Tab | CSS ID |
|-----|--------|
| 综合打分 | `#tab-score` |
| 优势分析 | `#tab-strengths` |
| 劣势改进 | `#tab-weaknesses` |
| 变美计划 | `#tab-plan` |
| 穿搭建议 | `#tab-style` |

---

## 五、CSS 变量体系

```css
:root {
  /* 主色调 */
  --color-primary: #002FA7;        /* 克莱因蓝 */
  --color-primary-light: #0052CC;  /* 浅蓝（渐变用） */
  --color-primary-bg: #E8F0FE;     /* 极浅蓝背景 */

  /* 中性色 */
  --color-bg: #F5F7FA;             /* 页面背景 */
  --color-card: #FFFFFF;           /* 卡片背景 */
  --color-text: #1A1A2E;           /* 主文字 */
  --color-text-secondary: #666666; /* 次级文字 */
  --color-border: #E8E8E8;         /* 边框 */

  /* 功能色 */
  --color-success: #34C759;
  --color-warning: #FF9500;
  --color-error: #FF3B30;

  /* 尺寸 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* 阴影 */
  --shadow-card: 0 2px 12px rgba(0, 0, 0, 0.08);
  --shadow-button: 0 4px 16px rgba(0, 47, 167, 0.3);

  /* 字号 */
  --font-xs: 12px;
  --font-sm: 14px;
  --font-md: 16px;
  --font-lg: 20px;
  --font-xl: 28px;
  --font-xxl: 48px;
  --font-score: 72px;              /* 评分大数字 */
}
```

---

## 六、目录结构

```
meiping/
├── index.html          ← 主应用文件（HTML + CSS + JS 全部）
├── manifest.json       ← PWA 清单文件
├── sw.js              ← Service Worker 脚本
└── icon.png           ← App 图标（180×180px）
```

---

## 七、安全注意事项

1. **API Key 保护**：API Key 存储在代码中，仅限个人使用。如需多人使用，应搭建后端代理
2. **HTTPS**：Vercel 自动提供 HTTPS，确保传输加密
3. **隐私**：图片不经过任何第三方服务器（直连智谱 API）
4. **CSP**：可在 HTML 中添加 Content-Security-Policy meta 标签
