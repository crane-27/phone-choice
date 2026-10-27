#!/usr/bin/env node
/**
 * build-status.mjs — 按 data/rules.js 为每个机型生成定位状态
 *
 * 用法：node data/build-status.mjs
 * 输入：data/models.js（品牌 / 系列 / 机型名）
 *       data/rules.js （机器可读的提取规则，含展示用 brand / series）
 * 产物：data/model-status.js（window.MODEL_STATUS）
 *
 * 规则要点：
 * - 一个源系列可拆成多个展示系列（如 Mate / Mate X / Mate XT、一加 数字 / Ace / Turbo）
 * - 每个源条目只会归入一个展示系列，避免拆系列后重复
 * - 以 `/` 拆分的名称逐段匹配，命中段保留；其余段写入 nick_name
 * - 排除规则在拆分后应用
 * - 代际按规则组内倒序扫描：列表末尾为当代，超过该组最大 window 即停止
 * - window=1 仅当代，2=当代+n-1，3=当代+n-1+n-2
 * - 每老一代 tier 下调一级，最低 entry；performance 按规则，camera 不随代际下降
 *
 * 数据许可：输出为 data/models.js 的衍生数据，遵守 CC BY-NC-SA 4.0。
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "..");
const MODELS_FILE = path.join(ROOT, "data", "models.js");
const RULES_FILE = path.join(ROOT, "data", "rules.js");
const OUT_FILE = path.join(ROOT, "data", "model-status.js");

const TIERS = ["entry", "mid", "upper", "flagship", "ultra"];

/* ------------------------------ 加载 ------------------------------ */

function loadWindowGlobal(file, key) {
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  const value = sandbox.window[key];
  if (!value) throw new Error(`${file} 未导出 window.${key}`);
  return value;
}

/* ------------------------------ 匹配 ------------------------------ */

