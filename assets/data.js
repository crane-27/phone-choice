/* 产品线与需求分组的共享数据。原文内容，仅做结构化。 */
window.GUIDE = (function () {
  const NEEDS = [
    {
      id: "none",
      short: "无性能 / 影像需求",
      title: "无性能、影像需求",
      desc: "通常使用低端 SoC 和素质较差的摄像头，适合轻度使用或作为备用机。",
    },
    {
      id: "perf",
      short: "一定性能 / 无影像",
      title: "一定性能需求，无影像需求",
      desc: "当代中高端 SoC 或上代旗舰 SoC，摄像头依然一般。",
    },
    {
      id: "camera",
      short: "一定性能 / 基本影像",
      title: "一定性能需求，基本影像表现",
      desc: "影像表现更好，但性能和一般中端机接近甚至更差。",
    },
    {
      id: "highperf",
      short: "较高性能 / 无影像",
      title: "较高性能需求，无影像需求",
      desc: "当代旗舰 SoC 和稍好的摄像头，但大多数不提供理想的影像能力。",
    },
    {
      id: "flagship",
      short: "较高性能 / 基本影像",
      title: "较高性能需求，基本影像表现",
      desc: "大多数享有“旗舰”的名字，性能与影像相对均衡。",
    },
    {
      id: "cameraflag",
      short: "较高性能 / 较高影像",
      title: "较高性能需求，较高影像需求",
      desc: "真正的影像旗舰。",
    },
    {
      id: "rich",
      short: "预算无上限",
      title: "I'm rich",
      desc: "有独特卖点（如折叠屏），价格通常在万元水平或更高。",
    },
  ];

  const TIERS = [
    {
      id: "entry",
      name: "入门级",
      range: "2000 元以内",
      advice: "最好不超过 1500 元",
      desc: "几乎什么也干不了，适合几乎不用手机的人群，或作为备用机。",
    },
    {
      id: "mid",
      name: "中端机",
      range: "2000–3500 元",
      advice: "最好不超过 3000 元",
      desc: "通常以性能为重，大多不适合拍照，但可以游玩大部分中等负载手游。",
    },
    {
      id: "upper",
      name: "中高端机",
      range: "3000–5000 元",
      advice: "最好不超过 4000 元",
      desc: "在性能与影像中选一个偏好，很难二者兼得。",
    },
    {
      id: "flagship",
      name: "旗舰",
      range: "4000–8000 元",
      advice: "最好不超过 7000 元",
      desc: "通常具有较强的性能和影像能力，但价格更高。",
    },
    {
      id: "ultra",
      name: "超旗舰",
      range: "万元水平或更高",
      advice: "适合不在乎预算的购机者",
      desc: "往往有独特的卖点，如折叠屏。",
    },
  ];

  /* needs: 需求分组；tiers: 预算档位；limit: 原文中的限定条件 */
  const LINES = [
    // 无性能、影像需求
    { brand: "华为", name: "畅享系列", example: "华为畅享 90 Pro Max", needs: ["none"], tiers: ["entry"] },
    { brand: "红米", name: "数字系列", example: "红米 17C", needs: ["none"], tiers: ["entry"] },
    { brand: "红米", name: "Note 系列", example: "红米 Note 16 Pro", needs: ["none"], tiers: ["entry"] },
    { brand: "OPPO", name: "A 系列", example: "OPPO A6 Pro", needs: ["none"], tiers: ["entry"] },
    { brand: "OPPO", name: "K 系列", example: "OPPO K15x", needs: ["none"], tiers: ["entry"], limit: "不含 Pro 后缀" },
    { brand: "一加", name: "Turbo 系列", example: "一加 Turbo 6x", needs: ["none"], tiers: ["entry"] },
    { brand: "vivo", name: "Y 系列", example: "vivo Y300 Pro", needs: ["none"], tiers: ["entry"] },
    { brand: "iQOO", name: "Z 系列", example: "iQOO Z11x", needs: ["none"], tiers: ["entry"], limit: "不含 Turbo 后缀" },
    { brand: "荣耀", name: "畅玩系列", example: "荣耀畅玩 70C", needs: ["none"], tiers: ["entry"] },
    { brand: "荣耀", name: "Play 系列", example: "荣耀 Play 11", needs: ["none"], tiers: ["entry"] },

    // 一定性能，无影像
    { brand: "红米", name: "Turbo 系列", example: "红米 Turbo 5 Max", needs: ["perf"], tiers: ["mid"] },
    { brand: "红米", name: "K 系列", example: "红米 K90 Max", needs: ["perf"], tiers: ["mid"], limit: "不含 Pro 后缀" },
    { brand: "OPPO", name: "K 系列", example: "OPPO K15 Pro", needs: ["perf"], tiers: ["mid"], limit: "仅 Pro 后缀型号" },
    { brand: "一加", name: "Ace 系列", example: "一加 Ace6", needs: ["perf"], tiers: ["mid"], limit: "非 Pro 型号（原文括注：不包括一加 Ace6）" },
    { brand: "iQOO", name: "Neo 系列", example: "iQOO Neo 11", needs: ["perf"], tiers: ["mid"], limit: "不含 Pro 后缀" },
    { brand: "荣耀", name: "Power 系列", example: "荣耀 Power2", needs: ["perf"], tiers: ["mid"] },
    { brand: "荣耀", name: "WIN 系列", example: "荣耀 WIN RT", needs: ["perf"], tiers: ["mid"], limit: "仅带尾缀的版本" },

    // 一定性能，基本影像
    { brand: "华为", name: "Nova 系列", example: "华为 Nova16 Pro", needs: ["camera"], tiers: ["upper"] },
    { brand: "华为", name: "Pura 系列", example: "华为 Pura 90 Pro", needs: ["camera"], tiers: ["flagship"] },
    { brand: "华为", name: "Mate 系列", example: "华为 Mate90", needs: ["camera"], tiers: ["flagship"], limit: "不含 ProMax 和非凡大师" },
    { brand: "小米", name: "civi 系列", example: "小米 civi 5 Pro", needs: ["camera"], tiers: ["upper"], limit: "已停更" },
    { brand: "OPPO", name: "Reno 系列", example: "OPPO Reno 16", needs: ["camera"], tiers: ["upper"] },
    { brand: "vivo", name: "S 系列", example: "vivo S50 Pro mini", needs: ["camera"], tiers: ["upper"] },
    { brand: "荣耀", name: "数字系列", example: "荣耀 500 Pro", needs: ["camera"], tiers: ["upper"] },

    // 较高性能，无影像
    { brand: "红米", name: "K 系列", example: "红米 K90 Pro Max", needs: ["highperf"], tiers: ["upper"], limit: "Pro 及以上型号" },
    { brand: "iQOO", name: "Neo 系列", example: "iQOO Neo 10 Pro", needs: ["highperf"], tiers: ["upper"], limit: "Pro 及以上型号" },
    { brand: "一加", name: "Ace 系列", example: "一加 Ace5 Pro", needs: ["highperf"], tiers: ["upper"], limit: "Pro 及以上型号" },
    { brand: "荣耀", name: "WIN", example: "荣耀 WIN", needs: ["highperf"], tiers: ["upper"], limit: "无后缀版本" },

    // 较高性能，基本影像
    { brand: "苹果", name: "iPhone 系列", example: "iPhone 17", needs: ["flagship"], tiers: ["flagship"], limit: "仅标准版" },
    { brand: "小米", name: "数字系列", example: "小米 18 Pro", needs: ["flagship"], tiers: ["flagship"], limit: "不含 Ultra" },
    { brand: "OPPO", name: "Find X 系列", example: "OPPO Find X10 Pro Max", needs: ["flagship"], tiers: ["flagship"], limit: "不含 Ultra" },
    { brand: "vivo", name: "X 系列", example: "vivo X500 Pro", needs: ["flagship"], tiers: ["flagship"], limit: "不含 Ultra" },
    { brand: "荣耀", name: "Magic 系列", example: "荣耀 Magic 9 Pro", needs: ["flagship"], tiers: ["flagship"] },

    // 较高性能，较高影像
    { brand: "苹果", name: "iPhone 系列", example: "iPhone 18 Pro Max", needs: ["cameraflag"], tiers: ["flagship"], limit: "Pro 及以上" },
    { brand: "华为", name: "Mate 系列", example: "华为 Mate90 ProMax", needs: ["cameraflag"], tiers: ["flagship"], limit: "ProMax / RS，性能相对受限" },
    { brand: "小米", name: "数字系列", example: "小米 17 Ultra", needs: ["cameraflag"], tiers: ["flagship"], limit: "Ultra 型号" },
    { brand: "OPPO", name: "Find X 系列", example: "OPPO Find X9 Ultra", needs: ["cameraflag"], tiers: ["flagship"], limit: "Ultra 型号" },
    { brand: "vivo", name: "X 系列", example: "vivo X300 Ultra", needs: ["cameraflag"], tiers: ["flagship"], limit: "Ultra 型号" },

    // I'm rich
    { brand: "苹果", name: "iPhone Duo", example: "iPhone Duo", needs: ["rich"], tiers: ["ultra"] },
    { brand: "华为", name: "MateX 系列", example: "华为 Mate X7", needs: ["rich"], tiers: ["ultra"] },
    { brand: "华为", name: "MateXT 系列", example: "华为 Mate XT2", needs: ["rich"], tiers: ["ultra"] },
  ];

  const BRANDS = Array.from(new Set(LINES.map((l) => l.brand)));

  return { NEEDS, TIERS, LINES, BRANDS };
})();
