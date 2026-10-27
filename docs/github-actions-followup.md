# GitHub Actions 部署与数据同步：后续任务

> 状态：代码、脚本与 workflow 已实施（2026-10-27）；Pages Source 切换与首次
> `workflow_dispatch` 待人工执行。
> 目标：由 GitHub Actions 定期拉取 MobileModels、重新生成站点数据并部署 GitHub Pages
> 适用仓库：`crane-27/phone-choice`，默认分支 `main`
>
> 实际实现与本文的差异：
> - 删除 `generatedAt`，生成物完全确定；
> - 缓存版本改为所有本地静态资源的内容哈希；
> - 增加 `push` main 快速路径，避免切到 Actions 后普通页面修改不自动部署；
> - 部署成功后再提交生成物，避免“提交成功但部署失败”导致下次早退；
> - 不发布 `.nojekyll`（Actions Pages 不跑 Jekyll，且 artifact 默认排除 dotfiles）；
> - `data/LICENSE-MobileModels.md` 不再固定上游 commit，改以 `models.js` 的
>   `meta.upstreamCommit` 为准。

## 1. 当前状态

- 仓库目前没有 `.github/workflows/`。
- GitHub Pages 仍按 `README.md` 的说明使用 **Deploy from a branch**。
- 数据链路已经存在：
  - `node data/build-models.mjs` → `data/models.js`
  - `node data/build-status.mjs` → `data/model-status.js`
  - `node data/test-recommend.mjs` → 推荐内核断言
- `data/MobileModels/` 是本地上游 clone，已在 `.gitignore` 中排除。
- `data/models.js`、`data/model-status.js` 是生成物，目前需要提交到仓库。
- `docs/models-sync-plan.md` 是最初方案草案，其中 `assets/models/*.js`、全量 44 个文件、约 1.1 万条等描述已与当前实现不一致，实施前应先更新或标记为历史方案。

## 2. 必须先修的代码问题

### 2.1 生成物必须是确定性的

`build-models.mjs` 和 `build-status.mjs` 每次都会写入新的 `generatedAt`。如果 workflow 用 `git diff` 判断是否有变化，会永远得到“有变化”，导致每次定时任务都提交和部署。

处理方案（任选其一）：

1. 删除 `generatedAt` 字段；
2. 改为使用上游 commit 时间等稳定值；
3. 生成后比较时忽略 `meta.generatedAt`，但不要把该字段写回文件。

必须同时覆盖：

- `data/models.js` 的 `meta.generatedAt`
- `data/model-status.js` 的 `meta.generatedAt`

### 2.2 上游 clone 不能进入发布 artifact

`build-models.mjs` 目前硬编码读取 `data/MobileModels/brands/`。如果 CI 把上游 clone 到仓库内，`upload-pages-artifact` 会把约 6 MB 的上游源码和 `.git` 一起发布。

建议：

1. 给 `build-models.mjs` 增加环境变量，例如 `MOBILEMODELS_DIR`，默认值仍为 `data/MobileModels`；
2. workflow 将上游 clone 到 `$RUNNER_TEMP/MobileModels`；
3. 生成数据后，把站点文件整理到独立的 `_site/`，只上传：
   - 7 个 HTML 页面
   - `assets/`
   - `data/models.js`、`data/model-status.js`、`data/LICENSE-MobileModels.md`
   - `NOTICE`、`LICENSE.txt`
   - 必要的静态文件（如 `CNAME`、`.nojekyll`）

不要把 `.git/`、`docs/`、`data/MobileModels/`、`words.txt` 等带进 artifact。

### 2.3 数据完整性断言

现有 `test-recommend.mjs` 只验证推荐内核，不验证上游解析是否正常。workflow 需要增加一项数据检查，至少包括：

- `data/models.js` 的机型总数不得比上一版异常下降（建议阈值 10%）；
- 每个目标源系列都非空；
- `data/model-status.js` 的展示系列数与机型数在合理范围内；
- `data/rules.js` 中引用的源系列都能在 `models.js` 中找到；
- 任一断言失败 → job 失败，不提交、不部署，线上保留旧版本。

### 2.4 缓存版本号

页面通过查询参数加载数据：

```html
<script src="data/models.js?v=20261027"></script>
<script src="data/model-status.js?v=20261027c"></script>
<script src="assets/recommend.js?v=20261027e"></script>
```

workflow 更新数据文件后，这些版本号不会自动变化，用户可能继续使用旧缓存。需要：

- 在生成/提交阶段自动更新 HTML 中的版本号；或
- 改为内容哈希/构建号；或
- 取消查询参数并采用可靠的缓存策略。

推荐自动更新版本号，且把版本号写入提交，保证 HTML 与数据文件同步。

## 3. workflow 需要满足的约束

新增 `.github/workflows/sync-models.yml`，建议包含：

