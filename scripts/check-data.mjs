#!/usr/bin/env node
/**
 * 数据一致性校验（只读）
 *
 * 校验 data/models.js、data/model-status.js 与 data/rules.js 之间的一致性，
 * 并与 git 中的基线版本比较，防止数据意外缩水或膨胀。
 *
 * 用法：
 *   node scripts/check-data.mjs
 *
 * 环境变量：
 *   BASE_REF              基线引用，默认 HEAD（例如 origin/main）
 *   MAX_DROP_PCT          相对基线的最大跌幅百分比，默认 10
 *   MAX_GROWTH_PCT        相对基线的最大涨幅百分比，默认 100（最多 2 倍）
 *   MIN_STATUS_MODELS     展示机型总数下限，默认 150
 *   ALLOW_MISSING_BASELINE 设为 1 时，缺少基线不视为失败
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");

const errors = [];
const warnings = [];
let passed = 0;
let failed = 0;

const BASE_REF = process.env.BASE_REF || "HEAD";
const MAX_DROP_PCT = numEnv("MAX_DROP_PCT", 10);
const MAX_GROWTH_PCT = numEnv("MAX_GROWTH_PCT", 100);
const MIN_STATUS_MODELS = numEnv("MIN_STATUS_MODELS", 150);
const ALLOW_MISSING_BASELINE = process.env.ALLOW_MISSING_BASELINE === "1";

const HEX40 = /^[0-9a-f]{40}$/;
const TIERS = ["entry", "mid", "upper", "flagship", "ultra"];
const LEVELS = ["low", "medium", "high"];
const EXPECTED_META = {
  source: "KHwang9883/MobileModels",
  license: "CC BY-NC-SA 4.0",
};

function numEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    warnings.push(`环境变量 ${name}=${JSON.stringify(raw)} 无效，使用默认值 ${fallback}`);
    return fallback;
  }
  return n;
}

function expect(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    errors.push(message);
  }
  return Boolean(condition);
}

function warn(message) {
  warnings.push(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function keyOf(brand, series) {
  return `${brand}\u0000${series}`;
}

/** 用 node:vm 在沙箱中执行数据脚本，避免 require 缓存。 */
function loadDataScript(code, filename, globalName) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename, timeout: 10_000 });
  return sandbox.window[globalName];
}

function loadLocal(file, globalName) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    errors.push(`缺少数据文件：${file}`);
    return { ok: false, value: null };
  }
  try {
    const code = fs.readFileSync(abs, "utf8");
    const value = loadDataScript(code, abs, globalName);
    if (value === undefined) {
      errors.push(`${file} 未设置 window.${globalName}`);
      return { ok: false, value: null };
    }
    return { ok: true, value };
  } catch (err) {
    errors.push(`解析 ${file} 失败：${err.message}`);
    return { ok: false, value: null };
  }
}

