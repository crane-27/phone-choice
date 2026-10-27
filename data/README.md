# data/

本目录存放“机型 / 系列”相关的原始数据、派生数据与转换脚本。

## 目录说明

| 路径 | 说明 | 是否提交 |
| --- | --- | --- |
| `MobileModels/` | 上游 KHwang9883/MobileModels 的本地或 CI 临时 clone | 否（见 `.gitignore`） |
| `models.js` | 由 `build-models.mjs` 生成的机型名录（`window.MOBILE_MODELS`） | 是 |
| `model-status.js` | 由 `build-status.mjs` 生成的定位状态（`window.MODEL_STATUS`） | 是 |
| `build-models.mjs` | 从上游 Markdown 提取机型名，只读上游 | 是 |
| `build-status.mjs` | 按 `rules.js` 为每个机型生成定位 / 性能 / 影像 | 是 |
| `rules.js` | 机器可读的展示系列与匹配规则 | 是 |
| `test-recommend.mjs` | 推荐内核断言，只读 `model-status.js` 与 `assets/recommend.js` | 是 |
| `提取规则.md` | 业务规则草案（系列 → 性能 / 影像 / 价位） | 是 |
| `LICENSE-MobileModels.md` | 衍生数据的许可与署名 | 是 |

## 重新生成

```bash
# 1. 准备上游数据（首次或需要更新时）
git clone https://github.com/KHwang9883/MobileModels data/MobileModels

# 也可把上游放在任意位置，用 MOBILEMODELS_DIR 指向它
# MOBILEMODELS_DIR=/path/to/MobileModels

# 2. 生成机型名录与定位状态
MOBILEMODELS_DIR=data/MobileModels node data/build-models.mjs
node data/build-status.mjs

# 3. 数据完整性断言 + 推荐内核断言
node scripts/check-data.mjs
node data/test-recommend.mjs
```

`MOBILEMODELS_DIR` 默认为 `data/MobileModels`；相对路径按仓库根目录解析。
脚本只读取上游 `brands/` 下、`提取规则.md` 指定的文件与系列，不会联网，
也不会修改上游 clone。

生成物不写入墙钟时间；同一份上游数据重复运行应得到相同内容，便于 CI 用
`git diff` 判断是否需要提交和部署。

## 输出结构

```js
window.MOBILE_MODELS = {
  meta: {
    source, sourceUrl, license, licenseUrl,
    upstreamCommit, upstreamBranch, generator, stats
  },
  series: [
    { brand: "苹果", series: "iPhone", models: ["iPhone 3G", "iPhone 3GS", "..."] }
  ]
};
```

`model-status.js` 的 `meta` 额外包含 `sourceModels`、`sourceRules` 与生成统计；
每个机型结构为 `{ name, nick_name?, tier, performance, camera }`。

## 自动同步

`.github/workflows/sync-models.yml` 每周从上游重新生成数据，校验通过后部署
GitHub Pages，并把生成物与页面版本号提交回仓库。发布 artifact 仅包含站点
文件、`NOTICE`、`LICENSE.txt` 和本目录的许可文件；上游 clone、脚本与 `docs/`
不会进入 artifact。

## 注意

- `models.js`、`model-status.js` 是**衍生数据，不是 MIT**，遵守 CC BY-NC-SA 4.0。
- `assets/data.js` 虽位于 `assets/`，但含上游机型 / 系列名称与示例，同样按
  CC BY-NC-SA 4.0 发布，不属于 MIT 代码。
- 不要手工编辑生成物，改动会在下次生成时丢失；应改 `build-*.mjs` 或 `rules.js`。
- 上游不含价格、上市时间、硬件规格；这些信息只能由业务规则侧提供。
