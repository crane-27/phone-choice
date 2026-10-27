#!/usr/bin/env node
/**
 * test-recommend.mjs — 推荐内核的本地断言
 *
 * 用法：node data/test-recommend.mjs
 * 只读 data/model-status.js 与 assets/recommend.js，不修改任何文件。
 */

import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "..");

globalThis.window = {};
require(path.join(ROOT, "data", "model-status.js"));
require(path.join(ROOT, "assets", "recommend.js"));

const R = globalThis.window.Recommend;
const STATUS = globalThis.window.MODEL_STATUS;

assert.ok(R, "Recommend 未加载");
assert.ok(STATUS, "MODEL_STATUS 未加载");

const LEVEL = { low: 0, medium: 1, high: 2 };
const TIER = { entry: 0, mid: 1, upper: 2, flagship: 3, ultra: 4 };

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function build(input) {
  return R.build(input);
}

function allItems(r) {
  return r.main.concat(r.overBudget);
}

function assertNoDup(r) {
  const keys = allItems(r).map((m) => `${m.brand}|${m.series}|${m.name}`);
  assert.equal(new Set(keys).size, keys.length, "main/overBudget 存在重复机型");
}

function assertMeets(r, perf, camera) {
  allItems(r).forEach((m) => {
    assert.ok(
      ["low", "medium", "high"].includes(m.performance),
      `${m.name} performance 非法：${m.performance}`,
    );
    assert.ok(
      ["low", "medium", "high"].includes(m.camera),
      `${m.name} camera 非法：${m.camera}`,
    );
    assert.ok(
      LEVEL[m.performance] >= LEVEL[perf],
      `${m.name} 性能不足：${m.performance} < ${perf}`,
    );
    assert.ok(
      LEVEL[m.camera] >= LEVEL[camera],
      `${m.name} 影像不足：${m.camera} < ${camera}`,
    );
  });
}

console.log("推荐内核断言：\n");

check("I'm rich 只取 ultra，且不看预算", () => {
  const r = build({ need: "rich", budget: "entry" });
  assert.equal(r.meta.rich, true);
  assert.equal(r.overBudget.length, 0);
  assert.ok(r.main.length >= 1);
  r.main.forEach((m) => assert.equal(m.tier, "ultra"));
  assert.ok(r.main.some((m) => m.name === "HUAWEI Mate X7"));
  assert.ok(r.main.some((m) => m.name === "HUAWEI Mate XT 2 非凡大师"));
});

check("较高性能 + 基本影像 + 旗舰预算：优先列出低于预算的机型", () => {
  const r = build({ perf: "high", camera: "basic", budget: "flagship" });
  assert.ok(r.main.length >= 1);
  r.main.forEach((m) => {
    assert.ok(["entry", "mid", "upper", "flagship"].includes(m.tier));
    assert.ok(["below", "at"].includes(m.budgetStatus));
  });
  assertMeets(r, "high", "medium");
  assertNoDup(r);
});

check("较高性能 + 基本影像 + 中端预算：同预算不足时进入超预算栏", () => {
  const r = build({ perf: "high", camera: "basic", budget: "mid" });
  assert.equal(r.main.length, 0);
  assert.ok(r.overBudget.length >= 1);
  r.overBudget.forEach((m) => {
    assert.equal(m.budgetStatus, "above");
    assert.ok(TIER[m.tier] > TIER.mid);
  });
  assertMeets(r, "high", "medium");
  assertNoDup(r);
});

check("较高性能 + 基本影像 + 入门预算：主栏为空，超预算栏取最近更高档", () => {
  const r = build({ perf: "high", camera: "basic", budget: "entry" });
  assert.equal(r.main.length, 0);
  assert.ok(r.overBudget.length >= 1);
  r.overBudget.forEach((m) => {
    assert.equal(m.budgetStatus, "above");
    assert.ok(TIER[m.tier] > TIER.entry);
  });
  assertMeets(r, "high", "medium");
  assertNoDup(r);
});

