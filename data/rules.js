/*!
 * 机型定位规则（机器可读）
 *
 * 与 data/提取规则.md 同步维护：文档是给人看的说明，本文件是构建脚本实际读取的规则。
 *
 * 字段说明：
 *   brand / series        输出给前端显示的品牌与系列名
 *   sourceBrand / sourceSeries  对应 data/models.js 中的源系列
 *   groups[]              以文档中的 `---` 分隔，代际在各 group 内独立计算
 *   groups[].window       保留最近几代：1=仅当代，2=当代+n-1，3=当代+n-1+n-2
 *   groups[].lastOnly     true 时不看数字，只保留源列表中最后一条命中项
 *   groups[].rules[]      按数组顺序匹配，靠前者优先
 *   groups[].excludes[]   在 `/` 拆分之后、规则匹配之前应用
 *   rule.tier             当代机型的默认定位；每老一代下调一级，最低到 entry
 *   rule.perf             gen: 当代 high、非当代 older；fixed: 全系同一档
 *   rule.camera           影像档位，不随代际下降
 *   rule.rich             true 时 tier=ultra，performance/camera 输出 null
 *
 * 档位 id：entry | mid | upper | flagship | ultra
 * 性能 / 影像档位：low | medium | high
 */

window.MODEL_RULES = {
  meta: {
    source: "data/提取规则.md",
    tiers: ["entry", "mid", "upper", "flagship", "ultra"],
    levels: ["low", "medium", "high"],
  },

  /* 顺序即前端显示顺序 */
  series: [
    {
      brand: "苹果",
      series: "iPhone系列",
      sourceBrand: "苹果",
      sourceSeries: "iPhone",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["iPhone [num] Pro[?...]"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
            {
              patterns: ["iPhone [num][?...]"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
          ],
          excludes: ["iPhone [num]e"],
        },
      ],
    },

    {
      brand: "华为",
      series: "Mate系列",
      sourceBrand: "华为",
      sourceSeries: "HUAWEI Mate 系列",
      groups: [
        {
          id: "mate",
          rules: [
            {
              patterns: ["HUAWEI Mate [num]", "HUAWEI Mate [num] Pro"],
              window: 3,
              tier: "flagship",
              perf: { mode: "fixed", level: "medium" },
              camera: "medium",
            },
            {
              patterns: [
                "HUAWEI Mate [num] Pro[...]",
                "HUAWEI Mate [num] RS 非凡大师",
              ],
              window: 3,
              tier: "flagship",
              perf: { mode: "fixed", level: "medium" },
              camera: "high",
            },
          ],
        },
      ],
    },
    {
      brand: "华为",
      series: "Mate X系列",
      sourceBrand: "华为",
      sourceSeries: "HUAWEI Mate 系列",
      groups: [
        {
          id: "mate-x",
          rules: [
            {
              patterns: ["HUAWEI Mate X[num]"],
              window: 1,
              tier: "ultra",
              rich: true,
            },
          ],
        },
      ],
    },
    {
      brand: "华为",
      series: "Mate XT系列",
      sourceBrand: "华为",
      sourceSeries: "HUAWEI Mate 系列",
      groups: [
        {
          id: "mate-xt",
          lastOnly: true,
          rules: [
            {
              patterns: ["HUAWEI Mate XT[?...]"],
              window: 1,
              tier: "ultra",
              rich: true,
            },
          ],
        },
      ],
    },
    {
      brand: "华为",
      series: "Pura系列",
      sourceBrand: "华为",
      sourceSeries: "HUAWEI P / Pura 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["HUAWEI Pura [num][?...]"],
              window: 2,
              tier: "upper",
              perf: { mode: "fixed", level: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "华为",
      series: "nova系列",
      sourceBrand: "华为",
      sourceSeries: "HUAWEI nova 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["HUAWEI nova [num][?...]"],
              window: 2,
              tier: "mid",
              noTierDecay: true,
              perf: { mode: "fixed", level: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "华为",
      series: "畅享系列",
      sourceBrand: "华为",
      sourceSeries: "华为畅享系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["华为畅享 [num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },

    {
      brand: "小米",
      series: "数字系列",
      sourceBrand: "小米",
      sourceSeries: "小米数字系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["Xiaomi [num] Ultra"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "high",
            },
            // 文档中通用规则排在 T 规则之前；按文档顺序会把 17T 吞成旗舰。
            // 这里把更具体的 T / T Pro 前置，符合“更难达成的规则优先”的本意。
            {
              patterns: ["Xiaomi [num]T Pro"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
            {
              patterns: ["Xiaomi [num]T"],
              window: 2,
              tier: "upper",
              perf: { mode: "fixed", level: "medium" },
              camera: "medium",
            },
            {
              patterns: ["Xiaomi [num][?...]"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
          ],
          excludes: ["Xiaomi [num] Fold"],
        },
      ],
    },
    {
      brand: "红米",
      series: "数字系列",
      sourceBrand: "红米",
      sourceSeries: "红米 / REDMI 数字系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["REDMI [num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "红米",
      series: "Note系列",
      sourceBrand: "红米",
      sourceSeries: "红米 / REDMI Note 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["REDMI Note [num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "红米",
      series: "Turbo系列",
      sourceBrand: "红米",
      sourceSeries: "REDMI Turbo 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["REDMI Turbo [num][?...]"],
              window: 2,
              tier: "mid",
              perf: { mode: "fixed", level: "medium" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "红米",
      series: "K系列",
      sourceBrand: "红米",
      sourceSeries: "REDMI K 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["REDMI K[num] Pro[?...]"],
              window: 2,
              tier: "upper",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "low",
            },
            {
              patterns: ["REDMI K[num][?...]"],
              window: 2,
              tier: "mid",
              perf: { mode: "fixed", level: "medium" },
              camera: "low",
            },
          ],
        },
      ],
    },

    {
      brand: "OPPO",
      series: "Find X系列",
      sourceBrand: "OPPO",
      sourceSeries: "Find X 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["OPPO Find X[num] Ultra"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "high",
            },
            {
              patterns: ["OPPO Find X[num][?...]"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "OPPO",
      series: "Reno系列",
      sourceBrand: "OPPO",
      sourceSeries: "Reno 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["OPPO Reno[num][?...]"],
              window: 2,
              tier: "upper",
              noTierDecay: true,
              perf: { mode: "fixed", level: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "OPPO",
      series: "K系列",
      sourceBrand: "OPPO",
      sourceSeries: "K 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["OPPO K[num] Pro[?...]", "OPPO K[num] Turbo[?...]"],
              window: 2,
              tier: "mid",
              perf: { mode: "fixed", level: "medium" },
              camera: "low",
            },
            {
              patterns: ["OPPO K[num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "OPPO",
      series: "A系列",
      sourceBrand: "OPPO",
      sourceSeries: "A 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["OPPO A[num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },

    {
      brand: "一加",
      series: "数字系列",
      sourceBrand: "一加",
      sourceSeries: "一加手机",
      groups: [
        {
          id: "number",
          rules: [
            {
              patterns: ["一加 [num][?...]"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "一加",
      series: "Ace系列",
      sourceBrand: "一加",
      sourceSeries: "一加手机",
      groups: [
        {
          id: "ace",
          rules: [
            {
              patterns: ["一加 Ace [num] Pro"],
              window: 2,
              tier: "upper",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "low",
            },
            {
              patterns: ["一加 Ace [num][?...]"],
              window: 2,
              tier: "mid",
              perf: { mode: "fixed", level: "medium" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "一加",
      series: "Turbo系列",
      sourceBrand: "一加",
      sourceSeries: "一加手机",
      groups: [
        {
          id: "turbo",
          rules: [
            {
              patterns: ["一加 Turbo [num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },

    {
      brand: "vivo",
      series: "X系列",
      sourceBrand: "vivo",
      sourceSeries: "vivo X 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["vivo X[num] Ultra"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "high",
            },
            {
              patterns: ["vivo X[num][?...]"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "vivo",
      series: "S系列",
      sourceBrand: "vivo",
      sourceSeries: "vivo S 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["vivo S[num][?...]"],
              window: 2,
              tier: "upper",
              noTierDecay: true,
              perf: { mode: "fixed", level: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "vivo",
      series: "Y系列",
      sourceBrand: "vivo",
      sourceSeries: "vivo Y 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["vivo Y[num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "iQOO",
      series: "数字系列",
      sourceBrand: "iQOO",
      sourceSeries: "iQOO 旗舰系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["iQOO [num] Ultra"],
              window: 3,
              tier: "flagship",
              perf: { mode: "fixed", level: "high" },
              camera: "medium",
            },
            {
              patterns: ["iQOO [num][?...]"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "iQOO",
      series: "Neo系列",
      sourceBrand: "iQOO",
      sourceSeries: "iQOO Neo 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["iQOO Neo[num] Pro"],
              window: 2,
              tier: "upper",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "low",
            },
            {
              patterns: ["iQOO Neo[num][?...]"],
              window: 2,
              tier: "mid",
              perf: { mode: "fixed", level: "medium" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "iQOO",
      series: "Z系列",
      sourceBrand: "iQOO",
      sourceSeries: "iQOO Z 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              // 文档此处写作 `iQOOz[num]`（无空格）；上游实际命名是 `iQOO Z11`，
              // 因此按本意补成 `iQOO Z[num]`，否则当前代普通版会被整体丢弃。
              patterns: ["iQOO Z[num] Turbo[?...]", "iQOO Z[num]"],
              window: 2,
              tier: "mid",
              perf: { mode: "fixed", level: "medium" },
              camera: "low",
            },
            {
              patterns: ["iQOO Z[num][...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },

    {
      brand: "荣耀",
      series: "Magic系列",
      sourceBrand: "荣耀",
      sourceSeries: "荣耀 Magic 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["荣耀 Magic[num][?...]"],
              window: 3,
              tier: "flagship",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "荣耀",
      series: "数字系列",
      sourceBrand: "荣耀",
      sourceSeries: "荣耀数字系列 (HONOR 系列 / N 系列)",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["荣耀 [num][?...]"],
              window: 2,
              tier: "upper",
              noTierDecay: true,
              perf: { mode: "fixed", level: "medium" },
              camera: "medium",
            },
          ],
        },
      ],
    },
    {
      brand: "荣耀",
      series: "WIN系列",
      sourceBrand: "荣耀",
      sourceSeries: "荣耀 WIN 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["荣耀 WIN [...][?num]"],
              window: 2,
              tier: "mid",
              perf: { mode: "fixed", level: "medium" },
              camera: "low",
            },
            {
              patterns: ["荣耀 WIN[?num]"],
              window: 2,
              tier: "upper",
              perf: { mode: "gen", current: "high", older: "medium" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "荣耀",
      series: "Power系列",
      sourceBrand: "荣耀",
      sourceSeries: "荣耀 Power 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["荣耀 Power[?num]"],
              window: 2,
              tier: "mid",
              perf: { mode: "fixed", level: "medium" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "荣耀",
      series: "X系列",
      sourceBrand: "荣耀",
      sourceSeries: "荣耀 X 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["荣耀 X[num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },
    {
      brand: "荣耀",
      series: "Play系列",
      sourceBrand: "荣耀",
      sourceSeries: "荣耀 Play 系列",
      groups: [
        {
          id: "main",
          rules: [
            {
              patterns: ["荣耀 Play[num][?...]"],
              window: 1,
              tier: "entry",
              perf: { mode: "fixed", level: "low" },
              camera: "low",
            },
          ],
        },
      ],
    },
  ],
};
