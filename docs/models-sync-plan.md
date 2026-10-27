# 手机型号数据自动同步方案（草案）

> 状态：待评审，未实施
> 适用仓库：`crane-27/phone-choice`（默认分支 `main`）
> 数据源：`KHwang9883/MobileModels`（CC BY-NC-SA 4.0）
> 目标：在**完全不在本地操作**的前提下，由 GitHub 云端定期同步上游型号数据并自动发布

---

## 1. 结论

可行，纯云端。一共三件事：

1. 把 Pages 发布方式从「Deploy from a branch」改成「GitHub Actions」
2. 增加一个定时 workflow：拉上游仓库 → 转换成站点数据文件 → 提交 → 部署
3. 补一个可独立运行的转换脚本（本地和 CI 都能跑）

前置条件：只需要**一次**本地操作把 workflow 和脚本推上去，之后不再依赖本机网络。

---

## 2. 现状盘点

| 项目 | 现状 |
| --- | --- |
| 站点形态 | 纯静态 7 个页面 + `assets/{style.css,data.js,app.js}`，无构建步骤、无后端 |
| 运行约束 | `README.md:25` 明确声明「脚本都是本地文件，不涉及 `fetch`」，双击 `index.html` 即可用 |
| 现有数据 | `assets/data.js` 只有 `NEEDS` / `TIERS` / `LINES`，粒度是**产品线**（如「红米 K 系列」），无具体型号 |
| 对比台字段 | `compare.html:184-195`：型号 / SoC / SoC 档位 / 影像 / 电池 / 分辨率 / 机身尺寸 / 屏幕密度 / 价格存储 / 备注，**全部手填**，存 `localStorage` |
| 本地 clone | `MobileModels/`，6.1 MB（其中 `.git` 5.1 MB），`master` 分支，commit `19e65a61`（2026-10-26 13:43） |
| clone 状态 | 工作区干净；当前**未被 git 跟踪**（`?? MobileModels/`） |

---

## 3. 数据源评估（实测）

| 指标 | 实测值 |
| --- | --- |
| 站点托管 | GitHub Pages（GitHub.com + Fastly），无 Cloudflare |
| `robots.txt` | 404（无限制规则） |
| 品牌文件 | 44 个 `brands/*.md` |
| 总行数 | 38,533 行，其中 11,825 行是型号条目 |
| 去重后型号 | 11,243 条（按整行去重） |
| Markdown 总体积 | 765,935 字节（约 748 KB） |
| 许可证 | CC BY-NC-SA 4.0（`LICENSE.txt` 与 `README.md` 均声明） |
| 更新频率 | 接近每日（最近提交 2026-10-26） |
| 条目最多的文件 | `huawei_cn.md` 1088、`samsung_global_en.md` 956、`xiaomi.md` 925、`xiaomi_en.md` 916、`honor_cn.md` 668 |

### 文件结构

不是表格，是「二级标题分组 + 加粗机型 + 反引号型号码」的形式：

```markdown
## HUAWEI Mate 系列

**华为 Ascend Mate:**

`HUAWEI MT1-T00`: 华为 Ascend Mate 移动版
`HUAWEI MT1-U06`: 华为 Ascend Mate 联通版
```

`##` 是系列，`**...**` 是具体机型名，`` `CODE`: 名称 `` 是型号码到市场名的映射。

### 地区/品类分文件

文件名后缀区分版本：`_cn` 16 个、`_en` 14 个，其余为无后缀（`xiaomi`、`oneplus`、`meizu` 等）与特殊品类（`xiaomi-wear`、`zhixuan`）。`misc/` 下是命名规则、早期机型等非型号内容，**不应当作型号数据摄入**。

---

## 4. 这份数据能做什么、不能做什么

这是本方案最重要的一节，请先确认预期。

### 能做