| 项 | 要求 |
| --- | --- |
| 触发 | `schedule` + `workflow_dispatch` |
| 分支 | 定时任务只在默认分支 `main` 运行 |
| 时区 | cron 使用 UTC；北京时间 = UTC+8 |
| 权限 | `contents: write`、`pages: write`、`id-token: write` |
| 并发 | 独立 concurrency 组；不要设置 `cancel-in-progress: true` |
| Node | 使用 `actions/setup-node`，建议 Node 22（`import.meta.dirname` 需要较新版本） |
| 上游 | clone `KHwang9883/MobileModels`，失败时 job 失败并保留旧数据 |
| 生成 | 运行 `build-models`、`build-status`、数据断言、`test-recommend` |
| 早退 | 生成物与仓库一致时不提交、不部署 |
| 提交 | 有变化时用 `GITHUB_TOKEN` 提交生成物和版本号 |
| 部署 | `actions/configure-pages` → `upload-pages-artifact` → `deploy-pages` |
| 环境 | `environment: github-pages` |
| 失败保护 | 生成失败、断言失败、上传失败都不覆盖线上 |

参考步骤顺序：

```text
checkout
→ setup-node
→ clone MobileModels 到临时目录
→ node data/build-models.mjs
→ node data/build-status.mjs
→ 数据断言
→ node data/test-recommend.mjs
→ git diff 检查
→ 有变化：提交并 push
→ 整理 _site
→ configure-pages
→ upload-pages-artifact
→ deploy-pages
```

## 4. Pages 设置（人工一次）

仓库 → **Settings → Pages → Build and deployment**：

1. Source 从 **Deploy from a branch** 改为 **GitHub Actions**。
2. 确认 **Settings → Environments → `github-pages`** 没有 Required reviewers。
3. 如果绑定了自定义域名，确认 `CNAME` 进入 artifact，并在切换后复查域名绑定。
4. 切换后第一次部署完成前，站点可能短时返回 404 或旧内容，建议低访问时段操作。

## 5. 分支保护与定时任务

- 如果 `main` 开启 PR 强制、签名要求等保护，`GITHUB_TOKEN` 可能无法 push。需要允许 Actions 推送，或改为“只部署、不提交”的变体。
- 公开仓库的 scheduled workflow 在 60 天无活动后可能被自动禁用。`workflow_dispatch` 可用于手动补跑和保活；建议每月至少手动触发一次。
- 首次上线后建议在仓库通知中保留 Actions 失败邮件。

## 6. 文档还需要同步

- `README.md`：把“Deploy from a branch”改为 GitHub Actions 部署说明，补充手动触发方式。
- `data/README.md`：补充 `rules.js`、`build-status.mjs`、`model-status.js` 和完整生成顺序。
- `docs/models-sync-plan.md`：标记为历史方案或按当前 `data/` 链路重写。
- `docs/handoff-2026-10-27.md`：补充数据同步 workflow 的上线状态与运维入口。

## 7. 首次实施验证清单

1. 本地运行 `build-models`、`build-status`、`test-recommend`，确认输出和断言通过。
2. 手动触发 `workflow_dispatch`，确认 Actions 全绿。
3. 检查线上 URL 返回 200，并确认新的 `models.js` / `model-status.js` 已加载。
4. 再触发一次，确认无变化时早退：不产生新提交、不产生新部署。
5. 故意破坏一个源系列标题，确认 workflow 失败且线上仍是旧版本。
6. 检查 artifact 体积，确认没有包含 `data/MobileModels`、`.git`、`docs` 等无关文件。

## 8. 仍需确认的决策

| # | 问题 | 当前默认 |
| --- | --- | --- |
| 1 | 数据范围 | 当前只保留 `提取规则.md` 列出的 27 个源系列，不扩展到全部 44 个文件 |
| 2 | 生成物是否提交 | 继续提交 `models.js` / `model-status.js` |
| 3 | 是否分片 | 当前单文件；如后续扩到全量品牌，再按品牌分片 |
| 4 | 同步频率 | 建议每周一次，配合 `workflow_dispatch` |
| 5 | 参数数据来源 | 仍人工填写；MobileModels 只提供型号名录 |
| 6 | `main` 分支保护 | 需确认是否允许 Actions 推送生成物 |

## 9. 许可

`data/` 下的衍生数据与 `assets/data.js` 继续遵守 CC BY-NC-SA 4.0。
workflow 部署的 artifact 必须包含：

- `NOTICE`
- `LICENSE.txt`
- `assets/data.js`（含上游机型 / 系列名称与示例）
- `data/LICENSE-MobileModels.md`
- 上游仓库与 commit 信息（已写入生成物 `meta`）

站点不得加入广告、affiliate、付费等商业用途，否则与上游许可冲突。