function loadBaseline(file, globalName) {
  let code;
  try {
    code = execFileSync("git", ["-C", ROOT, "show", `${BASE_REF}:${file}`], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    return {
      ok: false,
      value: null,
      reason: `${BASE_REF}:${file} 不可用（${(err.stderr || err.message || String(err)).toString().trim().split("\n")[0]}）`,
    };
  }
  try {
    const value = loadDataScript(code, `baseline:${file}`, globalName);
    if (value === undefined) {
      return { ok: false, value: null, reason: `${BASE_REF}:${file} 未设置 window.${globalName}` };
    }
    return { ok: true, value, reason: null };
  } catch (err) {
    return { ok: false, value: null, reason: `${BASE_REF}:${file} 解析失败：${err.message}` };
  }
}

function seriesModelsTotal(doc) {
  return doc.series.reduce((sum, s) => sum + s.models.length, 0);
}

/** 名称归一化：去掉空白并转小写。 */
function normalizeName(name) {
  return String(name).replace(/\s+/g, "").toLowerCase();
}

function pctDelta(current, baseline) {
  if (!Number.isFinite(baseline) || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function signed(n) {
  return n >= 0 ? `+${n}` : String(n);
}

function fmtPct(value) {
  if (value === null) return "n/a";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

function countsByKey(doc) {
  const map = new Map();
  for (const s of doc.series) {
    map.set(keyOf(s.brand, s.series), s.models.length);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 载入数据
// ---------------------------------------------------------------------------

const localModels = loadLocal("data/models.js", "MOBILE_MODELS");
const localStatus = loadLocal("data/model-status.js", "MODEL_STATUS");
const localRules = loadLocal("data/rules.js", "MODEL_RULES");

if (!localModels.ok || !localStatus.ok || !localRules.ok) {
  process.stdout.write("=== 数据校验 ===\n无法载入数据，校验中止：\n");
  for (const e of errors) process.stdout.write(`  - ${e}\n`);
  process.exit(1);
}

const models = localModels.value;
const status = localStatus.value;
const rules = localRules.value;

// 基线
const baselineModels = loadBaseline("data/models.js", "MOBILE_MODELS");
const baselineStatus = loadBaseline("data/model-status.js", "MODEL_STATUS");

if (!baselineModels.ok || !baselineStatus.ok) {
  const reasons = [baselineModels.reason, baselineStatus.reason].filter(Boolean);
  if (ALLOW_MISSING_BASELINE) {
    for (const reason of reasons) {
      warn(`跳过基线对比：${reason}`);
    }
  } else {
    for (const reason of reasons) {
      expect(false, `基线数据缺失（设置 ALLOW_MISSING_BASELINE=1 可跳过）：${reason}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. models.meta
// ---------------------------------------------------------------------------

expect(isPlainObject(models.meta), "models.meta 缺失或不是对象");
const modelsMeta = isPlainObject(models.meta) ? models.meta : {};

if (isPlainObject(models.meta)) {
  expect(modelsMeta.source === EXPECTED_META.source, `models.meta.source 应为 "${EXPECTED_META.source}"，实际为 ${JSON.stringify(modelsMeta.source)}`);
  expect(modelsMeta.license === EXPECTED_META.license, `models.meta.license 应为 "${EXPECTED_META.license}"，实际为 ${JSON.stringify(modelsMeta.license)}`);
  expect(typeof modelsMeta.upstreamCommit === "string" && HEX40.test(modelsMeta.upstreamCommit), `models.meta.upstreamCommit 应为 40 位小写十六进制，实际为 ${JSON.stringify(modelsMeta.upstreamCommit)}`);
  expect(isPlainObject(modelsMeta.stats), "models.meta.stats 缺失或不是对象");
}

// ---------------------------------------------------------------------------
// 2. models.series 结构
// ---------------------------------------------------------------------------

const modelsSeries = Array.isArray(models.series) ? models.series : [];
expect(modelsSeries.length > 0, "models.series 为空");

const modelSeriesKeys = new Set();
const modelSeriesCounts = new Map();
const modelSeriesNames = new Set();

for (const [i, s] of modelsSeries.entries()) {
  const label = `models.series[${i}]`;
  if (!isPlainObject(s)) {
    expect(false, `${label} 不是对象`);
    continue;
  }
  const brandOk = expect(isNonEmptyString(s.brand), `${label}.brand 必须是非空字符串`);
  const seriesOk = expect(isNonEmptyString(s.series), `${label}.series 必须是非空字符串`);
  const modelsOk = expect(Array.isArray(s.models) && s.models.length > 0, `${label}（${s.brand}/${s.series}）models 必须是非空数组`);
  if (!Array.isArray(s.models)) continue;

  if (brandOk && seriesOk) {
    const key = keyOf(s.brand, s.series);
    expect(!modelSeriesKeys.has(key), `models.series 存在重复系列：${s.brand}/${s.series}`);
    modelSeriesKeys.add(key);
    modelSeriesCounts.set(key, s.models.length);
  }

  const seen = new Set();
  for (const [j, name] of s.models.entries()) {
    if (!expect(isNonEmptyString(name), `${label}.models[${j}] 必须是非空字符串`)) continue;
    expect(!seen.has(name), `${label}.models 内重复机型名：${name}`);
    seen.add(name);
  }

  const unionKey = keyOf(s.brand, s.series);
  expect(!modelSeriesNames.has(unionKey), `models 系列键重复：${unionKey}`);
  modelSeriesNames.add(unionKey);
}

// ---------------------------------------------------------------------------
// 3. rules 源系列集合必须与 models 系列集合完全一致
// ---------------------------------------------------------------------------

const rulesSeries = Array.isArray(rules.series) ? rules.series : [];
expect(rulesSeries.length > 0, "rules.series 为空");

const expectedSourceKeys = new Set();
for (const [i, s] of rulesSeries.entries()) {
  if (!isPlainObject(s)) {
    expect(false, `rules.series[${i}] 不是对象`);
    continue;
  }
  const brandOk = expect(isNonEmptyString(s.sourceBrand), `rules.series[${i}].sourceBrand 必须是非空字符串`);
  const seriesOk = expect(isNonEmptyString(s.sourceSeries), `rules.series[${i}].sourceSeries 必须是非空字符串`);
  if (brandOk && seriesOk) expectedSourceKeys.add(keyOf(s.sourceBrand, s.sourceSeries));
}

const modelKeys = new Set(modelsSeries.filter(isPlainObject).map((s) => keyOf(s.brand, s.series)));
for (const key of expectedSourceKeys) {
  if (!modelKeys.has(key)) {
    const [brand, series] = key.split("\u0000");
    expect(false, `models 缺少 rules 声明的源系列：${brand}/${series}`);
  }
}
for (const key of modelKeys) {
  if (!expectedSourceKeys.has(key)) {
    const [brand, series] = key.split("\u0000");
    expect(false, `models 存在 rules 未声明的源系列：${brand}/${series}`);
  }
}
expect(expectedSourceKeys.size > 0, "rules 未声明任何源系列");

// ---------------------------------------------------------------------------
// 4. 源机型总数相对基线
// ---------------------------------------------------------------------------

const modelsTotal = modelsSeries.reduce((sum, s) => (Array.isArray(s?.models) ? sum + s.models.length : sum), 0);

if (isPlainObject(models.meta) && isPlainObject(modelsMeta.stats)) {
  expect(modelsMeta.stats.series === modelsSeries.length, `models.meta.stats.series=${modelsMeta.stats.series}，实际系列数=${modelsSeries.length}`);
  expect(modelsMeta.stats.models === modelsTotal, `models.meta.stats.models=${modelsMeta.stats.models}，实际机型数=${modelsTotal}`);
}

let baselineModelsTotal = null;
let baselineSeriesCounts = null;
if (baselineModels.ok) {
  const b = baselineModels.value;
  const bSeries = Array.isArray(b?.series) ? b.series : [];
  baselineModelsTotal = bSeries.reduce((sum, s) => (Array.isArray(s?.models) ? sum + s.models.length : sum), 0);
  baselineSeriesCounts = countsByKey(b);
  expect(baselineModelsTotal > 0, `基线 ${BASE_REF}:data/models.js 机型总数为 0`);

  if (baselineModelsTotal > 0) {
    const minAllowed = baselineModelsTotal * (1 - MAX_DROP_PCT / 100);
    const maxAllowed = baselineModelsTotal * (1 + MAX_GROWTH_PCT / 100);
    expect(modelsTotal >= minAllowed, `源机型总数 ${modelsTotal} 跌幅超过 ${MAX_DROP_PCT}%（基线 ${baselineModelsTotal}，下限 ${Math.floor(minAllowed)}）`);
    expect(modelsTotal <= maxAllowed, `源机型总数 ${modelsTotal} 涨幅超过 ${MAX_GROWTH_PCT}%（基线 ${baselineModelsTotal}，上限 ${Math.floor(maxAllowed)}）`);
  }
}

// ---------------------------------------------------------------------------
// 5. status.meta
// ---------------------------------------------------------------------------

expect(isPlainObject(status.meta), "status.meta 缺失或不是对象");
const statusMeta = isPlainObject(status.meta) ? status.meta : {};

if (isPlainObject(status.meta)) {
  expect(statusMeta.sourceModels === "data/models.js", `status.meta.sourceModels 应为 "data/models.js"，实际为 ${JSON.stringify(statusMeta.sourceModels)}`);
  expect(statusMeta.sourceRules === "data/rules.js", `status.meta.sourceRules 应为 "data/rules.js"，实际为 ${JSON.stringify(statusMeta.sourceRules)}`);
  expect(statusMeta.license === EXPECTED_META.license, `status.meta.license 应为 "${EXPECTED_META.license}"，实际为 ${JSON.stringify(statusMeta.license)}`);
  const commitOk = expect(typeof statusMeta.upstreamCommit === "string" && HEX40.test(statusMeta.upstreamCommit), `status.meta.upstreamCommit 应为 40 位小写十六进制，实际为 ${JSON.stringify(statusMeta.upstreamCommit)}`);
  if (commitOk && isPlainObject(models.meta)) {
    expect(statusMeta.upstreamCommit === modelsMeta.upstreamCommit, `status.meta.upstreamCommit=${statusMeta.upstreamCommit} 与 models.meta.upstreamCommit=${modelsMeta.upstreamCommit} 不一致`);
  }
  expect(isPlainObject(statusMeta.stats), "status.meta.stats 缺失或不是对象");
}

// ---------------------------------------------------------------------------
// 6. status.series 结构与 rules 展示系列
// ---------------------------------------------------------------------------

const statusSeries = Array.isArray(status.series) ? status.series : [];
expect(statusSeries.length === rulesSeries.length, `status.series 长度=${statusSeries.length}，rules.series 长度=${rulesSeries.length}`);

const statusKeys = new Set();
const statusCounts = new Map();
let statusTotal = 0;

for (const [i, s] of statusSeries.entries()) {
  const label = `status.series[${i}]`;
  if (!isPlainObject(s)) {
    expect(false, `${label} 不是对象`);
    continue;
  }
  const brandOk = expect(isNonEmptyString(s.brand), `${label}.brand 必须是非空字符串`);
  const seriesOk = expect(isNonEmptyString(s.series), `${label}.series 必须是非空字符串`);
  const modelsOk = expect(Array.isArray(s.models) && s.models.length > 0, `${label}（${s.brand}/${s.series}）models 必须是非空数组`);
  if (!Array.isArray(s.models)) continue;

  if (brandOk && seriesOk) {
    const key = keyOf(s.brand, s.series);
    expect(!statusKeys.has(key), `status.series 存在重复系列：${s.brand}/${s.series}`);
    statusKeys.add(key);
    statusCounts.set(key, s.models.length);
  }
  statusTotal += s.models.length;
}

const expectedDisplayKeys = new Set(
  rulesSeries.filter(isPlainObject).map((s) => keyOf(s.brand, s.series)),
);
for (const key of expectedDisplayKeys) {
  const [brand, series] = key.split("\u0000");
  expect(statusKeys.has(key), `status 缺少 rules 声明的展示系列：${brand}/${series}`);
}
for (const key of statusKeys) {
  if (!expectedDisplayKeys.has(key)) {
    const [brand, series] = key.split("\u0000");
    expect(false, `status 存在 rules 未声明的展示系列：${brand}/${series}`);
  }
}

// ---------------------------------------------------------------------------
// 7. status 机型字段
// ---------------------------------------------------------------------------

for (const [i, s] of statusSeries.entries()) {
  if (!isPlainObject(s) || !Array.isArray(s.models)) continue;
  const label = `status.series[${i}]（${s.brand}/${s.series}）`;
  const seen = new Set();
  for (const [j, m] of s.models.entries()) {
    const itemLabel = `${label}.models[${j}]`;
    if (!isPlainObject(m)) {
      expect(false, `${itemLabel} 不是对象`);
      continue;
    }
    expect(isNonEmptyString(m.name), `${itemLabel}.name 必须是非空字符串`);
    const tierOk = expect(TIERS.includes(m.tier), `${itemLabel}（${m.name}）tier=${JSON.stringify(m.tier)} 不在 [${TIERS.join(", ")}]`);
    const perfOk = expect(m.performance === null || LEVELS.includes(m.performance), `${itemLabel}（${m.name}）performance=${JSON.stringify(m.performance)} 不在 [${LEVELS.join(", ")}] 或 null`);
    const camOk = expect(m.camera === null || LEVELS.includes(m.camera), `${itemLabel}（${m.name}）camera=${JSON.stringify(m.camera)} 不在 [${LEVELS.join(", ")}] 或 null`);

    if (tierOk && perfOk && camOk) {
      if (m.tier === "ultra") {
        // ultra 允许 null，也允许有值
      } else {
        expect(m.performance !== null, `${itemLabel}（${m.name}）非 ultra 机型 performance 不能为 null`);
        expect(m.camera !== null, `${itemLabel}（${m.name}）非 ultra 机型 camera 不能为 null`);
      }
    }

    if (isNonEmptyString(m.name)) {
      const norm = normalizeName(m.name);
      expect(!seen.has(norm), `${label} 内重复机型名（归一化后）：${m.name}`);
      seen.add(norm);
    }
  }
}

// ---------------------------------------------------------------------------
// 8. status 总数
// ---------------------------------------------------------------------------

if (isPlainObject(status.meta) && isPlainObject(statusMeta.stats)) {
  expect(statusMeta.stats.series === statusSeries.length, `status.meta.stats.series=${statusMeta.stats.series}，实际系列数=${statusSeries.length}`);
  expect(statusMeta.stats.models === statusTotal, `status.meta.stats.models=${statusMeta.stats.models}，实际机型数=${statusTotal}`);
  expect(statusMeta.stats.sourceModels === modelsTotal, `status.meta.stats.sourceModels=${statusMeta.stats.sourceModels}，models 实际机型数=${modelsTotal}`);
}

expect(statusTotal >= MIN_STATUS_MODELS, `展示机型总数 ${statusTotal} 低于下限 ${MIN_STATUS_MODELS}`);
expect(statusTotal <= modelsTotal, `展示机型总数 ${statusTotal} 超过源机型总数 ${modelsTotal}`);

let baselineStatusTotal = null;
if (baselineStatus.ok) {
  const b = baselineStatus.value;
  const bSeries = Array.isArray(b?.series) ? b.series : [];
  baselineStatusTotal = bSeries.reduce((sum, s) => (Array.isArray(s?.models) ? sum + s.models.length : sum), 0);
  expect(baselineStatusTotal > 0, `基线 ${BASE_REF}:data/model-status.js 机型总数为 0`);

  if (baselineStatusTotal > 0) {
    const minAllowed = baselineStatusTotal * (1 - MAX_DROP_PCT / 100);
    const maxAllowed = baselineStatusTotal * (1 + MAX_GROWTH_PCT / 100);
    expect(statusTotal >= minAllowed, `展示机型总数 ${statusTotal} 跌幅超过 ${MAX_DROP_PCT}%（基线 ${baselineStatusTotal}，下限 ${Math.floor(minAllowed)}）`);
    expect(statusTotal <= maxAllowed, `展示机型总数 ${statusTotal} 涨幅超过 ${MAX_GROWTH_PCT}%（基线 ${baselineStatusTotal}，上限 ${Math.floor(maxAllowed)}）`);
  }
}

// ---------------------------------------------------------------------------
// 9. 警告：单一源系列跌幅超过 30%
// ---------------------------------------------------------------------------

if (baselineSeriesCounts) {
  for (const [key, count] of modelSeriesCounts) {
    const baseCount = baselineSeriesCounts.get(key);
    if (!baseCount) continue;
    const delta = pctDelta(count, baseCount);
    if (delta !== null && delta < -30) {
      const [brand, series] = key.split("\u0000");
      warn(`源系列 ${brand}/${series} 数量下降 ${fmtPct(delta)}（基线 ${baseCount} → 当前 ${count}）`);
    }
  }
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

function report() {
  const lines = [];
  lines.push("=== 数据校验 ===");
  lines.push(
    `源数据（data/models.js）：系列 ${modelsSeries.length}` +
      (baselineModelsTotal !== null ? `（基线 ${baselineSeriesCounts.size}，${signed(modelsSeries.length - baselineSeriesCounts.size)}）` : ""),
  );
  lines.push(
    `源机型：${modelsTotal}` + (baselineModelsTotal !== null ? `（基线 ${baselineModelsTotal}，${signed(modelsTotal - baselineModelsTotal)}，${fmtPct(pctDelta(modelsTotal, baselineModelsTotal))}）` : ""),
  );
  lines.push(
    `展示系列（data/model-status.js）：${statusSeries.length}` +
      (baselineStatus.ok ? `（基线 ${Array.isArray(baselineStatus.value?.series) ? baselineStatus.value.series.length : 0}，${signed(statusSeries.length - (baselineStatus.value?.series?.length || 0))}）` : ""),
  );
  lines.push(
    `展示机型：${statusTotal}` + (baselineStatusTotal !== null ? `（基线 ${baselineStatusTotal}，${signed(statusTotal - baselineStatusTotal)}，${fmtPct(pctDelta(statusTotal, baselineStatusTotal))}）` : ""),
  );
  lines.push(`上游提交：${modelsMeta.upstreamCommit || "(缺失)"}`);
  if (baselineSeriesCounts && baselineModelsTotal !== null) {
    const changes = [];
    for (const [key, count] of modelSeriesCounts) {
      const baseCount = baselineSeriesCounts.get(key);
      if (baseCount === undefined) {
        const [brand, series] = key.split("\u0000");
        changes.push(`${brand}/${series} 新增（${count}）`);
      } else if (baseCount !== count) {
        const [brand, series] = key.split("\u0000");
        changes.push(`${brand}/${series} ${baseCount}→${count}`);
      }
    }
    for (const key of baselineSeriesCounts.keys()) {
      if (!modelSeriesCounts.has(key)) {
        const [brand, series] = key.split("\u0000");
        changes.push(`${brand}/${series} 移除（原 ${baselineSeriesCounts.get(key)}）`);
      }
    }
    if (changes.length) lines.push(`源系列变化：${changes.join("；")}`);
  }
  lines.push(`检查：${passed} 通过，${failed} 失败`);

  if (warnings.length) {
    lines.push("");
    lines.push(`警告（${warnings.length}，不影响退出码）：`);
    for (const w of warnings) lines.push(`  - ${w}`);
  }

  if (errors.length) {
    lines.push("");
    lines.push(`错误（${errors.length}）：`);
    for (const e of errors) lines.push(`  - ${e}`);
  }

  process.stdout.write(lines.join("\n") + "\n");
}

report();
process.exit(errors.length ? 1 : 0);