- **型号字典**：型号码 ↔ 市场名互查（`HUAWEI MT1-T00` → 华为 Ascend Mate 移动版）
- **系列归属**：某型号属于哪个品牌的哪个系列
- **地区版本区分**：国行 / 海外版
- **对比台输入辅助**：用户输入型号码时自动补全市场名，或校验型号是否存在
- **产品线地图下钻**：`lines.html` 里点「红米 K 系列」可以展开该系列的历史型号清单
- **拼写纠错**：用户手动输入的机型名做模糊匹配

### 不能做

**上游不含硬件规格。** 实测统计：`mAh` 0 次、`摄像头` 0 次、`分辨率` 0 次、`价格` 0 次、`电池` 1 次。

也就是说：

- `compare.html` 的 SoC、影像、电池、屏幕、价格字段**依然需要人工填写或另找数据源**
- 之前考察的 GSMchoice 已被证实由 Cloudflare 全面拦截（所有路径含 `robots.txt` 均返回 `403` + JS 挑战），不可作为自动化来源
- 本方案解决的是「型号名录」问题，**不解决「参数填充」问题**

如果重构的预期是「对比台能自动填参数」，那么本方案只能满足其中「型号名」那一格。

---

## 5. 目标架构

```
GitHub Actions（cron 触发，建议每周）
  │
  ├─ 1. checkout phone-choice（默认分支）
  ├─ 2. clone https://github.com/KHwang9883/MobileModels（runner 内匿名拉取）
  ├─ 3. 运行转换脚本 → 生成 assets/models/*.js
  ├─ 4. 比对产物：无差异则直接退出（不提交、不部署）
  ├─ 5. 有差异 → commit 回 main（留痕、可回滚）
  └─ 6. upload-pages-artifact → deploy-pages（同一次运行内完成发布）
```

### 产物形态：`window.MOBILE_MODELS`，不是 JSON

沿用现有 `assets/data.js` 的 `window.GUIDE = (function(){...})()` 模式，生成 `.js` 而非 `.json`：

- 保持 `README.md` 承诺的「不涉及 `fetch`」
- `file://` 双击打开依然可用（JSON + `fetch` 在 `file://` 下会被浏览器拦截）
- 与现有代码风格一致，无需引入异步加载流程

### 体积与分片

按 11,243 条、每条约 80–110 字节估算，单文件产物约 **1.0–1.2 MB**，gzip 后约 200–300 KB。

体积风险是真实的：**首页不应该加载全量型号库**。建议分片：

```
assets/models/index.js        // 品牌列表 + 各分片条目数，约 15–25 KB
assets/models/huawei.js       // 按品牌拆分
assets/models/xiaomi.js
...
```

分片用动态 `<script>` 注入按需加载即可，**不需要 `fetch`**，`file://` 下同样工作。这样首页体积不变，只有真正用到型号字典的页面才付代价。

---

## 6. 数据模型建议

```text
MODEL {
  code:    string    // 型号码，如 "HUAWEI MT1-T00"（唯一键）
  name:    string    // 市场名，如 "华为 Ascend Mate 移动版"
  brand:   string    // 归一化品牌："华为" / "小米" / "红米" ...
  series:  string    // 系列名，来自 ## 标题
  region:  "cn" | "global"
  kind:    "phone" | "tablet" | "wearable" | "other"
  file:    string    // 来源文件名，便于溯源与排查
}
```

关联现有 `data.js` 的关键：

- `LINES[]` 是**产品线**（`brand` + `name`，如 红米 / K 系列）
- 新数据是**具体型号**（`brand` + `series`）
- 两者靠 `brand` + `series` 做模糊匹配，但**上游的系列命名与 `LINES.name` 并不完全一致**（上游是「HUAWEI Mate 系列」，本地是「Mate 系列」），需要一张人工维护的别名映射表
- 建议在 `data.js` 的 `LINES` 条目上增加可选字段 `seriesAlias: [...]`，而不是在做转换时猜

---

## 7. 部署方式改造（手动操作，一次）

路径：仓库 → **Settings → Pages → Build and deployment**

