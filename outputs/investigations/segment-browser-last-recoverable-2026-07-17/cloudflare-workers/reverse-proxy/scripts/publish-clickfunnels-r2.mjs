import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(currentDir, "..");
const repoRoot = path.resolve(workerDir, "../..");
const distDir = path.join(repoRoot, "clickfunnels", "dist");
const wranglerConfigPath = path.join(workerDir, "wrangler.jsonc");

const defaultFiles = ["combined.min.js"];
const defaultObjectKeys = new Map([
  ["combined.min.js", "cf-sh-seg"],
  ["combined.min.html", "cf-sh-seg-html"],
]);
const allFiles = ["combined.min.js", "combined.min.html"];
const stableCacheControl = "public, max-age=300";
const versionedCacheControl = "public, max-age=31536000, immutable";
const defaultBucketName = "assets";
const defaultPrefix = "";
const defaultPublicUrl = "https://assets.thebookkeepingchallenge.com";

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));

  if (match) {
    return match.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index < 0) {
    return "";
  }

  return process.argv[index + 1] || "";
}

function hasArg(name) {
  return process.argv.includes(name);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || workerDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status === 0) {
    return;
  }

  process.exit(result.status || 1);
}

function getBucketName() {
  return getArgValue("--bucket") || defaultBucketName;
}

function getPrefix() {
  const prefix = getArgValue("--prefix") || defaultPrefix;
  return prefix.replace(/^\/+|\/+$/g, "");
}

function getFilesToPublish() {
  const file = getArgValue("--file");

  if (file) {
    return [file];
  }

  if (hasArg("--all")) {
    return allFiles;
  }

  return defaultFiles;
}

function getCacheControl() {
  const configuredCacheControl = getArgValue("--cache-control");

  if (configuredCacheControl) {
    return configuredCacheControl;
  }

  if (shouldPublishVersionedFiles()) {
    return versionedCacheControl;
  }

  return stableCacheControl;
}

function getContentType(filename) {
  if (filename.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }

  if (filename.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  return "application/octet-stream";
}

function getObjectKey(prefix, filename) {
  if (!prefix) {
    return filename;
  }

  return `${prefix}/${filename}`;
}

function getBaseObjectKey(filename) {
  return getArgValue("--key") || defaultObjectKeys.get(filename) || filename;
}

function getPublicUrl() {
  const publicUrl = getArgValue("--public-url") || defaultPublicUrl;
  return publicUrl.replace(/\/+$/g, "");
}

function shouldDryRun() {
  return hasArg("--dry-run");
}

function shouldPublishLocal() {
  return hasArg("--local");
}

function shouldPublishVersionedFiles() {
  return hasArg("--versioned") || Boolean(getRequestedVersion());
}

function getRequestedVersion() {
  return getArgValue("--version");
}

function getVersionForFile(filePath) {
  const requestedVersion = getRequestedVersion();

  if (requestedVersion) {
    return sanitizeVersion(requestedVersion);
  }

  return getContentHash(filePath);
}

function getContentHash(filePath) {
  const file = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(file).digest("hex").slice(0, 12);
}

function sanitizeVersion(version) {
  const safeVersion = version.trim().replace(/[^a-zA-Z0-9._-]/g, "-");

  if (safeVersion) {
    return safeVersion;
  }

  throw new Error("Version must contain at least one URL-safe character.");
}

function getVersionedObjectKey(objectKey, version) {
  const minifiedMatch = objectKey.match(/^(.*)\.min(\.[^.]+)$/);

  if (minifiedMatch) {
    return `${minifiedMatch[1]}.${version}.min${minifiedMatch[2]}`;
  }

  const extension = path.extname(objectKey);

  if (!extension) {
    return `${objectKey}.${version}`;
  }

  const basename = objectKey.slice(0, -extension.length);

  return `${basename}.${version}${extension}`;
}

function getPublishedObjectKey(filename, filePath) {
  const objectKey = getBaseObjectKey(filename);

  if (!shouldPublishVersionedFiles()) {
    return objectKey;
  }

  return getVersionedObjectKey(objectKey, getVersionForFile(filePath));
}

function assertFileExists(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }

  throw new Error(`Missing built ClickFunnels file: ${filePath}`);
}

function publishFile(bucket, prefix, filename, cacheControl, dryRun) {
  const filePath = path.join(distDir, filename);
  const storageLocationArg = shouldPublishLocal() ? "--local" : "--remote";

  assertFileExists(filePath);

  const publishedObjectKey = getPublishedObjectKey(filename, filePath);
  const objectKey = getObjectKey(prefix, publishedObjectKey);
  const args = [
    "wrangler",
    "r2",
    "object",
    "put",
    `${bucket}/${objectKey}`,
    "--config",
    wranglerConfigPath,
    "--file",
    filePath,
    "--content-type",
    getContentType(filename),
    "--cache-control",
    cacheControl,
    storageLocationArg,
  ];

  if (dryRun) {
    console.log(`Would publish ${filename} -> ${bucket}/${objectKey} (${storageLocationArg})`);
    return { filename, objectKey };
  }

  run("npx", args);
  return { filename, objectKey };
}

function printPublishedUrls(publishedFiles, publicUrl) {
  if (!publicUrl) {
    return;
  }

  for (const file of publishedFiles) {
    const url = `${publicUrl}/${file.objectKey}`;

    if (file.filename.endsWith(".js")) {
      console.log(`<script src="${url}"></script>`);
      continue;
    }

    console.log(url);
  }
}

function main() {
  const bucket = getBucketName();
  const prefix = getPrefix();
  const files = getFilesToPublish();
  const cacheControl = getCacheControl();
  const publicUrl = getPublicUrl();
  const dryRun = shouldDryRun();
  const publishedFiles = [];

  run("node", [path.join(repoRoot, "clickfunnels", "scripts", "build-snippets.mjs")], {
    cwd: repoRoot,
  });

  for (const file of files) {
    publishedFiles.push(publishFile(bucket, prefix, file, cacheControl, dryRun));
  }

  printPublishedUrls(publishedFiles, publicUrl);
}

main();
