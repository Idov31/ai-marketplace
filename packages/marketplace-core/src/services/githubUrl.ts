import { parseGitHub } from "./repositoryUrl";

export const defaultGitHubRepositoryUrl = "https://github.com/Idov31/AI-Repository";

export interface GitHubRepoParts {
  readonly owner: string;
  readonly repository: string;
  readonly fullName: string;
}

const ownerOrRepoPattern = /^[A-Za-z0-9_.-]+$/;

export function parseGitHubRepo(value: string): GitHubRepoParts | undefined {
  const parsed = parseGitHub(value);
  if (!parsed?.owner || !ownerOrRepoPattern.test(parsed.owner) || !ownerOrRepoPattern.test(parsed.repository)) return undefined;
  return {
    owner: parsed.owner,
    repository: parsed.repository,
    fullName: `${parsed.owner}/${parsed.repository}`
  };
}
