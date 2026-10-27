#!/usr/bin/env node
/**
 * build-models.mjs — 从 data/MobileModels 上游 Markdown 提取机型名录
 *
 * 用法：node data/build-models.mjs
 * MOBILEMODELS_DIR 可覆盖上游目录，默认 data/MobileModels
 * 产物：data/models.js（window.MOBILE_MODELS，非 JSON，保持 file:// 可用）
 *
 * 范围：仅 data/提取规则.md 明确列出的文件与系列，不合并海外版本。
 * 输出粒度：品牌 / 系列 / 机型名。不输出型号码、主板代号、别名等。
 *
 * 数据来源：KHwang9883/MobileModels，CC BY-NC-SA 4.0
 * https://github.com/KHwang9883/MobileModels
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "..");
const UPSTREAM_DIR = path.resolve(ROOT, process.env.MOBILEMODELS_DIR || "data/MobileModels");
const BRANDS_DIR = path.join(UPSTREAM_DIR, "brands");
const OUT_FILE = path.join(ROOT, "data", "models.js");

/**
 * 目标系列表，逐条对应 data/提取规则.md 的 `### <文件>:<系列>` 标题。
 * 只提取这里列出的系列。
 */
const TARGETS = [
  // ## 苹果
  { file: "apple_cn.md", heading: "iPhone", brand: "苹果" },

  // ## 华为
  { file: "huawei_cn.md", heading: "HUAWEI Mate 系列", brand: "华为" },
  { file: "huawei_cn.md", heading: "HUAWEI P / Pura 系列", brand: "华为" },
  { file: "huawei_cn.md", heading: "HUAWEI nova 系列", brand: "华为" },
  { file: "huawei_cn.md", heading: "华为畅享系列", brand: "华为" },

  // ## 小米/红米
  { file: "xiaomi_cn.md", heading: "小米数字系列", brand: "小米" },
  { file: "xiaomi_cn.md", heading: "红米 / REDMI 数字系列", brand: "红米" },
  { file: "xiaomi_cn.md", heading: "红米 / REDMI Note 系列", brand: "红米" },
  { file: "xiaomi_cn.md", heading: "REDMI Turbo 系列", brand: "红米" },
  { file: "xiaomi_cn.md", heading: "REDMI K 系列", brand: "红米" },

  // ## OPPO/一加
  { file: "oppo_cn.md", heading: "Find X 系列", brand: "OPPO" },
  { file: "oppo_cn.md", heading: "Reno 系列", brand: "OPPO" },
  { file: "oppo_cn.md", heading: "K 系列", brand: "OPPO" },
  { file: "oppo_cn.md", heading: "A 系列", brand: "OPPO" },
  { file: "oneplus.md", heading: "一加手机", brand: "一加" },

  // ## vivo/iQOO
  { file: "vivo_cn.md", heading: "vivo X 系列", brand: "vivo" },
  { file: "vivo_cn.md", heading: "vivo S 系列", brand: "vivo" },
  { file: "vivo_cn.md", heading: "vivo Y 系列", brand: "vivo" },
  { file: "vivo_cn.md", heading: "iQOO 旗舰系列", brand: "iQOO" },
  { file: "vivo_cn.md", heading: "iQOO Neo 系列", brand: "iQOO" },
  { file: "vivo_cn.md", heading: "iQOO Z 系列", brand: "iQOO" },

  // ## 荣耀
  { file: "honor_cn.md", heading: "荣耀 Magic 系列", brand: "荣耀" },
  { file: "honor_cn.md", heading: "荣耀数字系列 (HONOR 系列 / N 系列)", brand: "荣耀" },
  { file: "honor_cn.md", heading: "荣耀 WIN 系列", brand: "荣耀" },
  { file: "honor_cn.md", heading: "荣耀 Power 系列", brand: "荣耀" },
  { file: "honor_cn.md", heading: "荣耀 X 系列", brand: "荣耀" },
  { file: "honor_cn.md", heading: "荣耀 Play 系列", brand: "荣耀" },
];

const KNOWN_PHONE_HEADINGS = /(系列|手机|iPhone)/;
const NON_PHONE_HEADINGS =
  /(平板|MatePad|笔记本|MagicBook|电脑|智慧屏|穿戴|手表|手环|耳机|音箱|显示器|电视|路由|汽车|游戏本|学习机|配件|Watch|Band|早期|品牌成立前|^其他系列$)/;

/* ------------------------------ 解析 ------------------------------ */

/** 从 `**[`主板`] 机型名 (`别名`):**` 中取出机型名。 */
function parseModelName(text) {
  let s = text.trim();
  if (s.endsWith(":")) s = s.slice(0, -1);

  // 去掉前缀 [`主板代号`]
  s = s.replace(/^\[`[^`]+`\]\s*/, "");

  // 去掉任意位置的 (`主板/平台代号`)
  s = s.replace(/\s*\(`[^`]+`\)\s*/g, " ");

  // 去掉尾部连续 (...) 别名
  s = s.replace(/(?:\s*\([^()]*\))+\s*$/, "");

  return s.replace(/\s{2,}/g, " ").trim();
}