check("一定性能 + 无影像 + 中端预算：只按性能下限过滤", () => {
  const r = build({ perf: "some", camera: "none", budget: "mid" });
  assert.ok(r.main.length >= 3);
  r.main.forEach((m) => {
    assert.ok(["entry", "mid"].includes(m.tier));
  });
  assertMeets(r, "medium", "low");
  assertNoDup(r);
});

check("入门预算：同预算档全部列出", () => {
  const r = build({ perf: "none", camera: "none", budget: "entry" });
  assert.ok(r.main.length >= 3);
  assert.equal(r.overBudget.length, 0);
  r.main.forEach((m) => assert.equal(m.tier, "entry"));
});

check("groupBySeries 分组不丢机型", () => {
  const r = build({ perf: "some", camera: "basic", budget: "upper" });
  const groups = R.groupBySeries(r.main);
  const total = groups.reduce((n, g) => n + g.models.length, 0);
  assert.equal(total, r.main.length);
  groups.forEach((g) => assert.ok(g.models.length > 0));
});

check("特殊需求 android：排除华为与苹果", () => {
  const r = build({
    perf: "high",
    camera: "basic",
    budget: "flagship",
    special: ["android"],
  });
  allItems(r).forEach((m) => {
    assert.notEqual(m.brand, "华为");
    assert.notEqual(m.brand, "苹果");
  });
  assert.deepEqual(r.meta.hiddenBrands.sort(), ["华为", "苹果"].sort());
});

check("预算未知：不做档位筛选，全部按定位从高到低", () => {
  const r = build({ perf: "high", camera: "basic", budget: "unknown" });
  assert.equal(r.overBudget.length, 0);
  assert.ok(r.main.length >= 3);
  r.main.forEach((m) => assert.equal(m.budgetStatus, "unknown"));
  for (let i = 1; i < r.main.length; i++) {
    assert.ok(TIER[r.main[i - 1].tier] >= TIER[r.main[i].tier]);
  }
  assertMeets(r, "high", "medium");
});

check("一定性能 + 基本影像 + 中高端预算：低于预算优先", () => {
  const r = build({ perf: "some", camera: "basic", budget: "upper" });
  assert.ok(r.main.length >= 3);
  r.main.forEach((m) => {
    assert.ok(["entry", "mid", "upper"].includes(m.tier));
  });
  assertMeets(r, "medium", "medium");
  assertNoDup(r);
});

check("较高性能 + 较高影像：当前数据为空，不强行放宽条件", () => {
  const r = build({ perf: "high", camera: "high", budget: "flagship" });
  assert.equal(r.main.length, 0);
  assert.equal(r.overBudget.length, 0);
  assert.equal(r.meta.empty, true);
  assertMeets(r, "high", "high");
});

check("android 过滤后无匹配也不强行补产品", () => {
  const r = build({
    perf: "high",
    camera: "high",
    budget: "entry",
    special: ["android"],
  });
  assert.equal(allItems(r).length, 0);
});

console.log(`\n通过 ${passed} 组断言。`);

function preview(list) {
  if (!list.length) return "（空）";
  const head = list
    .slice(0, 8)
    .map((m) => `${m.brand} ${m.series} ${m.name} [${m.tier}]`)
    .join("；");
  return list.length > 8 ? `${head}；…共 ${list.length} 条` : head;
}

// 抽样展示
for (const input of [
  { perf: "high", camera: "basic", budget: "flagship" },
  { perf: "high", camera: "basic", budget: "mid" },
  { perf: "some", camera: "basic", budget: "upper" },
  { perf: "some", camera: "none", budget: "mid" },
  { perf: "high", camera: "high", budget: "flagship" },
]) {
  const r = build(input);
  console.log(
    `\n${input.perf}/${input.camera}/${input.budget}  ` +
      `main=${r.main.length} over=${r.overBudget.length}`,
  );
  console.log(`  main: ${preview(r.main)}`);
  if (r.overBudget.length) console.log(`  over: ${preview(r.overBudget)}`);
}