1. **Source** 从 `Deploy from a branch` 改为 `GitHub Actions`
2. 此时不会立刻删除现有站点，但**新的 push 不再触发分支构建**，必须等第一次 workflow 成功运行后站点才会更新
3. 首次运行建议用 `workflow_dispatch` 手动触发，确认产物与页面无误
4. 确认 **Settings → Environments → `github-pages`** 没有被设置「Required reviewers」，否则部署会卡在等待审批
5. 如果绑定了自定义域名：确认 `CNAME` 文件包含在上传的 artifact 中，切换后回到 Pages 设置复查域名绑定是否丢失

### 为什么必须改

GitHub 官方文档明确：

> Commits pushed by a GitHub Actions workflow that uses the `GITHUB_TOKEN` do not trigger a GitHub Pages build.

如果继续用分支部署，workflow 推送的更新**不会**重建站点 —— 表现为仓库文件已更新、Actions 显示成功、网站内容不变。

改用 Actions 部署后，构建与发布在同一次运行内完成，不依赖 push 事件；同时自定义 workflow 不受「10 次构建/小时」软限制约束。

### 切换期间的已知影响

- 切换瞬间到首次成功部署之间，站点可能返回 404 或旧内容
- 旧的分支部署记录不再更新，`gh-pages` 分支（若有）会变成死数据
- 建议挑访问量低的时段操作

---

## 8. Workflow 设计要点

不给完整 YAML，只列必须满足的约束，实施时按此写。

| 项 | 要求 |
| --- | --- |
| 触发 | `schedule` + `workflow_dispatch`（后者用于手动补跑与 60 天保活） |
| 分支 | `schedule` 只在默认分支（`main`）上运行 |
| 时区 | cron 默认 **UTC**，需自行换算（北京时间 = UTC+8） |
| 最短间隔 | 5 分钟，实际周更足够 |
| 权限 | `pages: write` + `id-token: write`（部署必需）；若提交产物还需 `contents: write` |
| 并发 | `concurrency` 组防重叠，**不要** `cancel-in-progress: true`（会中断部署） |
| 早退 | 产物无变化时不提交、不部署，避免无意义的部署记录 |
| 失败保护 | 转换失败时**保留上一版产物**并让 job 失败，禁止输出空文件 |
| 通知 | 失败靠 GitHub 邮件通知；建议额外在 job 末尾做条数断言 |
| 递归 | `GITHUB_TOKEN` 推送不会触发新 workflow，无递归风险，无需 `[skip ci]` |

### 建议的断言（防止静默数据损坏）

- 解析出的型号总数不得比上一版减少 10% 以上（上游误删或解析器失效的典型症状）
- 每个品牌分片非空
- `code` 去重后数量与预期偏差在阈值内
- 任一断言失败 → job 失败，保留旧版本

---

## 9. 风险清单

### 高

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| **许可证合规** | CC BY-NC-SA 4.0：必须署名、禁止商业用途、衍生数据须同许可发布。站点一旦加广告/affiliate/付费即违约 | `glossary.html` 固化署名 + 许可证链接；在 `LICENSE.txt` 或数据目录加 `NOTICE`；明确项目非商业定位 |
| **`GITHUB_TOKEN` 推送不触发 Pages 构建** | 见第 7 节，最容易误判为缓存问题 | 改用 Actions 部署 |
| **60 天无活动自动禁用定时任务** | 公开仓库 60 天无活动，scheduled workflow 自动停用。本项目内容稳定时恰好最危险 | 加 `workflow_dispatch`；每月手动点一次；关注 GitHub 停用通知邮件 |

### 中

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| **上游结构变更导致解析失效** | 作者若调整标题层级或条目格式，脚本可能解析出 0 条 | 条数断言 + 失败不覆盖旧数据 + 失败通知 |
| **上游改名/删库/分支变更** | 现为 `master` 分支，若改为 `main` 或归档，CI 拉取失败 | 脚本对分支名做回退尝试；失败保留旧版；定期检查上游 `archived` 标志 |
| **产物体积拖慢首屏** | 全量约 1.0–1.2 MB，若被首页引入将显著拖慢 | 按品牌分片、按需注入；首页不引用 |
| **嵌套 git 仓库被误提交** | `MobileModels/` 内含 `.git`，`git add .` 会生成 gitlink（残缺 submodule），本地正常、Pages 上为空 | 写入 `.gitignore`，并清理根目录其它 untracked 文件 |
| **分支保护阻止 bot 提交** | `main` 若开启 PR 强制/签名要求，workflow 推送失败 | 二选一：放宽对 Actions 的限制，或改为「不提交、只部署」变体（代价：失去提交留痕、更易触发 60 天禁用） |

