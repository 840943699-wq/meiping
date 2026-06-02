# CLAUDE.md — 美评项目工作说明书

> 本文档为 Claude Code 在此项目中的工作指南。每次对话开始时应先阅读本文件和 devlog.md。

---

## 项目概要

| 项目 | 说明 |
|------|------|
| **名称** | 美评 |
| **定位** | AI 颜值打分 + 穿搭建议 PWA |
| **AI 引擎** | 智谱 GLM-4.6V-Flash（免费） |
| **平台** | PWA 网页 App，部署至 Vercel |
| **评分制** | 十分制（X.X/10） |
| **主色调** | 克莱因蓝 `#002FA7` |
| **风格** | 青春活力、简洁直观、卡片式布局 |
| **目标用户** | 爱美人士，手机端使用 |

---

## 标准文档索引

所有规范文档位于 `docs/` 目录下：

| 文件 | 路径 | 用途 |
|------|------|------|
| 需求文档 | [docs/requirements.md](docs/requirements.md) | 完整产品需求定义，功能模块说明 |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) | 技术选型、架构设计、API 规范 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | UI/UX 设计标准（颜色/字体/布局/动效） |
| 执行步骤 | [docs/execution-plan.md](docs/execution-plan.md) | 分阶段开发计划，每阶段任务清单 |

---

## 开发日志

开发日志位于项目根目录：[devlog.md](devlog.md)

### 维护规则
- **每次对话开始时**：读取 devlog.md，了解当前进度和待办事项
- **每次对话结束时**：更新 devlog.md，记录完成事项、新增待办、遇到的问题、下一步计划
- **格式**：按日期分组，使用 checkbox 标记任务状态

---

## 开发原则

### 1. 分阶段推进，不越界
- 严格按照 `docs/execution-plan.md` 中定义的 8 个阶段执行
- 当前阶段的所有任务完成并验证通过后，再进入下一阶段
- 每次对话聚焦一个阶段内的任务，不过度扩展

### 2. 文档同步
- 功能变更时同步更新 `docs/` 下的对应文档
- 需求变更 → 更新 requirements.md
- 技术方案变更 → 更新 tech-spec.md
- UI 调整 → 更新 design-spec.md

### 3. 代码质量
- 单个 HTML 文件承载全部功能（零依赖原则）
- 代码注释使用中文，便于非技术人员理解
- CSS 变量统一管理颜色和尺寸
- JS 函数单一职责，命名语义化

### 4. 移动端优先
- 所有 UI 以 iPhone 屏幕为基准设计（375×812pt）
- 触摸区域不小于 44×44pt（苹果 HIG 标准）
- 测试时优先在手机 Safari 中验证

---

## 工作流程

```
对话开始
  │
  ├─ 1. 读取 devlog.md（了解进度）
  ├─ 2. 读取相关 docs/ 文档（了解规范）
  ├─ 3. 确认当前阶段和任务
  ├─ 4. 执行开发任务
  ├─ 5. 验证完成
  └─ 6. 更新 devlog.md
```

---

## 常用路径速查

```
项目根目录    /Volumes/5/zhaopiandafen/
源代码目录    /Volumes/5/zhaopiandafen/meiping/
文档目录      /Volumes/5/zhaopiandafen/docs/
开发日志      /Volumes/5/zhaopiandafen/devlog.md
主应用文件    /Volumes/5/zhaopiandafen/meiping/index.html
PWA 配置      /Volumes/5/zhaopiandafen/meiping/manifest.json
离线缓存      /Volumes/5/zhaopiandafen/meiping/sw.js
应用图标      /Volumes/5/zhaopiandafen/meiping/icon.png
```
