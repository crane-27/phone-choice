/*!
 * recommend.js — 机型推荐内核
 *
 * 本文件不包含任何上游数据，只读取 window.MODEL_STATUS；
 * 代码许可见根目录 LICENSE.txt（MIT）。
 *
 * 输入（沿用 needs.html 现有表单）：
 *   perf    "none" | "some" | "high"
 *   camera  "none" | "basic" | "high"
 *   budget  "entry" | "mid" | "upper" | "flagship" | "ultra" | "unknown"
 *   special string[]  "android" | "secret" | "rhythm" | "video"
 *   need    可选，"rich" 时走 I'm rich 独立逻辑
 *
 * 输出：
 *   { input, requirements, main, overBudget, meta }
 *
 * 匹配原则：
 *   1. 性能、影像必须同时达到最低要求，绝不放宽
 *   2. 非 ultra 预算：按定位从高到低逐档选取，达到 10 台即停
 *      单档超过 10 台时全部保留；不足 10 台时继续列出下一档全部机型
 *   3. 预算内不足 TARGET 条时，取最近更高档位放入独立的 overBudget 栏
 *   4. I'm rich 独立处理：只取 tier=ultra，不看预算与性能/影像
 *   5. 性能与影像均为低的机型，只在入门预算（entry）出现
 */
