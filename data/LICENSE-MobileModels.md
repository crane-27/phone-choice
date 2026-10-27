# 数据许可与署名（data/ 下的衍生数据）

本目录中的 `models.js` 及其它由上游数据生成的产物**不是 MIT 代码**，
而是基于 **KHwang9883/MobileModels** 的衍生数据。

## 上游来源

- 仓库：<https://github.com/KHwang9883/MobileModels>
- 本次生成所用提交：`19e65a61db7f145492cee9074a1159ea9097fb33`（`master`）
- 上游许可：Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
  （CC BY-NC-SA 4.0）
- 许可全文：<https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode>

## 本目录衍生数据的许可

由上游数据生成的 `data/models.js` 同样以 **CC BY-NC-SA 4.0** 发布。

## 署名（Attribution）

机型数据来自 KHwang9883/MobileModels（<https://github.com/KHwang9883/MobileModels>），
经本仓库脚本 `data/build-models.mjs` 提取、筛选并重组。
原始数据的版权归上游作者及贡献者所有。

## 修改说明（Indicate changes）

- 仅提取 `data/提取规则.md` 列出的 7 个中文/国行品牌文件中的 27 个系列；
- 不合并海外版本；
- 去除型号码、主板代号、别名，仅保留品牌 / 系列 / 机型名；
- 同一系列内按机型名去重；
- 输出格式由 Markdown 转换为 `window.MOBILE_MODELS` JavaScript 对象。

## 非商业（NonCommercial）

本项目为个人、非商业用途。若将本目录内容用于商业目的
（包括广告、导购返利、付费服务等），必须先获得上游权利人的单独许可。

## 相同方式共享（ShareAlike）

分发本目录内容或其修改版本时，必须继续采用 CC BY-NC-SA 4.0（或兼容许可），
并保留本文件中的署名与许可说明。