function parseTargetFile(file, targets) {
  const filePath = path.join(BRANDS_DIR, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到源文件：${filePath}`);
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const byHeading = new Map(
    targets.map((t) => [t.heading, { ...t, names: [], headingLine: null }]),
  );

  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const heading = /^#{2,6}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = byHeading.get(heading[1]) ?? null;
      if (current) {
        if (current.headingLine !== null) {
          throw new Error(`${file} 中系列标题重复：${heading[1]}`);
        }
        current.headingLine = i + 1;
      }
      continue;
    }

    if (!current) continue;

    // 条目：**...:** 或 **...**
    const bold = /^\*\*(.+?)\*\*\s*$/.exec(line.trim());
    if (!bold) continue;

    const name = parseModelName(bold[1]);
    if (name) current.names.push(name);
  }

  const missing = targets.filter((t) => byHeading.get(t.heading).headingLine === null);
  if (missing.length > 0) {
    throw new Error(
      `${file} 中找不到以下系列标题：${missing.map((t) => t.heading).join("、")}`,
    );
  }

  return [...byHeading.values()];
}

/** 报告这些文件中未被提取的手机系列，便于后续补规则。 */
function findSkippedSeries(file, targets) {
  const filePath = path.join(BRANDS_DIR, file);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const taken = new Set(targets.filter((t) => t.file === file).map((t) => t.heading));
  const skipped = [];

  for (let i = 0; i < lines.length; i++) {
    const heading = /^##\s+(.+?)\s*$/.exec(lines[i]);
    if (!heading) continue;
    const text = heading[1];
    if (taken.has(text)) continue;
    if (!KNOWN_PHONE_HEADINGS.test(text)) continue;
    if (NON_PHONE_HEADINGS.test(text)) continue;
    skipped.push({ heading: text, line: i + 1 });
  }

  return skipped;
}

/* ------------------------------ 输出 ------------------------------ */

function getGitInfo(args) {
  try {
    return execFileSync("git", ["-C", UPSTREAM_DIR, ...args], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(BRANDS_DIR)) {
    throw new Error(
      `找不到上游目录：${UPSTREAM_DIR}\n请先 git clone https://github.com/KHwang9883/MobileModels <目录>，或设置 MOBILEMODELS_DIR`,
    );
  }

  const files = [...new Set(TARGETS.map((t) => t.file))];
  const series = [];

  for (const file of files) {
    const parsed = parseTargetFile(file, TARGETS.filter((t) => t.file === file));
    for (const s of parsed) {
      // 同一系列内按机型名去重（上游同一机型可能按主板/地区拆成多条）
      series.push({
        brand: s.brand,
        series: s.heading,
        models: [...new Set(s.names)],
      });
    }
  }

  const stats = {
    series: series.length,
    models: series.reduce((n, s) => n + s.models.length, 0),
  };

  const meta = {
    source: "KHwang9883/MobileModels",
    sourceUrl: "https://github.com/KHwang9883/MobileModels",
    license: "CC BY-NC-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    upstreamCommit: getGitInfo(["rev-parse", "HEAD"]),
    upstreamBranch: getGitInfo(["branch", "--show-current"]),
    generator: "data/build-models.mjs",
    stats,
  };

  const header = `/*!
 * 机型名录（衍生数据）—— 请勿手工编辑，重新生成请运行 node data/build-models.mjs
 *
 * 来源：${meta.source} @ ${meta.upstreamCommit ?? "unknown"}
 * 许可：CC BY-NC-SA 4.0 <${meta.licenseUrl}>
 * 本文件不是 MIT 代码。使用、分发或修改本文件时须遵守上述许可：
 * 署名、非商业用途、相同方式共享。
 */
`;

  const body =
    `window.MOBILE_MODELS = {\n` +
    `  meta: ${JSON.stringify(meta, null, 2)},\n` +
    `  series: [\n` +
    series
      .map(
        (s) =>
          `    { brand: ${JSON.stringify(s.brand)}, series: ${JSON.stringify(s.series)}, models: ${JSON.stringify(s.models)} }`,
      )
      .join(",\n") +
    `\n  ],\n};\n`;

  fs.writeFileSync(OUT_FILE, header + body, "utf8");

  const size = fs.statSync(OUT_FILE).size;
  console.log(`已生成 ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`  系列 ${stats.series} / 机型 ${stats.models}`);
  console.log(`  文件大小 ${(size / 1024).toFixed(1)} KB`);
  console.log(`  上游 commit ${meta.upstreamCommit ?? "unknown"}`);

  console.log("\n各系列机型数：");
  for (const s of series) {
    console.log(
      `  ${String(s.models.length).padStart(4)}  ${s.brand} / ${s.series}`,
    );
  }

  const skipped = files.flatMap((f) =>
    findSkippedSeries(f, TARGETS).map((x) => ({ file: f, ...x })),
  );
  if (skipped.length > 0) {
    console.log("\n未提取的疑似手机系列（提取规则未覆盖）：");
    for (const s of skipped) {
      console.log(`  ${s.file}:${s.line}  ${s.heading}`);
    }
  }
}

main();
