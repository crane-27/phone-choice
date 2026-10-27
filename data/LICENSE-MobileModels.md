# 数据许可与署名（data/ 与 assets/data.js 的衍生数据）

本目录中的 `models.js`、`model-status.js`，以及 `assets/data.js`
中的机型 / 系列名称与示例，**不是 MIT 代码**，而是基于
**KHwang9883/MobileModels** 的衍生数据。

## 上游来源

- 仓库：<https://github.com/KHwang9883/MobileModels>
- 本次生成所用提交：以 `data/models.js` 的 `meta.upstreamCommit` 为准
  （GitHub Actions 自动同步会更新该值，本文件不再固定某个 commit）
- 上游许可：Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
  （CC BY-NC-SA 4.0）
- 许可全文：<https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode>

## 衍生数据的许可

`data/models.js`、`data/model-status.js` 与 `assets/data.js` 均以
**CC BY-NC-SA 4.0** 发布。`assets/data.js` 位于 `assets/`，为便于站点
加载而保留为 JavaScript，其中包含人工整理的需求分组、产品线与上游机型 /
系列名称。

## 自动同步与发布

- `data/models.js`、`data/model-status.js` 由 GitHub Actions 定期从上游重新生成；
- `assets/data.js` 为人工维护，不随上游自动更新，但同样按 CC BY-NC-SA 4.0 发布；
- 每次发布的站点 artifact 都包含本文件、根目录 `NOTICE`、`LICENSE.txt` 与 `assets/data.js`；
- 上游 commit 以生成物 `meta.upstreamCommit` 为准，本文件不再固定某个 commit；
- 若同步或校验失败，工作流不会部署，线上保留上一版数据。

## 署名（Attribution）

机型数据来自 KHwang9883/MobileModels（<https://github.com/KHwang9883/MobileModels>），
经本仓库脚本 `data/build-models.mjs` 提取、筛选并重组。
原始数据的版权归上游作者及贡献者所有。

## 修改说明（Indicate changes）

- 仅提取 `data/提取规则.md` 列出的 7 个中文/国行品牌文件中的 27 个系列；
- 不合并海外版本；
- 去除型号码、主板代号、别名，仅保留品牌 / 系列 / 机型名；
- 同一系列内按机型名去重；
- 输出格式由 Markdown 转换为 `window.MOBILE_MODELS` JavaScript 对象；
- `assets/data.js` 从上游名录中选取产品线 / 示例机型名称，并按需求与价位分组。

## 非商业（NonCommercial）

本项目为个人、非商业用途。若将本目录内容、`assets/data.js` 或其修改版本
用于商业目的（包括广告、导购返利、付费服务等），必须先获得上游权利人的
单独许可。

## 相同方式共享（ShareAlike）

分发本目录内容、`assets/data.js` 或其修改版本时，必须继续采用
CC BY-NC-SA 4.0（或兼容许可），并保留本文件中的署名与许可说明。
