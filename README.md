# 从零开始的手机选购指南（网页版）

把个人写的手机选购指南做成可交互的静态网站，部署在 GitHub Pages 上。站点本身是纯 HTML + CSS + JavaScript，无后端、无第三方运行时依赖；机型数据由本地 Node 脚本从上游 Markdown 离线生成。

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页：四步流程与工具入口 |
| `needs.html` | 需求诊断：预算 / 性能 / 影像 / 特殊需求 → 机型级推荐 |
| `lines.html` | 机型地图：按定位、性能、影像、品牌、系列筛选 |
| `compare.html` | 机型对比台：SoC / 影像 / 电池 / 屏幕 / 多存储价格，自动算屏幕密度 |
| `soc.html` | SoC 梯队：经验不等式、五档速查、命名解码、判断流程 |
| `final.html` | 存储计算器、线下体验清单、开箱验收清单 |
| `glossary.html` | 名词表、数据来源、v2 更新记录 |

`assets/` 下是共享样式与脚本：

- `style.css`：全站样式，跟随系统深色模式，含打印样式
- `data.js`：人工维护的需求分组、价位档位与产品线概览
- `app.js`：导航注入、localStorage 封装、通用工具
- `recommend.js`：机型推荐内核，读取 `data/model-status.js`

## 本地预览

直接双击 `index.html` 即可使用（脚本都是本地文件，不涉及 `fetch`）。也可以起一个静态服务器：

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```

## 数据与生成流程

机型数据来自 [KHwang9883/MobileModels](https://github.com/KHwang9883/MobileModels)，只保留 `data/提取规则.md` 指定的系列，不合并海外版本。

```text
data/MobileModels/                 上游 clone（不提交）
        │ node data/build-models.mjs
        ▼
data/models.js                     机型名录
        │ node data/build-status.mjs  ← data/rules.js
        ▼
data/model-status.js               带定位 / 性能 / 影像的机型数据
        │ window.Recommend.build()
        ▼
assets/recommend.js                推荐结果
```

当前结果约为：

- 27 个源系列、1088 个源机型名
- 31 个展示系列、177 款带定位状态的机型

重新生成：

```bash
# 首次或需要更新上游时
git clone https://github.com/KHwang9883/MobileModels data/MobileModels

# 生成机型名录与定位状态
MOBILEMODELS_DIR=data/MobileModels node data/build-models.mjs
node data/build-status.mjs

# 数据完整性断言 + 推荐内核断言
node scripts/check-data.mjs
node data/test-recommend.mjs
```

`MOBILEMODELS_DIR` 默认为 `data/MobileModels`，可指向任意上游 clone。生成物不含墙钟时间，重复运行应得到相同内容，便于 CI 用 `git diff` 判断是否需要提交。建议使用 Node 22；生成脚本不会联网，也不会修改上游 clone。`data/MobileModels/` 已写入 `.gitignore`，不随仓库分发。

## 部署

站点通过 `.github/workflows/sync-models.yml` 部署到 GitHub Pages：

- 每周一 02:00（北京时间）自动拉取上游、生成数据、校验并部署；
- `main` 分支的页面、样式或数据变更会触发快速路径部署；
- 可在 Actions → **Sync phone data and deploy Pages** → **Run workflow** 手动触发；首次切换 Pages Source 后请勾选 `force_deploy`。

仓库设置（一次）：

1. **Settings → Pages → Build and deployment**：Source 选择 **GitHub Actions**；
2. **Settings → Environments → `github-pages`**：确认没有 Required reviewers；
3. **Settings → Actions → General → Workflow permissions**：允许 **Read and write permissions**；
4. 若 `main` 有分支保护，允许 `github-actions[bot]` 推送生成物，或改用只部署变体。

首次部署完成前站点可能短时 404。生成、校验或部署失败时 workflow 会在部署前终止，线上保留上一版。详细运维说明见 [`docs/github-actions-followup.md`](docs/github-actions-followup.md)。

## 文档

- [`docs/handoff-2026-10-27.md`](docs/handoff-2026-10-27.md)：当前实现与数据链路交接
- [`docs/github-actions-followup.md`](docs/github-actions-followup.md)：GitHub Actions 部署与数据同步运维
- [`docs/models-sync-plan.md`](docs/models-sync-plan.md)：早期数据同步方案草案（部分内容已过时）
- [`data/README.md`](data/README.md)：数据目录与生成脚本说明

## 许可

- 源代码（含 GitHub Actions workflow）：MIT，见 [`LICENSE.txt`](LICENSE.txt)
- `data/` 下基于 MobileModels 的衍生数据：CC BY-NC-SA 4.0，见 [`data/LICENSE-MobileModels.md`](data/LICENSE-MobileModels.md)
- 每次发布的站点 artifact 都包含 `NOTICE`、`LICENSE.txt` 与上述数据许可文件
- 自动同步只更新衍生数据与缓存版本号，不改变许可；上游 commit 以 `data/models.js` 的 `meta.upstreamCommit` 为准
- 项目为非商业个人项目；分发衍生数据时需保留署名、注明修改、相同方式共享；广告、返利、付费等商业用途需先获得上游许可

## 说明

- 需求诊断、对比台、验机清单的结果存在浏览器 `localStorage`，不会上传。
- 示例机型与参数仅用于说明，价格、在售情况和具体配置请以官方渠道为准。
