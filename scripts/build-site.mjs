#!/usr/bin/env node
/**
 * 构建可部署到 GitHub Pages 的 _site/ 目录（白名单方式）
 *
 * 用法：node scripts/build-site.mjs
 *
 * 产物仅包含线上必需的静态资源，绝不包含上游机型库、脚本与文档。
 * 任何缺失的必需文件都会导致构建失败；产物超过 2 MB 也会失败。
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = path.join(ROOT, "_site");
const MAX_BYTES = 2 * 1024 * 1024;

const HTML_FILES = [
  "index.html",
  "needs.html",
  "lines.html",
  "compare.html",
  "soc.html",
  "final.html",
  "glossary.html",
];

const DATA_FILES = ["data/models.js", "data/model-status.js", "data/LICENSE-MobileModels.md"];
const ROOT_FILES = ["NOTICE", "LICENSE.txt"];
const OPTIONAL_ROOT_FILES = ["CNAME"];
const ASSETS_DIR = "assets";

const FORBIDDEN = [
  "MobileModels",
  ".git",
  "docs",
  "words.txt",
  "scripts",
  "build-models.mjs",
  "build-status.mjs",
  "test-recommend.mjs",
  "rules.js",
].map((name) => name.toLowerCase());

const errors = [];

function fail(message) {
  errors.push(message);
}

function requireFile(relPath, label) {
  const abs = path.join(ROOT, relPath);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    fail(`${label}不存在：${relPath}`);
    return false;
  }
  if (!stat.isFile()) {
    fail(`${label}不是文件：${relPath}`);
    return false;
  }
  return true;
}

function copyFile(relPath) {
  const src = path.join(ROOT, relPath);
  const dest = path.join(SITE, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(abs, base));
    } else if (entry.isFile()) {
      out.push(path.relative(base, abs).split(path.sep).join("/"));
    } else {
      fail(`不支持的条目类型：${path.relative(ROOT, abs)}`);
    }
  }
  return out;
}

function copyDir(relDir) {
  const src = path.join(ROOT, relDir);
  let stat;
  try {
    stat = fs.statSync(src);
  } catch {
    fail(`目录不存在：${relDir}`);
    return;
  }
  if (!stat.isDirectory()) {
    fail(`不是目录：${relDir}`);
    return;
  }
  const files = listFiles(src);
  if (files.length === 0) {
    fail(`目录为空：${relDir}`);
    return;
  }
  for (const rel of files) {
    copyFile(path.join(relDir, rel).split(path.sep).join("/"));
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function main() {
  // 先确认必需文件齐全，避免构建到一半才发现缺失
  for (const file of HTML_FILES) requireFile(file, "HTML 文件");
  for (const file of DATA_FILES) requireFile(file, "数据文件");
  for (const file of ROOT_FILES) requireFile(file, "根文件");

  const optionalRootFiles = OPTIONAL_ROOT_FILES.filter((file) => {
    const abs = path.join(ROOT, file);
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  });

  if (errors.length) {
    reportFailure();
    return;
  }

  fs.rmSync(SITE, { recursive: true, force: true });
  fs.mkdirSync(SITE, { recursive: true });

  for (const file of HTML_FILES) copyFile(file);
  copyDir(ASSETS_DIR);
  for (const file of DATA_FILES) copyFile(file);
  for (const file of ROOT_FILES) copyFile(file);
  for (const file of optionalRootFiles) copyFile(file);

  if (errors.length) {
    reportFailure();
    return;
  }

  const manifest = listFiles(SITE).sort((a, b) => a.localeCompare(b, "en"));
  let totalBytes = 0;

  for (const rel of manifest) {
    const abs = path.join(SITE, rel);
    const stat = fs.statSync(abs);
    totalBytes += stat.size;

    for (const segment of rel.split("/")) {
      if (FORBIDDEN.includes(segment.toLowerCase())) {
        fail(`_site 中出现禁止的文件/目录名：${segment}（${rel}）`);
      }
    }
  }

  if (fs.existsSync(path.join(SITE, ".nojekyll"))) {
    fail("_site 中不应包含 .nojekyll（GitHub Actions Pages 不需要）");
  }

  const width = manifest.reduce((max, rel) => Math.max(max, rel.length), 0);
  const lines = ["_site 文件清单："];
  for (const rel of manifest) {
    const size = fs.statSync(path.join(SITE, rel)).size;
    lines.push(`  ${rel.padEnd(width)}  ${String(size).padStart(9)} B`);
  }
  lines.push(`共 ${manifest.length} 个文件，总计 ${formatBytes(totalBytes)}（${totalBytes} 字节）`);

  if (totalBytes > MAX_BYTES) {
    fail(`_site 总大小 ${totalBytes} 字节超过上限 ${MAX_BYTES} 字节（2 MB）`);
  }

  process.stdout.write(lines.join("\n") + "\n");

  if (errors.length) {
    reportFailure();
    return;
  }

  process.exit(0);
}

function reportFailure() {
  process.stderr.write("构建 _site 失败：\n");
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.exit(1);
}

main();