(function (global) {
  "use strict";

  var TIERS = ["entry", "mid", "upper", "flagship", "ultra"];
  var TIER_RANK = { entry: 0, mid: 1, upper: 2, flagship: 3, ultra: 4 };
  var LEVEL_RANK = { low: 0, medium: 1, high: 2 };

  // 表单值 -> 数据侧最低要求
  var PERF_REQ = { none: "low", some: "medium", high: "high" };
  var CAM_REQ = { none: "low", basic: "medium", high: "high" };

  // 旧链接 ?need=... 到新表单值的映射（Phase 3 可直接复用）
  var NEED_PRESET = {
    none: { perf: "none", camera: "none" },
    perf: { perf: "some", camera: "none" },
    camera: { perf: "some", camera: "basic" },
    highperf: { perf: "high", camera: "none" },
    flagship: { perf: "high", camera: "basic" },
    cameraflag: { perf: "high", camera: "high" },
    rich: { perf: "high", camera: "high", need: "rich" },
  };

  var TARGET = 3;
  var RESULT_TARGET = 10;

  function requireStatus() {
    if (!global.MODEL_STATUS || !Array.isArray(global.MODEL_STATUS.series)) {
      throw new Error("recommend.js 需要先加载 data/model-status.js");
    }
    return global.MODEL_STATUS;
  }

  function flatten() {
    var out = [];
    requireStatus().series.forEach(function (s, si) {
      s.models.forEach(function (m, mi) {
        out.push({
          brand: s.brand,
          series: s.series,
          name: m.name,
          nick_name: m.nick_name,
          tier: m.tier,
          performance: m.performance,
          camera: m.camera,
          _order: si * 10000 + mi,
        });
      });
    });
    return out;
  }

  function levelRank(v) {
    return Object.prototype.hasOwnProperty.call(LEVEL_RANK, v) ? LEVEL_RANK[v] : -1;
  }

  function tierRank(v) {
    return Object.prototype.hasOwnProperty.call(TIER_RANK, v) ? TIER_RANK[v] : -1;
  }

  function contains(arr, v) {
    return arr.indexOf(v) !== -1;
  }

  function pickInput(input) {
    var raw = input || {};
    var perf = Object.prototype.hasOwnProperty.call(PERF_REQ, raw.perf) ? raw.perf : "none";
    var camera = Object.prototype.hasOwnProperty.call(CAM_REQ, raw.camera) ? raw.camera : "none";
    var budget = raw.budget === "unknown" || contains(TIERS, raw.budget) ? raw.budget : "unknown";
    var special = Array.isArray(raw.special) ? raw.special.slice() : [];
    return {
      perf: perf,
      camera: camera,
      budget: budget,
      special: special,
      need: raw.need === "rich" ? "rich" : null,
    };
  }

  function specialAllowed(model, input) {
    var hideHuawei = contains(input.special, "android") || contains(input.special, "rhythm");
    var hideApple = contains(input.special, "android");
    if (hideHuawei && model.brand === "华为") return false;
    if (hideApple && model.brand === "苹果") return false;
    return true;
  }

  /** 性能与影像均为低：只在入门预算展示。 */
  function lowEndOnly(model) {
    return model.performance === "low" && model.camera === "low";
  }

  function decorate(model, budgetStatus) {
    return {
      brand: model.brand,
      series: model.series,
      name: model.name,
      ...(model.nick_name ? { nick_name: model.nick_name } : {}),
      tier: model.tier,
      performance: model.performance,
      camera: model.camera,
      budgetStatus: budgetStatus,
      _order: model._order,
    };
  }

  /** 预算内：定位高者优先，同档按数据顺序。 */
  function sortWithinBudgetByTier(a, b) {
    var t = tierRank(b.tier) - tierRank(a.tier);
    if (t !== 0) return t;
    return a._order - b._order;
  }

  /** 预算外：离预算最近者优先，同档按数据顺序。 */
  function sortAboveBudget(a, b) {
    var t = tierRank(a.tier) - tierRank(b.tier);
    if (t !== 0) return t;
    return a._order - b._order;
  }

  /**
   * 已按定位降序排好的列表，按整档累计：
   * 单档超过目标台数时全部保留；不足时继续下一档，直到达到目标。
   */
  function pickTiersByTarget(sortedList) {
    var groups = {};
    sortedList.forEach(function (m) {
      if (!groups[m.tier]) groups[m.tier] = [];
      groups[m.tier].push(m);
    });

    var list = [];
    var tiers = [];
    for (var i = TIERS.length - 1; i >= 0; i--) {
      var group = groups[TIERS[i]];
      if (!group || !group.length) continue;
      list = list.concat(group);
      tiers.push(TIERS[i]);
      if (list.length >= RESULT_TARGET) break;
    }
    return { list: list, tiers: tiers };
  }

  function stripInternal(list) {
    return list.map(function (m) {
      var copy = Object.assign({}, m);
      delete copy._order;
      return copy;
    });
  }

  function build(input) {
    var data = pickInput(input);
    var all = flatten().filter(function (m) {
      if (!specialAllowed(m, data)) return false;
      if (data.budget !== "entry" && lowEndOnly(m)) return false;
      return true;
    });

    // I'm rich：独立档位，不看预算、不看性能/影像
    if (data.need === "rich") {
      var rich = all
        .filter(function (m) {
          return m.tier === "ultra";
        })
        .map(function (m) {
          return decorate(m, "rich");
        });
      return {
        input: data,
        requirements: { performance: null, camera: null },
        main: stripInternal(rich),
        overBudget: [],
        meta: {
          target: TARGET,
          resultTarget: RESULT_TARGET,
          total: rich.length,
          expanded: false,
          rich: true,
          overBudgetUsed: false,
          atBudgetUsed: false,
          empty: rich.length === 0,
          hiddenBrands: hiddenBrands(data),
        },
      };
    }

    var requirements = {
      performance: PERF_REQ[data.perf],
      camera: CAM_REQ[data.camera],
    };

    var eligible = all.filter(function (m) {
      return (
        levelRank(m.performance) >= levelRank(requirements.performance) &&
        levelRank(m.camera) >= levelRank(requirements.camera)
      );
    });

    // 预算未知：不做档位筛选，同样按整档累计
    if (data.budget === "unknown") {
      var pickedUnknown = pickTiersByTarget(
        eligible
          .map(function (m) {
            return decorate(m, "unknown");
          })
          .sort(sortWithinBudgetByTier),
      );
      var mainUnknown = pickedUnknown.list;

      return {
        input: data,
        requirements: requirements,
        main: stripInternal(mainUnknown),
        overBudget: [],
        meta: {
          target: TARGET,
          resultTarget: RESULT_TARGET,
          total: mainUnknown.length,
          expanded: pickedUnknown.tiers.length > 1,
          rich: false,
          overBudgetUsed: false,
          atBudgetUsed: false,
          empty: mainUnknown.length === 0,
          hiddenBrands: hiddenBrands(data),
        },
      };
    }

    var budgetRank = tierRank(data.budget);
    var inBudget = [];
    var above = [];

    eligible.forEach(function (m) {
      var rank = tierRank(m.tier);
      if (rank <= budgetRank) inBudget.push(m);
      else above.push(m);
    });

    // 预算内按定位从高到低排序，优先选取更接近预算上限的机型。
    var inBudgetDecorated = inBudget
      .map(function (m) {
        return decorate(m, tierRank(m.tier) === budgetRank ? "at" : "below");
      })
      .sort(sortWithinBudgetByTier);

    var aboveDecorated = above
      .map(function (m) {
        return decorate(m, "above");
      })
      .sort(sortAboveBudget);

    var picked = pickTiersByTarget(inBudgetDecorated);
    var main = picked.list;
    var expanded = picked.tiers.length > 1;

    // 预算内不足时，取最近的更高档位，放入独立的超预算栏。
    var overBudget = [];
    if (main.length < TARGET && aboveDecorated.length) {
      var aboveRanks = [];
      aboveDecorated.forEach(function (m) {
        var r = tierRank(m.tier);
        if (aboveRanks.indexOf(r) === -1) aboveRanks.push(r);
      });
      aboveRanks.sort(function (a, b) {
        return a - b;
      });
      var nearest = aboveRanks[0];
      overBudget = aboveDecorated.filter(function (m) {
        return tierRank(m.tier) === nearest;
      });
    }

    return {
      input: data,
      requirements: requirements,
      main: stripInternal(main),
      overBudget: stripInternal(overBudget),
      meta: {
        target: TARGET,
        resultTarget: RESULT_TARGET,
        total: main.length + overBudget.length,
        expanded: expanded,
        rich: false,
        overBudgetUsed: overBudget.length > 0,
        atBudgetUsed: main.some(function (m) {
          return m.budgetStatus === "at";
        }),
        empty: main.length === 0 && overBudget.length === 0,
        hiddenBrands: hiddenBrands(data),
      },
    };
  }

  function hiddenBrands(data) {
    var out = [];
    if (contains(data.special, "android") || contains(data.special, "rhythm")) out.push("华为");
    if (contains(data.special, "android")) out.push("苹果");
    return out;
  }

  /** 把扁平的推荐列表按品牌 / 系列分组，供前端直接渲染。 */
  function groupBySeries(list) {
    var map = {};
    var order = [];
    list.forEach(function (m) {
      var key = m.brand + "\u0000" + m.series;
      if (!map[key]) {
        map[key] = { brand: m.brand, series: m.series, models: [] };
        order.push(key);
      }
      map[key].models.push(m);
    });
    return order.map(function (k) {
      return map[k];
    });
  }

  global.Recommend = {
    build: build,
    groupBySeries: groupBySeries,
    TARGET: TARGET,
    RESULT_TARGET: RESULT_TARGET,
    TIERS: TIERS.slice(),
    PERF_REQ: Object.assign({}, PERF_REQ),
    CAM_REQ: Object.assign({}, CAM_REQ),
    NEED_PRESET: Object.assign({}, NEED_PRESET),
    STORAGE_KEY: "pc.needs.v1",
  };
})(typeof window !== "undefined" ? window : globalThis);
