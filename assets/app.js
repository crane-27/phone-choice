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
          <span class="footer-license">
            机型数据来自
            <a href="https://github.com/KHwang9883/MobileModels" target="_blank" rel="noopener">KHwang9883/MobileModels</a>，
            按 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>
            使用（已提取、筛选与重组）。
            <button class="footer-license-btn" type="button" data-open-license>修改说明</button>
          </span>
        </div>`;
    }

    if (!document.getElementById("license-dialog")) {
      const dialog = document.createElement("dialog");
      dialog.id = "license-dialog";
      dialog.className = "license-dialog";
      dialog.setAttribute("aria-labelledby", "license-title");
      dialog.innerHTML = `
        <div class="license-head">
          <h2 id="license-title">数据来源与修改说明</h2>
          <button class="license-close" type="button" data-close-license aria-label="关闭">×</button>
        </div>
        <div class="license-body">
          <p>
            本站“机型名录”部分使用
            <a href="https://github.com/KHwang9883/MobileModels" target="_blank" rel="noopener">KHwang9883/MobileModels</a>
            的数据，该数据以
            <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>
            许可发布。
          </p>
          <h3>对原始数据的修改</h3>
          <ul>
            <li>仅提取 apple_cn、huawei_cn、xiaomi_cn、oppo_cn、oneplus、vivo_cn、honor_cn 七个文件中的 27 个源系列；</li>
            <li>不合并海外版本；</li>
            <li>移除型号码、主板代号与别名，仅保留品牌 / 系列 / 机型名；</li>
            <li>同一系列内按机型名去重，生成 <code>data/models.js</code>；</li>
            <li>按自定义规则推导定位、性能、影像，生成 <code>data/model-status.js</code>；</li>
            <li>推荐页对上述衍生数据做筛选、分组与展示。</li>
          </ul>
          <h3>许可范围</h3>
          <ul>
            <li>由上游数据生成的 <code>data/models.js</code>、<code>data/model-status.js</code> 及 <code>data/</code> 下的相关衍生数据，继续以 CC BY-NC-SA 4.0 发布；</li>
            <li>本站其余代码以 MIT 许可发布；</li>
            <li>本站为非商业个人项目，与上游作者无隶属关系；</li>
            <li>使用或分发衍生数据时，请保留署名、注明修改，并遵守相同方式共享。</li>
          </ul>
          <p class="small muted">
            完整说明见
            <a href="data/LICENSE-MobileModels.md" target="_blank" rel="noopener">data/LICENSE-MobileModels.md</a>。
          </p>
        </div>`;
      dialog.addEventListener("click", function (e) {
        if (e.target !== dialog) return;
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      });
      document.body.appendChild(dialog);
    }
  }

  document.addEventListener("click", function (e) {
    const opener = e.target.closest("[data-open-license]");
    if (opener) {
      e.preventDefault();
      const dialog = document.getElementById("license-dialog");
      if (dialog) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      return;
    }

    const closer = e.target.closest("[data-close-license]");
    if (closer) {
      const dialog = closer.closest("dialog");
      if (dialog) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
    }
  });

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
