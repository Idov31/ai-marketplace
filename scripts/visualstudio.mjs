import { createHash } from "node:crypto";
import { copyFile, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import process from "node:process";
import { build as bundle } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const projectRoot = resolve(root, "packages/visualstudio-plugin/src/AIMarketplace.VisualStudio");
const project = resolve(projectRoot, "AIMarketplace.VisualStudio.csproj");
const solution = resolve(root, "packages/visualstudio-plugin/AIMarketplace.VisualStudio.sln");
const command = process.argv[2] ?? "build";

if (process.platform !== "win32") {
  process.stdout.write(`Skipping Visual Studio ${command}: Windows is required.\n`);
  process.exit(0);
}

if (command === "lint") {
  run("dotnet", ["build", project, "--nologo", "--configuration", "Release", "--no-restore", "-warnaserror", "/p:CreateVsixContainer=false"]);
} else if (command === "test") {
  run("dotnet", ["run", "--project", resolve(root, "packages/visualstudio-plugin/test/AIMarketplace.VisualStudio.Tests/AIMarketplace.VisualStudio.Tests.csproj"), "--configuration", "Release", "/p:CreateVsixContainer=false"]);
} else if (command === "build") {
  run("dotnet", ["build", solution, "--nologo", "--configuration", "Release"]);
} else if (command === "prepare") {
  await prepareRuntime(await visualStudioVersion());
  process.stdout.write("Prepared the pinned Visual Studio runtime payload.\n");
} else if (command === "package") {
  const version = await visualStudioVersion();
  await prepareRuntime(version);
  await mkdir(resolve(root, "dist"), { recursive: true });
  const target = resolve(root, `dist/ai-marketplace-visualstudio-${version}.vsix`);
  await Promise.all([
    rm(resolve(projectRoot, "obj/Release"), { recursive: true, force: true }),
    rm(target, { force: true })
  ]);
  run("dotnet", ["build", project, "--nologo", "--configuration", "Release", "--no-restore", `/p:VisualStudioDistPath=${target}`]);
  await requireFile(target, "The Visual Studio build did not produce an installable VSIX.");
  const generatedManifest = await readFile(resolve(projectRoot, "obj/Release/extension.vsixmanifest"), "utf8");
  const generatedVersion = /<Identity\b[^>]*\bVersion="([^"]+)"/.exec(generatedManifest)?.[1];
  if (generatedVersion !== version) {
    await rm(target, { force: true });
    throw new Error(`Generated VSIX identity version '${generatedVersion}' does not match package version '${version}'.`);
  }
  process.stdout.write(`Created ${target}\n`);
} else {
  throw new Error(`Unknown Visual Studio command '${command}'.`);
}

async function visualStudioVersion() {
  const packageVersion = JSON.parse(await readFile(resolve(root, "packages/visualstudio-plugin/package.json"), "utf8")).version;
  const manifest = await readFile(resolve(projectRoot, "source.extension.vsixmanifest"), "utf8");
  const identityVersion = /<Identity\b[^>]*\bVersion="([^"]+)"/.exec(manifest)?.[1];
  if (!identityVersion || identityVersion !== packageVersion) {
    throw new Error(`Visual Studio package version '${packageVersion}' does not match VSIX identity version '${identityVersion}'.`);
  }
  return identityVersion;
}

async function prepareRuntime(version) {
  const runtimeRoot = resolve(projectRoot, "Runtime");
  const sidecarRoot = resolve(projectRoot, "Sidecar");
  const dashboardRoot = resolve(projectRoot, "Dashboard");
  await Promise.all([rm(runtimeRoot, { recursive: true, force: true }), rm(sidecarRoot, { recursive: true, force: true }), rm(dashboardRoot, { recursive: true, force: true })]);
  const configuredRoot = process.env.AI_MARKETPLACE_NODE_RUNTIME_ROOT
    ? resolve(process.env.AI_MARKETPLACE_NODE_RUNTIME_ROOT)
    : resolve(root, ".project/runtime-cache");
  const runtimes = [
    ["win-x64", resolve(configuredRoot, "node-v22.23.2-win-x64/node.exe"), "0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4"],
    ["win-arm64", resolve(configuredRoot, "node-v22.23.2-win-arm64/node.exe"), "97cce5301a815d2dce07ac5bfd1e6039eae88185ec1d10ae4f8cb712f1732878"]
  ];
  for (const [architecture, source, expected] of runtimes) {
    await requireFile(source, "Set AI_MARKETPLACE_NODE_RUNTIME_ROOT to a directory containing the pinned Node 22.23.2 runtime folders.");
    const actual = await sha256(source);
    if (actual !== expected) throw new Error(`Pinned Node.js 22.23.2 ${architecture} executable checksum mismatch.`);
  }
  await mkdir(sidecarRoot, { recursive: true });
  await bundle({
    entryPoints: [resolve(root, "plugins/ai-marketplace/src/main.ts")],
    outfile: resolve(sidecarRoot, "ai-marketplace.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    sourcemap: false,
    legalComments: "none"
  });
  for (const [architecture, source] of runtimes) {
    const target = resolve(runtimeRoot, architecture, "node.exe");
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  await cp(resolve(root, "plugins/ai-marketplace/dashboard"), dashboardRoot, { recursive: true });
  const files = [
    "Runtime/win-x64/node.exe",
    "Runtime/win-arm64/node.exe",
    "Sidecar/ai-marketplace.cjs",
    "Dashboard/index.html",
    "Dashboard/app.js",
    "Dashboard/styles.css"
  ];
  const entries = [];
  for (const relative of files) entries.push({ path: relative, sha256: await sha256(resolve(projectRoot, relative)) });
  await writeFile(resolve(projectRoot, "runtime-manifest.json"), JSON.stringify({ schemaVersion: 1, nodeVersion: "22.23.2", files: entries }, null, 2) + "\n");
  await writeFile(resolve(projectRoot, "runtime-sbom.json"), JSON.stringify({ schemaVersion: 1, components: [
    { name: "Node.js", version: "22.23.2", license: "MIT", source: "https://nodejs.org/download/release/v22.23.2/" },
    { name: "AI Marketplace sidecar", version, license: "GPL-3.0-only" },
    { name: "Microsoft.Web.WebView2", version: "1.0.4191.47", license: "Microsoft Software License Terms" }
  ] }, null, 2) + "\n");
}

async function sha256(path) { return createHash("sha256").update(await readFile(path)).digest("hex"); }
async function requireFile(path, hint) { if (!(await stat(path).catch(() => undefined))?.isFile()) throw new Error(`Required runtime file is missing: ${path}. ${hint}`); }
function run(file, args) {
  const result = spawnSync(file, args, { cwd: root, env: process.env, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${basename(file)} exited with code ${result.status}.`);
}