### 低

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| cron 延迟或跳过 | 高峰期 GitHub 会延迟甚至丢弃定时任务 | 周更任务可接受；失败次日重试 |
| 部署与人工提交冲突 | 本地推送与 bot 提交竞争 | `concurrency` 组 + 提交前 `pull --rebase` |
| 站点体积上限 | Pages 站点 ≤ 1 GB、软带宽 100 GB/月 | 当前产物数量级远低于阈值 |
| 数据本身有错 | 上游是人工汇总，可能有错漏 | 生成物只作**候选值**，`compare.html` 保留人工最终确认 |

### 已排除

- **GSMchoice 作为数据源**：全部路径（含 `robots.txt`）返回 `403` + Cloudflare JS 挑战（`Cf-Mitigated: challenge`），技术上不可抓，也不建议绕过
- **运行时 fetch `raw.githubusercontent.com`**：破坏 `file://` 可用性，并引入第三方运行时依赖
- **git submodule 方式**：静态站无构建环节，submodule 内容不会进入发布分支，收益为零

---

## 10. 首次实施验证清单

1. 本地运行转换脚本，确认输出条数约 11,000+，抽查 3 个品牌与上游文件逐条比对
2. `file://` 直接双击 `index.html`，确认无 `fetch` 报错、型号字典可读
3. 手动触发 workflow，确认 Actions 全绿、artifact 体积正常
4. 检查线上 URL 返回 200，且内容包含新生成的数据文件
5. 再次触发一次，确认「无变化时早退」生效（不产生新提交、不产生部署记录）
6. 故意改坏一条解析规则，确认断言拦截且**线上仍是旧数据**

## 11. 待决策项

| # | 问题 | 备选 |
| --- | --- | --- |
| 1 | 数据范围 | 全部 44 个文件 / 仅中国大陆在售（`_cn` + 无后缀） |
| 2 | 是否提交生成物到仓库 | 提交（留痕、易回滚）/ 仅部署（仓库干净） |
| 3 | 是否分片 | 按品牌分片（推荐）/ 单文件全量（首页会变慢） |
| 4 | 更新频率 | 每周 / 每日（公开仓库 Actions 免费） |
| 5 | `compare.html` 参数来源 | 保持人工填写 / 另找数据源（GSMchoice 已排除） |
| 6 | 关联方式 | 给 `LINES` 加 `seriesAlias` / 单独维护映射表 |

## 12. 与后续重构的衔接

建议顺序：**先定数据模型，再重构页面**。

- 如果重构会改动 `compare.html` 的字段结构，型号字典的 schema 应一并确定，避免二次返工
- `assets/models/` 目录与 `assets/data.js` 应保持职责分离：`data.js` 放人工编写的观点性内容（需求分组、档位建议），`models/` 放上游同步的事实性内容（型号名录）
- 两者不混用一个文件，否则每次自动同步都会在你的手写内容上产生无意义 diff，冲淡提交历史

---

## 附录：相关事实出处

- GitHub Pages 使用限制（1 GB 站点、100 GB/月软带宽、10 次构建/小时）：`docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits`
- `GITHUB_TOKEN` 推送不触发 Pages 构建：`docs.github.com/en/actions/concepts/security/github_token`
- 定时任务限制（5 分钟最短间隔、UTC、默认分支、公开仓库 60 天无活动停用）：`docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows`
- 自定义 Pages 部署所需权限：`docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages`
- 上游许可证：`https://creativecommons.org/licenses/by-nc-sa/4.0/`
