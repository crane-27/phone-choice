#!/usr/bin/env node
/**
 * 静态资源缓存戳（content hash cache busting）
 *
 * 扫描仓库根目录下的 *.html，把本地 `src="path?v=old"` / `href="path?v=old"`
 * 中的 v 参数替换为文件内容 sha256 的前 10 位十六进制。
 *
 * 特性：
 *   - 仅处理带 v 查询参数的本地属性；外链、锚点、绝对路径一律跳过
 *   - 同一文件在多个页面中始终使用相同哈希
 *   - 内容未变化时不写文件；重复运行应无任何改动
 *
 * 用法：node scripts/stamp-assets.mjs
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const ATTR_RE = /(?<![-\w])(src|href)(\s*=\s*)(["'])([^"']*)\3/gi;

const errors = [];
const hashes = new Map(); // 相对路径 -> hash

function hashFile(relPath) {
  if (hashes.has(relPath)) return hashes.get(relPath);
  const abs = path.resolve(ROOT, relPath);
  const content = fs.readFileSync(abs);
  const normalized = content.toString("utf8").replace(/\r\n/g, "\n");
  const hash = crypto.createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 10);
  hashes.set(relPath, hash);
  return hash;
}

function splitQuery(value) {
  const hashIndex = value.indexOf("#");
  const beforeHash = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const hashPart = hashIndex === -1 ? "" : value.slice(hashIndex);

  const qIndex = beforeHash.indexOf("?");
  if (qIndex === -1) {
    return { pathPart: beforeHash, hasQuery: false, query: "", hashPart };
  }
  return {
    pathPart: beforeHash.slice(0, qIndex),
    hasQuery: true,
    query: beforeHash.slice(qIndex + 1),
    hashPart,
  };
}

/** 返回 null 表示无需处理，返回 { ok, value } 表示结果或错误。 */
function processValue(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return null; // 锚点
  if (trimmed.startsWith("/")) return null; // 根绝对路径
  if (/^(?:https?:|data:|mailto:|tel:|javascript:|ftp:|\/\/)/i.test(trimmed)) return null;
  if (EXTERNAL.test(trimmed)) return null;

  const { pathPart, hasQuery, query, hashPart } = splitQuery(trimmed);
  if (!hasQuery) return null; // 只处理带查询串的资源
  if (!pathPart) return null;
  if (pathPart.includes("${") || pathPart.includes("{{")) return null; // 模板占位
  if (pathPart.startsWith("/") || pathPart.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathPart) || pathPart.startsWith("//")) return null;

  const params = query.split("&");
  let vIndex = -1;
  let oldValue = null;
  for (let i = 0; i < params.length; i += 1) {
    const eq = params[i].indexOf("=");
    const key = eq === -1 ? params[i] : params[i].slice(0, eq);
    if (key === "v") {
      if (vIndex !== -1) {
        errors.push(`属性值含多个 v 参数：${value}`);
        return null;
      }
      vIndex = i;
      oldValue = eq === -1 ? "" : params[i].slice(eq + 1);
    }
  }
  if (vIndex === -1) return null; // 没有 v 参数，保持原样

  const abs = path.resolve(ROOT, pathPart);
  const relFromRoot = path.relative(ROOT, abs);
  if (relFromRoot.startsWith("..") || path.isAbsolute(relFromRoot)) {
    errors.push(`资源路径超出仓库范围：${pathPart}（在 ${value} 中）`);
    return null;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    errors.push(`资源文件不存在：${pathPart}（在 ${value} 中）`);
    return null;
  }

  const newHash = hashFile(relFromRoot.replace(/\\/g, "/"));
  if (newHash === oldValue) return null;

  const newParams = params.slice();
  newParams[vIndex] = `v=${newHash}`;
  return { oldValue, newValue: newHash, pathPart, value: `${pathPart}?${newParams.join("&")}${hashPart}` };
}

function processPage(page) {
  const abs = path.join(ROOT, page);
  const original = fs.readFileSync(abs, "utf8");
  const messages = [];
  let changes = 0;
  const html = original.replace(ATTR_RE, (full, attr, eqPart, quote, value) => {
    const result = processValue(value);
    if (!result) return full;
    changes += 1;
    messages.push(`${page}: ${result.pathPart} v=${result.oldValue} -> v=${result.newValue}`);
    return `${attr}${eqPart}${quote}${result.value}${quote}`;
  });
  return { page, html, original, changes, messages };
}

function main() {
  const pages = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => entry.name)
    .sort();

  if (pages.length === 0) {
    errors.push("根目录下未找到任何 HTML 文件");
  }

  const pending = [];
  for (const page of pages) {
    pending.push({ page, ...processPage(page) });
  }

  if (errors.length) {
    process.stderr.write("资源戳更新失败：\n");
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }

  let written = 0;
  let totalChanges = 0;
  for (const { page, html, original, changes, messages } of pending) {
    totalChanges += changes;
    for (const message of messages) process.stdout.write(`${message}\n`);
    if (html !== original) {
      fs.writeFileSync(path.join(ROOT, page), html, "utf8");
      written += 1;
    }
  }

  process.stdout.write(`完成：${pages.length} 个页面，${totalChanges} 处更新，写入 ${written} 个文件\n`);
}

main();
