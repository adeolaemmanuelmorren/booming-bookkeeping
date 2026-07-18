import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../..");
const clickfunnelsDir = path.join(repoRoot, "clickfunnels");
const sourceDir = path.join(clickfunnelsDir, "src");
const distDir = path.join(clickfunnelsDir, "dist");
const entryPath = path.join(sourceDir, "index.js");

const combinedOutputName = "combined.min.html";
const combinedScriptOutputName = "combined.min.js";

function loadEsbuild() {
  const searchPaths = [
    path.join(repoRoot, "node_modules"),
    path.join(clickfunnelsDir, "node_modules"),
    path.join(repoRoot, "cloudflare-workers/reverse-proxy/node_modules"),
    path.join(repoRoot, "cloudflare-workers/marketing-webhooks/node_modules"),
  ];

  try {
    const esbuildPath = require.resolve("esbuild", { paths: searchPaths });
    return require(esbuildPath);
  } catch (error) {
    throw new Error(
      "Could not find esbuild. Run `npm install --save-dev esbuild`, then run `npm run build:clickfunnels` again.",
    );
  }
}

function bundleEntry(esbuild) {
  const result = esbuild.buildSync({
    entryPoints: [entryPath],
    bundle: true,
    format: "iife",
    write: false,
    minifyWhitespace: true,
    minifyIdentifiers: false,
    minifySyntax: false,
    legalComments: "none",
  });

  return result.outputFiles[0].text.trim();
}

function writeScriptAsset(outputName, js) {
  const outputPath = path.join(distDir, outputName);

  fs.writeFileSync(outputPath, `${js}\n`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

function writeHtmlAsset(outputName, js) {
  const outputPath = path.join(distDir, outputName);
  const output = `<script>\n${js}\n</script>\n`;

  fs.writeFileSync(outputPath, output);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

function build() {
  const esbuild = loadEsbuild();
  const js = bundleEntry(esbuild);

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  writeScriptAsset(combinedScriptOutputName, js);
  writeHtmlAsset(combinedOutputName, js);
}

build();
