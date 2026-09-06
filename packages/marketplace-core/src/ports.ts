import type { InstallScope, MarketplaceConfig, McpScriptAction, PackageFile, Platform, RepositoryConfig, RepositoryProvider } from "./types/packages";

export interface MarketplaceStorage {
  readFile(scope: InstallScope, relativePath: string): Promise<Uint8Array | undefined>;
  exists(scope: InstallScope, relativePath: string): Promise<boolean>;
  writeFile(scope: InstallScope, relativePath: string, content: Uint8Array): Promise<void>;
  writeFileAtomic(scope: InstallScope, relativePath: string, content: Uint8Array): Promise<void>;
  replaceDirectory(scope: InstallScope, relativePath: string, files: readonly PackageFile[]): Promise<void>;
  move(scope: InstallScope, fromRelativePath: string, toRelativePath: string): Promise<void>;
  remove(scope: InstallScope, relativePath: string): Promise<void>;
}

export interface MarketplaceConfigProvider {
  read(): MarketplaceConfig;
}

export type RepositoryCredentialKind = "bearer" | "basic-pat" | "private-token";

export interface RepositoryCredential {
  readonly kind: RepositoryCredentialKind;
  readonly token: string;
  readonly source?: string;
}

export interface CredentialProvider {
  sharedCredentials(provider: RepositoryProvider): Promise<readonly RepositoryCredential[]>;
  sourceCredentials(source: RepositoryConfig): Promise<readonly RepositoryCredential[]>;
}

export interface MarketplaceLogger {
  log(message: string): void;
}

export interface McpScriptRequest {
  readonly scope: "global";
  readonly packagePath: string;
  readonly script: "install.py" | "uninstall.py";
  readonly action: McpScriptAction;
  readonly platform: Platform;
  readonly timeoutMs: number;
}

/** Host adapter for executing a validated Python script without a shell. */
export interface McpScriptRunner {
  run(request: McpScriptRequest): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
