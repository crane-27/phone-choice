/* 共享脚本：导航注入、存储与若干小工具 */
(function () {
  const NAV = [
    { key: "home", href: "index.html", label: "首页" },
    { key: "needs", href: "needs.html", label: "需求诊断" },
    { key: "lines", href: "lines.html", label: "产品线" },
    { key: "compare", href: "compare.html", label: "对比台" },
    { key: "soc", href: "soc.html", label: "SoC 梯队" },
    { key: "final", href: "final.html", label: "决定与验机" },
    { key: "glossary", href: "glossary.html", label: "名词表" },
  ];

  function mountChrome() {
    const active = document.body.dataset.page || "";
    const header = document.getElementById("site-header");
    if (header) {
      header.className = "site-header";
      header.innerHTML = `
        <div class="wrap header-inner">
          <a class="brand-mark" href="index.html">
            <span class="brand-dot" aria-hidden="true"></span>
            <span class="brand-text">手机选购指南</span>
          </a>
          <nav class="nav" aria-label="主导航">
            ${NAV.map(
              (n) =>
                `<a href="${n.href}"${
                  n.key === active ? ' aria-current="page"' : ""
                }>${n.label}</a>`
            ).join("")}
          </nav>
        </div>`;
    }

    const footer = document.getElementById("site-footer");
    if (footer) {
      footer.className = "site-footer";
      footer.innerHTML = `
        <div class="wrap footer-inner">
          <span>个人向手机选购指南 · 内容以原文为准</span>
          <span>示例机型仅用于说明产品线，价格与型号请以官方渠道为准</span>
          <span>最后整理：2026-10</span>
        </div>`;
    }
  }

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* 隐私模式下忽略 */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    },
  };

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  window.App = { store, param, esc, debounce, NAV };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChrome);
  } else {
    mountChrome();
  }
})();
