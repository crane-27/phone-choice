# 从零开始的手机选购指南（网页版）

把个人写的手机选购指南做成可交互的静态网站，部署在 GitHub Pages 上。纯 HTML + CSS + JavaScript，无构建步骤、无后端、无第三方依赖。

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页：四步流程与工具入口 |
| `needs.html` | 需求诊断：性能 / 影像 / 系统 / 预算 → 需求画像 |
| `lines.html` | 产品线地图：按需求分组或按价位分档，支持筛选 |
| `compare.html` | 机型对比台：任意数量机型，自动算屏幕密度、高亮最优项 |
| `soc.html` | SoC 梯队：经验不等式、五档速查、命名解码、问 AI 模板 |
| `final.html` | 存储计算器、线下体验清单、开箱验收清单 |
| `glossary.html` | 名词表、数据来源、更新记录 |

`assets/` 下是共享样式、数据与脚本：

- `style.css`：全站样式，跟随系统深色模式，含打印样式
- `data.js`：需求分组、价位档位、产品线数据（改内容主要改这里）
- `app.js`：导航注入、localStorage 封装、通用工具

## 本地预览

直接双击 `index.html` 即可使用（脚本都是本地文件，不涉及 `fetch`）。也可以起一个静态服务器：

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```

## 部署到 GitHub Pages

```bash
git add .
git commit -m "feat: 手机选购指南网页版"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

然后在仓库的 **Settings → Pages** 里：

1. Source 选择 **Deploy from a branch**
2. Branch 选择 **main**，目录选择 **/ (root)**
3. 保存后等待一两分钟，访问 `https://<你的用户名>.github.io/<仓库名>/`

所有链接均为相对路径，放在仓库根目录或子路径下都能正常工作。

## 数据说明

- 产品线数据在 `assets/data.js` 的 `LINES` 数组里，每条包含 `brand`、`name`、`example`、`needs`、`tiers`、可选的 `limit`。
- 新增需求分组或价位档位时，同时修改 `NEEDS` / `TIERS`，页面会自动渲染。
- 需求诊断、对比台、验机清单的结果存在浏览器 `localStorage`，不会上传。
- 示例机型与参数仅用于说明，价格请以官方渠道为准。
