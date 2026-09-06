export function compareVersions(left: string, right: string): number {
  const leftSemver = parseSemanticVersion(left);
  const rightSemver = parseSemanticVersion(right);
  if (leftSemver && rightSemver) return compareSemanticVersions(leftSemver, rightSemver);
  const leftParts = tokenizeVersion(left);
  const rightParts = tokenizeVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? { kind: "number" as const, value: 0 };
    const rightPart = rightParts[index] ?? { kind: "number" as const, value: 0 };
    const compared = compareVersionPart(leftPart, rightPart);
    if (compared !== 0) {
      return compared;
    }
  }

  return 0;
}

interface SemanticVersion { readonly major: number; readonly minor: number; readonly patch: number; readonly prerelease: readonly (number | string)[]; }

export function isSemanticVersion(value: string): boolean { return parseSemanticVersion(value) !== undefined; }

function parseSemanticVersion(value: string): SemanticVersion | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4]?.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part) ?? [] };
}

function compareSemanticVersions(left: SemanticVersion, right: SemanticVersion): number {
  for (const key of ["major", "minor", "patch"] as const) if (left[key] !== right[key]) return Math.sign(left[key] - right[key]);
  if (left.prerelease.length === 0 || right.prerelease.length === 0) return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length === 0 ? 1 : -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const l = left.prerelease[index]; const r = right.prerelease[index];
    if (l === undefined || r === undefined) return l === r ? 0 : l === undefined ? -1 : 1;
    if (l === r) continue;
    if (typeof l === "number" && typeof r === "number") return Math.sign(l - r);
    if (typeof l === "number") return -1;
    if (typeof r === "number") return 1;
    return l.localeCompare(r);
  }
  return 0;
}

export function isUpdateAvailable(installedVersion: string, availableVersion: string): boolean {
  return compareVersions(installedVersion, availableVersion) < 0;
}

type VersionPart =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "text"; readonly value: string };

function tokenizeVersion(version: string): readonly VersionPart[] {
  return version
    .trim()
    .split(/[.+_-]/)
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) {
        return { kind: "number", value: Number(part) };
      }
      return { kind: "text", value: part.toLowerCase() };
    });
}

function compareVersionPart(left: VersionPart, right: VersionPart): number {
  if (left.kind === "number" && right.kind === "number") {
    return Math.sign(left.value - right.value);
  }
  if (left.kind === "number") {
    return 1;
  }
  if (right.kind === "number") {
    return -1;
  }
  return left.value.localeCompare(right.value);
}
