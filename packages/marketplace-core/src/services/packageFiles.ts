import { type PackageFile, type Platform } from "../types/packages";

export function filterPackageFilesForPlatform(files: readonly PackageFile[], platform: Platform): readonly PackageFile[] {
  const isHarnessBundle = files.some((file) => file.relativePath === "package.json" && declaresHarnessBundle(file.content));
  return files.filter((file) => (platform === "codex" || !isOpenAIYaml(file.relativePath))
    && !(platform !== "deepseek-harness" && isHarnessBundle && isHarnessOnlyFile(file.relativePath)));
}

function declaresHarnessBundle(content: Uint8Array): boolean {
  try {
    const value: unknown = JSON.parse(Buffer.from(content).toString("utf8"));
    return typeof value === "object" && value !== null && "dsh" in value
      && typeof value.dsh === "object" && value.dsh !== null && "bundle" in value.dsh;
  } catch { return false; }
}

function isHarnessOnlyFile(relativePath: string): boolean {
  const path = relativePath.replaceAll("\\", "/");
  return path === "package.json" || path === "cordis.patch.yml" || path === "index.js"
    || path === "agent.js" || path === "instructions.md" || path.startsWith("presets/");
}

function isOpenAIYaml(relativePath: string): boolean {
  const parts = relativePath.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1]?.toLowerCase() === "openai.yaml";
}
