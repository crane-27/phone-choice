# data/

本目录存放“机型 / 系列”相关的原始数据、派生数据与转换脚本。

## 目录说明

| 路径 | 说明 | 是否提交 |
| --- | --- | --- |
| `MobileModels/` | 上游 KHwang9883/MobileModels 的本地 clone | 否（见 `.gitignore`） |
| `models.js` | 由 `build-models.mjs` 生成的机型名录（`window.MOBILE_MODELS`） | 是 |
| `build-models.mjs` | 转换脚本，只读上游 Markdown | 是 |
| `提取规则.md` | 业务规则草案（系列 → 性能 / 影像 / 价位） | 是 |
| `LICENSE-MobileModels.md` | 衍生数据的许可与署名 | 是 |

## 重新生成

```bash
# 1. 准备上游数据（首次或需要更新时）
git clone https://github.com/KHwang9883/MobileModels data/MobileModels

# 2. 生成
node data/build-models.mjs
```

脚本只读取 `data/MobileModels/brands/` 下、`提取规则.md` 指定的文件与系列，
不会联网，也不会修改上游 clone。

## 输出结构

```js
window.MOBILE_MODELS = {
  meta: {
    source, sourceUrl, license, licenseUrl,
    upstreamCommit, upstreamBranch, generatedAt, generator, stats
  },
  series: [
    { brand: "苹果", series: "iPhone", models: ["iPhone 3G", "iPhone 3GS", "..."] }
  ]
};
```

## 注意

- `models.js` 是**衍生数据，不是 MIT**，遵守 CC BY-NC-SA 4.0。
- 不要手工编辑 `models.js`，改动会在下次生成时丢失。
- 上游不含价格、上市时间、硬件规格；这些信息只能由业务规则侧提供。
