import { type PackageFile, type Platform } from "../types/packages";

export function filterPackageFilesForPlatform(files: readonly PackageFile[], platform: Platform): readonly PackageFile[] {
  if (platform === "codex") {
    return files;
  }
  return files.filter((file) => !isOpenAIYaml(file.relativePath));
}

function isOpenAIYaml(relativePath: string): boolean {
  const parts = relativePath.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1]?.toLowerCase() === "openai.yaml";
}
