import * as path from "path";
import { type PackageType, type Platform, type PlatformPathOverrides } from "../types/packages";

export class PathSafetyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PathSafetyError";
  }
}

const defaultInstallRoots: Readonly<Record<Platform, Readonly<Record<PackageType, string>>>> = {
  codex: {
    skill: ".codex/skills",
    command: ".codex/commands",
    mcp: ".codex/mcps",
    agent: ".codex/agents",
    hook: ".codex/hooks",
    rule: ".codex/rules"
  },
  cursor: {
    skill: ".cursor/skills",
    command: ".cursor/commands",
    mcp: ".cursor/mcps",
    agent: ".cursor/agents",
    hook: ".cursor/hooks",
    rule: ".cursor/rules"
  },
  "github-copilot": {
    skill: ".github/skills",
    command: ".github/commands",
    mcp: ".github/mcps",
    agent: ".github/agents",
    hook: ".github/hooks",
    rule: ".github/rules"
  },
  claude: {
    skill: ".claude/skills",
    command: ".claude/commands",
    mcp: ".claude/mcps",
    agent: ".claude/agents",
    hook: ".claude/hooks",
    rule: ".claude/rules"
  }
};

export function installRelativePath(
  platform: Platform,
  packageType: PackageType,
  packageId: string,
  overrides: PlatformPathOverrides
): string {
  const base = safeJoinRelative(installRootRelativePath(platform, packageType, overrides), packageId);
  return platform === "claude" && isClaudeFlatFileType(packageType) ? `${base}.md` : base;
}

function isClaudeFlatFileType(packageType: PackageType): boolean {
  return packageType === "command" || packageType === "agent" || packageType === "rule";
}

export function installRootRelativePath(
  platform: Platform,
  packageType: PackageType,
  overrides: PlatformPathOverrides
): string {
  const overrideRoot = overrides[platform]?.[packageType];
  return safeJoinRelative(overrideRoot && overrideRoot.trim().length > 0 ? overrideRoot : defaultInstallRoots[platform][packageType]);
}

/** Codex discovers custom agents only from top-level TOML files in its agents directory. */
export function codexAgentConfigRelativePath(packageId: string, overrides: PlatformPathOverrides): string {
  return `${safeJoinRelative(installRootRelativePath("codex", "agent", overrides), packageId)}.toml`;
}

export function offloadRelativePath(platform: Platform, packageType: PackageType, packageId: string): string {
  return safeJoinRelative(offloadRootRelativePath(platform, packageType), packageId);
}

export function offloadRootRelativePath(platform: Platform, packageType: PackageType): string {
  return safeJoinRelative(".offload", platform, pluralizePackageType(packageType));
}

export function cloudInstallPath(platform: Platform, packageType: PackageType, packageId: string): string {
  return safeJoinRelative("cloud", platform, pluralizePackageType(packageType), packageId);
}

export function stateRelativePath(): string {
  return ".ai_marketplace/installed.json";
}

export function mcpPayloadRelativePath(platform: Platform, sourceId: string, packageId: string): string {
  return safeJoinRelative(".ai_marketplace", "mcp-packages", platform, sourceId, packageId);
}

export function legacyStateRelativePath(): string {
  return ".ai-marketplace/installed.json";
}

export function safeJoinRelative(...segments: readonly string[]): string {
  const raw = segments.join("/");
  const slashNormalized = raw.replaceAll("\\", "/");
  if (slashNormalized.startsWith("/") || /^[a-zA-Z]:/.test(slashNormalized)) {
    throw new PathSafetyError(`Unsafe relative path '${raw}'.`);
  }
  const cleaned = slashNormalized.replace(/\/+$/, "");
  if (cleaned.split("/").some((part) => part === "..")) {
    throw new PathSafetyError(`Unsafe relative path '${raw}'.`);
  }
  const normalized = path.posix.normalize(cleaned);
  if (normalized === "." || normalized.length === 0) {
    throw new PathSafetyError("Path must not be empty.");
  }
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
    throw new PathSafetyError(`Unsafe relative path '${raw}'.`);
  }
  if (normalized.split("/").some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new PathSafetyError(`Unsafe relative path '${raw}'.`);
  }
  return normalized;
}

export function toPosixRelativePath(value: string): string {
  return safeJoinRelative(value);
}

export function repoJoin(...segments: readonly string[]): string {
  const raw = segments.join("/");
  const slashNormalized = raw.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (/^[a-zA-Z]:/.test(slashNormalized)) {
    throw new PathSafetyError(`Unsafe repository path '${raw}'.`);
  }
  if (slashNormalized.split("/").some((part) => part === "..")) {
    throw new PathSafetyError(`Unsafe repository path '${raw}'.`);
  }
  const normalized = path.posix.normalize(slashNormalized);
  if (normalized === "." || normalized.length === 0) {
    return "/";
  }
  if (normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
    throw new PathSafetyError(`Unsafe repository path '${raw}'.`);
  }
  return `/${normalized}`;
}

function pluralizePackageType(type: PackageType): string {
  switch (type) {
    case "skill":
      return "skills";
    case "command":
      return "commands";
    case "mcp":
      return "mcps";
    case "agent":
      return "agents";
    case "hook":
      return "hooks";
    case "rule":
      return "rules";
  }
}
