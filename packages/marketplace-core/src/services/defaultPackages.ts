import { platforms, type InstalledPackage, type MarketplaceConfig, type MarketplacePackage, type Platform } from "../types/packages";
import { installedIdentity, packageIdentity } from "./marketplaceModel";

export interface DefaultPackageInstallPlan {
  readonly pkg: MarketplacePackage;
  readonly platform: Platform;
}

export function defaultPackageInstallPlans(
  packages: readonly MarketplacePackage[],
  installed: readonly InstalledPackage[],
  defaultPlatform: Platform,
  config?: MarketplaceConfig
): readonly DefaultPackageInstallPlan[] {
  return packages
    .filter(isDefaultPackage)
    .filter((pkg) => config === undefined || (config.repositories ?? []).some((source) =>
      source.id === pkg.source.id && source.allowDefaultPackages
    ))
    .filter((pkg) => pkg.manifest.delivery.includes("global"))
    .filter((pkg) => !installed.some((item) =>
      installedIdentity(item) === packageIdentity(pkg) || (item.sourceId === undefined && item.id === pkg.manifest.id)
    ))
    .map((pkg) => ({
      pkg,
      platform: preferredPlatform(pkg, defaultPlatform)
    }));
}

function isDefaultPackage(pkg: MarketplacePackage): boolean {
  return pkg.manifest.defaultInstall === true
    || (pkg.manifest.defaultInstall === undefined && pkg.manifest.tags.some((tag) => tag.trim().toLowerCase() === "default"));
}

function preferredPlatform(pkg: MarketplacePackage, defaultPlatform: Platform): Platform {
  return orderedPlatforms(pkg.manifest.platforms, defaultPlatform)[0];
}

function orderedPlatforms(availablePlatforms: readonly Platform[], defaultPlatform: Platform): readonly Platform[] {
  return [...availablePlatforms].sort((left, right) => {
    if (left === defaultPlatform) {
      return -1;
    }
    if (right === defaultPlatform) {
      return 1;
    }
    return platforms.indexOf(left) - platforms.indexOf(right);
  });
}