function normalize(s) {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 把文档里的通配符编译成正则。
 * [num] / [?num] 用“先行断言 + 反向引用”固定整段数字，避免 [num][...] 把末位数字
 * 回退给 [...] 导致代际算错（例如 iQOO Z11 被解析成 Z1 + "1"）。
 */
function compilePattern(source) {
  const pattern = normalize(source);
  let out = "";
  let genGroup = null;
  let i = 0;

  while (i < pattern.length) {
    if (pattern.startsWith("[?num]", i)) {
      const name = `n${i}`;
      out += `(?=(?<${name}>\\d*))\\k<${name}>`;
      if (!genGroup) genGroup = name;
      i += 6;
    } else if (pattern.startsWith("[num]", i)) {
      const name = `n${i}`;
      out += `(?=(?<${name}>\\d+))\\k<${name}>`;
      if (!genGroup) genGroup = name;
      i += 5;
    } else if (pattern.startsWith("[?...]", i)) {
      out += "(?:.*?)";
      i += 6;
    } else if (pattern.startsWith("[...]", i)) {
      out += "(?:.+?)";
      i += 5;
    } else {
      out += escapeRegExp(pattern[i]);
      i += 1;
    }
  }

  return { source, genGroup, regex: new RegExp(`^${out}$`, "u") };
}

function matchCompiled(compiled, text) {
  const m = compiled.regex.exec(text);
  if (!m) return null;

  if (!compiled.genGroup) return { gen: null };

  const raw = m.groups?.[compiled.genGroup] ?? "";
  return { gen: raw === "" ? 1 : Number(raw) };
}

function isExcluded(text, group) {
  return group.compiledExcludes.some((p) => p.regex.test(text));
}

function matchInGroup(text, group) {
  if (isExcluded(text, group)) return null;

  for (const rule of group.compiledRules) {
    for (const compiled of rule.compiled) {
      const m = matchCompiled(compiled, text);
      if (m) {
        return { group, rule, gen: m.gen, pattern: compiled.source };
      }
    }
  }
  return null;
}

function matchInGroups(text, groups) {
  for (const group of groups) {
    const hit = matchInGroup(text, group);
    if (hit) return hit;
  }
  return null;
}

function splitName(name) {
  return name
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function downgrade(tier, age) {
  const idx = TIERS.indexOf(tier);
  if (idx < 0) throw new Error(`未知档位：${tier}`);
  return TIERS[Math.max(0, idx - age)];
}

/** 该条目在指定 group 内命中的数字代际（可能有多个，取最大者为该条目的代际）。 */
function matchedNums(entry, group) {
  const nums = [];
  for (const p of entry.parts) {
    const hit = matchInGroup(p.norm, group);
    if (hit && hit.gen != null) nums.push(hit.gen);
  }
  return nums;
}

function entryMatchesGroup(entry, group) {
  return entry.parts.some((p) => matchInGroup(p.norm, group));
}

/**
 * 合并别名条目：若某机型的 name 出现在另一机型的 nick_name 中，
 * 说明上游把它作为同一台机器的别名重复列出，合并后删除重复项。
 */
function dedupeAliases(models) {
  const owners = new Map();
  for (const m of models) {
    for (const n of m.nick_name ?? []) owners.set(normalize(n), m);
  }

  return models.filter((m) => {
    const owner = owners.get(normalize(m.name));
    if (!owner || owner === m) return true;

    const merged = [...new Set([...(owner.nick_name ?? []), ...(m.nick_name ?? [])])]
      .filter((n) => normalize(n) !== normalize(owner.name));
    if (merged.length) owner.nick_name = merged;
    else delete owner.nick_name;
    return false;
  });
}

/* ------------------------------ 构建 ------------------------------ */

function main() {
  const models = loadWindowGlobal(MODELS_FILE, "MOBILE_MODELS");
  const rules = loadWindowGlobal(RULES_FILE, "MODEL_RULES");

  const modelsBySeries = new Map(
    models.series.map((s) => [`${s.brand}\u0000${s.series}`, s]),
  );

  // 编译规则，并建立“源系列 -> 展示系列列表”的映射
  const bySource = new Map();
  for (const outSeries of rules.series) {
    for (const group of outSeries.groups) {
      group.output = outSeries;
      group.compiledRules = group.rules.map((rule) => ({
        ...rule,
        compiled: rule.patterns.map(compilePattern),
      }));
      group.compiledExcludes = (group.excludes ?? []).map(compilePattern);
      group.maxWindow = Math.max(...group.rules.map((r) => r.window));
      group.hasNumeric = group.compiledRules.some((r) =>
        r.compiled.some((p) => p.genGroup !== null),
      );
    }

    const key = `${outSeries.sourceBrand}\u0000${outSeries.sourceSeries}`;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(outSeries);
  }

  const buckets = new Map(); // 展示系列 -> 机型数组
  const seenBySeries = new Map(); // 展示系列 -> Map<normalized name, model>
  for (const outSeries of rules.series) {
    buckets.set(outSeries, []);
    seenBySeries.set(outSeries, new Map());
  }

  const stats = {
    series: 0,
    models: 0,
    sourceModels: 0,
    droppedNoRule: 0,
    droppedOutOfWindow: 0,
    mergedAliases: 0,
  };

  const emptySeries = [];

  // 逐个源系列处理
  for (const [key, outSeriesList] of bySource) {
    const source = modelsBySeries.get(key);
    if (!source) {
      const [brand, series] = key.split("\u0000");
      throw new Error(`models.js 中找不到系列：${brand} / ${series}`);
    }

    const groups = outSeriesList.flatMap((s) => s.groups);

    const entries = source.models.map((rawName) => ({
      rawName,
      parts: splitName(rawName).map((part) => ({ part, norm: normalize(part) })),
    }));

    // 每组独立计算代际：倒序扫描，超过该组最大 window 即停止
    for (const group of groups) {
      group.entryAge = new Map();
      group.entryNum = new Map();

      if (!group.hasNumeric) {
        if (group.lastOnly) {
          // 只保留源列表中最后一条命中项（用于 Mate XT）
          for (let i = entries.length - 1; i >= 0; i--) {
            if (entryMatchesGroup(entries[i], group)) {
              group.entryAge.set(entries[i], 0);
              group.entryNum.set(entries[i], null);
              break;
            }
          }
        } else {
          for (const entry of entries) {
            if (entryMatchesGroup(entry, group)) {
              group.entryAge.set(entry, 0);
              group.entryNum.set(entry, null);
            }
          }
        }
        group.gens = [];
        continue;
      }

      const genNumbers = [];
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        const nums = matchedNums(entry, group);
        if (nums.length === 0) continue;

        const entryNum = Math.max(...nums);
        let idx = genNumbers.indexOf(entryNum);
        if (idx === -1) {
          if (genNumbers.length >= group.maxWindow) break;
          genNumbers.push(entryNum);
          idx = genNumbers.length - 1;
        }

        group.entryAge.set(entry, idx);
        group.entryNum.set(entry, entryNum);
      }
      group.gens = genNumbers;
    }

    for (const entry of entries) {
      stats.sourceModels += 1;

      const candidates = entry.parts
        .map((p) => {
          const hit = matchInGroups(p.norm, groups);
          if (!hit) return null;

          const age = hit.group.entryAge.get(entry);
          if (age === undefined) return null;
          if (age >= hit.rule.window) return null;

          return { ...hit, part: p.part, norm: p.norm, age };
        })
        .filter(Boolean);

      if (candidates.length === 0) {
        const anyMatch = entry.parts.some((p) => matchInGroups(p.norm, groups));
        if (anyMatch) {
          stats.droppedOutOfWindow += 1;
        } else {
          stats.droppedNoRule += 1;
        }
        continue;
      }

      // 组合名里可能同时含新旧两代（如 Redmi 14C / REDMI 17C）；
      // 优先用与条目代际一致的那一段作为主名称，其余写入 nick_name。
      const preferred = candidates.filter((c) => {
        if (c.gen == null) return false;
        const entryNum = c.group.entryNum.get(entry);
        return entryNum != null && c.gen === entryNum;
      });
      const primary = (preferred.length ? preferred : candidates)[0];
      const outSeries = primary.group.output;
      const age = primary.age;

      const rich = Boolean(primary.rule.rich);
      const tierAge = primary.rule.noTierDecay ? 0 : age;
      const tier = rich ? "ultra" : downgrade(primary.rule.tier, tierAge);
      const performance = rich
        ? null
        : primary.rule.perf.mode === "gen"
          ? age === 0
            ? primary.rule.perf.current
            : primary.rule.perf.older
          : primary.rule.perf.level;
      const camera = rich ? null : primary.rule.camera;

      const nickName = [
        ...new Set(
          entry.parts
            .map((p) => p.part)
            .filter((p) => normalize(p) !== normalize(primary.part))
            .filter((p) => !isExcluded(normalize(p), primary.group)),
        ),
      ];

      const model = {
        name: primary.part,
        ...(nickName.length ? { nick_name: nickName } : {}),
        tier,
        performance,
        camera,
      };

      const seen = seenBySeries.get(outSeries);
      const outKey = normalize(model.name);
      if (seen.has(outKey)) {
        const prev = seen.get(outKey);
        if (nickName.length) {
          prev.nick_name = [...new Set([...(prev.nick_name ?? []), ...nickName])];
        }
      } else {
        seen.set(outKey, model);
        buckets.get(outSeries).push(model);
      }
    }
  }

  // 按 rules.js 的顺序输出，并做别名合并
  const outputSeries = [];
  for (const outSeries of rules.series) {
    const finalModels = dedupeAliases(buckets.get(outSeries) ?? []);
    stats.mergedAliases += (buckets.get(outSeries) ?? []).length - finalModels.length;

    if (finalModels.length === 0) {
      emptySeries.push(`${outSeries.brand} / ${outSeries.series}`);
      continue;
    }

    outputSeries.push({
      brand: outSeries.brand,
      series: outSeries.series,
      models: finalModels,
    });

    stats.series += 1;
    stats.models += finalModels.length;

    console.log(
      `  ${String(finalModels.length).padStart(3)}  ${outSeries.brand} / ${outSeries.series}`,
    );
  }

  const meta = {
    sourceModels: "data/models.js",
    sourceRules: "data/rules.js",
    upstreamCommit: models.meta?.upstreamCommit ?? null,
    license: "CC BY-NC-SA 4.0",
    stats,
  };

  const header = `/*!
 * 机型定位状态（衍生数据）—— 请勿手工编辑，重新生成请运行 node data/build-status.mjs
 *
 * 输入：data/models.js（机型名录）+ data/rules.js（提取规则）
 * 数据来源：KHwang9883/MobileModels @ ${meta.upstreamCommit ?? "unknown"}
 * 许可：CC BY-NC-SA 4.0 <https://creativecommons.org/licenses/by-nc-sa/4.0/>
 * 本文件不是 MIT 代码。使用、分发或修改本文件时须遵守上述许可。
 */
`;

  const body =
    `window.MODEL_STATUS = {\n` +
    `  meta: ${JSON.stringify(meta, null, 2)},\n` +
    `  series: [\n` +
    outputSeries
      .map((s) => {
        const modelsText = s.models
          .map((m) => `        ${JSON.stringify(m)}`)
          .join(",\n");
        return (
          `    {\n` +
          `      brand: ${JSON.stringify(s.brand)},\n` +
          `      series: ${JSON.stringify(s.series)},\n` +
          `      models: [\n${modelsText}\n      ]\n` +
          `    }`
        );
      })
      .join(",\n") +
    `\n  ],\n};\n`;

  fs.writeFileSync(OUT_FILE, header + body, "utf8");

  const size = fs.statSync(OUT_FILE).size;
  console.log(`\n已生成 ${path.relative(ROOT, OUT_FILE)}`);
  console.log(
    `  展示系列 ${stats.series} / 机型 ${stats.models}（源条目 ${stats.sourceModels}）`,
  );
  console.log(
    `  丢弃：无规则 ${stats.droppedNoRule}，窗口外 ${stats.droppedOutOfWindow}` +
      `，别名合并 ${stats.mergedAliases}`,
  );
  console.log(`  文件大小 ${(size / 1024).toFixed(1)} KB`);

  if (emptySeries.length) {
    console.log(`\n没有输出任何机型的展示系列：`);
    for (const s of emptySeries) console.log(`  ${s}`);
  }
}

main();
