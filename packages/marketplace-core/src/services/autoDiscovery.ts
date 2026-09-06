import {
  packageTypes,
  platforms,
  type InstallScope,
  type InstalledPackage,
  type MarketplaceConfig,
  type MarketplacePackage,
  type PackageType,
  type Platform
} from "../types/packages";
import { installRootRelativePath, offloadRootRelativePath, safeJoinRelative } from "./pathPlanning";
import { validateMarketplaceManifest } from "./validation";
import { parseMarketplaceYaml } from "./marketplaceYaml";
import { canonicalManifestFileName } from "./manifestSchema";
import { ManifestDiagnosticCollector } from "./manifestDiagnostics";
import { repositoryIdentity } from "./repositoryUrl";

export interface AutoDiscoveryDirectoryEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly isSymbolicLink: boolean;
}

export interface AutoDiscoveryFileSystem {
  readDirectory(relativePath: string): Promise<readonly AutoDiscoveryDirectoryEntry[] | undefined>;
  readText(relativePath: string): Promise<string>;
}

export interface AutoDiscoveryOptions {
  readonly config: MarketplaceConfig;
  readonly catalog: readonly MarketplacePackage[];
  readonly existing: readonly InstalledPackage[];
  readonly scope: InstallScope;
  readonly fileSystem: AutoDiscoveryFileSystem;
  readonly now: () => string;
  readonly log: (message: string) => void;
}

export async function discoverInstalledPackages(options: AutoDiscoveryOptions): Promise<readonly InstalledPackage[]> {
  if (options.scope === "cloud") {
    return [];
  }

  const discovered: InstalledPackage[] = [];
  const seen = new Set(options.existing.map(installIdentity));
  const diagnostics = new ManifestDiagnosticCollector();

  for (const platform of platforms) {
    for (const packageType of packageTypes) {
      if (packageType === "mcp") {
        continue;
      }
      await discoverRoot(options, discovered, seen, diagnostics, platform, packageType, installRootRelativePath(platform, packageType, options.config.platformPathOverrides), true);
      await discoverRoot(options, discovered, seen, diagnostics, platform, packageType, offloadRootRelativePath(platform, packageType), false);
    }
  }

  const summary = diagnostics.summary("local auto-discovery");
  if (summary) options.log(summary);
  return discovered;
}

async function discoverRoot(
  options: AutoDiscoveryOptions,
  discovered: InstalledPackage[],
  seen: Set<string>,
  diagnostics: ManifestDiagnosticCollector,
  platform: Platform,
  packageType: PackageType,
  rootRelativePath: string,
  hotloaded: boolean
): Promise<void> {
  let entries: readonly AutoDiscoveryDirectoryEntry[];
  try {
    entries = await options.fileSystem.readDirectory(rootRelativePath) ?? [];
  } catch (error) {
    options.log(`Auto-discovery skipped ${rootRelativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory || entry.isSymbolicLink) {
      continue;
    }
    const packageRoot = safeJoinRelative(rootRelativePath, entry.name);
    await discoverPackage(options, discovered, seen, diagnostics, platform, packageType, packageRoot, entry.name, hotloaded);
  }
}

async function discoverPackage(
  options: AutoDiscoveryOptions,
  discovered: InstalledPackage[],
  seen: Set<string>,
  diagnostics: ManifestDiagnosticCollector,
  platform: Platform,
  packageType: PackageType,
  packageRoot: string,
  directoryName: string,
  hotloaded: boolean
): Promise<void> {
  const manifestPath = safeJoinRelative(packageRoot, canonicalManifestFileName);
  try {
    const text = await options.fileSystem.readText(manifestPath);
    const validated = validateMarketplaceManifest(parseMarketplaceYaml(text, manifestPath), manifestPath);
    diagnostics.record(validated.diagnostics);
    const manifest = validated.manifest;
    if (manifest.id !== directoryName) {
      options.log(`Auto-discovery skipped ${manifestPath}: manifest id does not match containing folder.`);
      return;
    }
    if (manifest.type !== packageType) {
      options.log(`Auto-discovery skipped ${manifestPath}: manifest type does not match containing folder.`);
      return;
    }
    if (!manifest.platforms.includes(platform)) {
      options.log(`Auto-discovery skipped ${manifestPath}: manifest does not support ${platform}.`);
      return;
    }
    if (!manifest.delivery.includes(options.scope)) {
      options.log(`Auto-discovery skipped ${manifestPath}: manifest does not support ${options.scope} delivery.`);
      return;
    }

    const catalogMatches = options.catalog.filter((pkg) => pkg.manifest.qualifiedName === manifest.qualifiedName);
    if (catalogMatches.length !== 1) {
      options.log(`Auto-discovery skipped ${manifestPath}: package must resolve to exactly one source-qualified catalog entry.`);
      return;
    }
    const catalogPackage = catalogMatches[0];
    if (catalogPackage.manifest.type !== manifest.type || !catalogPackage.manifest.platforms.includes(platform) || !catalogPackage.manifest.delivery.includes(options.scope)) {
      options.log(`Auto-discovery skipped ${manifestPath}: catalog package does not support this installation target.`);
      return;
    }
    const identity = installIdentity({ id: manifest.id, platform, scope: options.scope, sourceId: catalogPackage.source.id });
    if (seen.has(identity) || options.existing.some((item) =>
      item.id === manifest.id && item.platform === platform && item.scope === options.scope && item.sourceId === undefined
    )) {
      return;
    }

    discovered.push({
      id: manifest.id,
      type: manifest.type,
      platform,
      scope: options.scope,
      version: manifest.version,
      sourceRepo: repositoryIdentity(catalogPackage.source),
      sourceBranch: catalogPackage.source.branch,
      sourcePath: catalogPackage.sourcePath,
      sourceId: catalogPackage.source.id,
      qualifiedName: manifest.qualifiedName,
      group: manifest.group,
      installedPath: packageRoot,
      installedAt: options.now(),
      hotloaded
    });
    seen.add(identity);
  } catch (error) {
    if (isMissingManifest(error)) return;
    options.log(`Auto-discovery skipped ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isMissingManifest(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error && (error as { readonly code?: unknown }).code === "ENOENT") return true;
  return error instanceof Error && /(?:^|\s)ENOENT(?::|\s)|file\s*not\s*found/i.test(error.message);
}

function installIdentity(value: Pick<InstalledPackage, "id" | "platform" | "scope"> & Partial<Pick<InstalledPackage, "sourceId">>): string {
  return `${value.scope}:${value.platform}:${value.sourceId ?? ""}:${value.id}`;
}
