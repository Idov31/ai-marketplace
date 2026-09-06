import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { access, lstat, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { InstallScope, MarketplaceStorage, PackageFile } from "@ai-marketplace/core";

export class SecurityError extends Error {}

export class NodeMarketplaceStorage implements MarketplaceStorage {
  private readonly atomicWriteQueues = new Map<string, Promise<void>>();

  public constructor(private readonly workspaceRoot: string, private readonly globalRoot: string) {}

  public async validateRoots(): Promise<void> {
    await this.validateRoot(this.workspaceRoot, "workspace");
    await this.validateRoot(this.globalRoot, "global");
  }

  public async readFile(scope: InstallScope, relativePath: string): Promise<Uint8Array | undefined> {
    const target = await this.safeTarget(scope, relativePath, true);
    try {
      return await readFile(target);
    } catch (error) {
      if (isCode(error, "ENOENT")) return undefined;
      throw error;
    }
  }

  public async exists(scope: InstallScope, relativePath: string): Promise<boolean> {
    return exists(await this.safeTarget(scope, relativePath, true));
  }

  public async writeFile(scope: InstallScope, relativePath: string, content: Uint8Array): Promise<void> {
    const target = await this.safeTarget(scope, relativePath, true);
    await mkdir(dirname(target), { recursive: true });
    await this.safeTarget(scope, relativePath, true);
    await writeFile(target, content, { mode: 0o600 });
  }

  public async writeFileAtomic(scope: InstallScope, relativePath: string, content: Uint8Array): Promise<void> {
    const target = await this.safeTarget(scope, relativePath, true);
    await mkdir(dirname(target), { recursive: true });
    await this.safeTarget(scope, relativePath, true);
    const previous = this.atomicWriteQueues.get(target) ?? Promise.resolve();
    const write = previous.catch(() => undefined).then(async () => {
      const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
      try {
        await writeFile(temporary, content, { mode: 0o600, flag: "wx" });
        await rename(temporary, target);
      } finally {
        await rm(temporary, { force: true }).catch(() => undefined);
      }
    });
    this.atomicWriteQueues.set(target, write);
    try {
      await write;
    } finally {
      if (this.atomicWriteQueues.get(target) === write) this.atomicWriteQueues.delete(target);
    }
  }

  public async replaceDirectory(scope: InstallScope, relativePath: string, files: readonly PackageFile[]): Promise<void> {
    const target = await this.safeTarget(scope, relativePath, true);
    const operationId = `${process.pid}-${randomUUID()}`;
    const temporary = `${target}.tmp-${operationId}`;
    const backup = `${target}.backup-${operationId}`;
    await mkdir(dirname(target), { recursive: true });
    await this.safeTarget(scope, relativePath, true);
    await mkdir(temporary, { recursive: false });
    try {
      for (const file of files) {
        const fileTarget = safeChild(temporary, file.relativePath);
        await assertNoSymlinkPath(temporary, fileTarget);
        await mkdir(dirname(fileTarget), { recursive: true });
        await writeFile(fileTarget, file.content, { mode: 0o600 });
      }
      let movedOld = false;
      if (await exists(target)) {
        await rename(target, backup);
        movedOld = true;
      }
      try {
        await rename(temporary, target);
      } catch (error) {
        if (movedOld) await rename(backup, target).catch(() => undefined);
        throw error;
      }
      if (movedOld) await rm(backup, { recursive: true, force: true });
    } finally {
      await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
      await rm(backup, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  public async move(scope: InstallScope, fromRelativePath: string, toRelativePath: string): Promise<void> {
    const from = await this.safeTarget(scope, fromRelativePath, false);
    const to = await this.safeTarget(scope, toRelativePath, true);
    if (await exists(to)) throw new SecurityError(`Move destination already exists: ${toRelativePath}`);
    await mkdir(dirname(to), { recursive: true });
    await rename(from, to);
  }

  public async remove(scope: InstallScope, relativePath: string): Promise<void> {
    const target = await this.safeTarget(scope, relativePath, true);
    await rm(target, { recursive: true, force: true });
  }

  public root(scope: "workspace" | "global"): string {
    return scope === "workspace" ? this.workspaceRoot : this.globalRoot;
  }

  public async assertSafe(scope: "workspace" | "global", relativePath: string, allowMissing = true): Promise<string> {
    return this.safeTarget(scope, relativePath, allowMissing);
  }

  private async safeTarget(scope: InstallScope, relativePath: string, allowMissing: boolean): Promise<string> {
    if (scope === "cloud") throw new SecurityError("Cloud scope is not supported by the marketplace CLI.");
    const root = this.root(scope);
    const target = safeChild(root, relativePath);
    await assertNoSymlinkPath(root, target, allowMissing);
    return target;
  }

  private async validateRoot(root: string, label: string): Promise<void> {
    if (!isAbsolute(root)) throw new SecurityError(`${label} root must be absolute.`);
    const info = await lstat(root).catch(() => undefined);
    if (!info?.isDirectory()) throw new SecurityError(`${label} root must be an existing directory.`);
    if (info.isSymbolicLink()) throw new SecurityError(`${label} root must not be a symbolic link.`);
    await access(root, constants.R_OK | constants.W_OK);
  }
}

export async function withOperationLock<T>(storage: NodeMarketplaceStorage, roots: readonly ("workspace" | "global")[], action: () => Promise<T>): Promise<T> {
  const locks: Array<{ close(): Promise<void>; path: string }> = [];
  try {
    for (const scope of [...new Set(roots)].sort()) {
      const lockDir = resolve(storage.root(scope), ".ai_marketplace");
      await storage.assertSafe(scope, ".ai_marketplace/.operation.lock", true);
      await mkdir(lockDir, { recursive: true });
      await storage.assertSafe(scope, ".ai_marketplace/.operation.lock", true);
      const lockPath = resolve(lockDir, ".operation.lock");
      const handle = await acquireLock(lockPath);
      locks.push({ close: () => handle.close(), path: lockPath });
    }
    return await action();
  } finally {
    for (const lock of locks.reverse()) {
      await lock.close().catch(() => undefined);
      await rm(lock.path, { force: true }).catch(() => undefined);
    }
  }
}

async function acquireLock(lockPath: string) {
  try {
    const handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
    return handle;
  } catch (error) {
    if (!isCode(error, "EEXIST")) throw error;
  }
  if (await isStaleLock(lockPath)) {
    await rm(lockPath, { force: true });
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
      return handle;
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
    }
  }
  throw new SecurityError(`Another marketplace operation holds ${lockPath}.`);
}

async function isStaleLock(lockPath: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(await readFile(lockPath, "utf8")) as { pid?: unknown; startedAt?: unknown };
    if (typeof parsed.pid !== "number" || !Number.isSafeInteger(parsed.pid) || parsed.pid <= 0 || typeof parsed.startedAt !== "string") return false;
    const startedAt = Date.parse(parsed.startedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < 300_000) return false;
    try { process.kill(parsed.pid, 0); return false; } catch (error) { return isCode(error, "ESRCH"); }
  } catch {
    return false;
  }
}

function safeChild(root: string, input: string): string {
  if (!input || isAbsolute(input) || input.includes("\0")) throw new SecurityError(`Unsafe relative path: ${input}`);
  const target = resolve(root, input);
  const within = relative(resolve(root), target);
  if (!within || within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within)) throw new SecurityError(`Path escapes configured root: ${input}`);
  return target;
}

async function assertNoSymlinkPath(root: string, target: string, allowMissing = true): Promise<void> {
  const rel = relative(root, target);
  let current = resolve(root);
  for (const segment of rel.split(sep)) {
    current = resolve(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new SecurityError(`Symbolic links are not allowed in managed paths: ${current}`);
    } catch (error) {
      if (isCode(error, "ENOENT") && allowMissing) return;
      throw error;
    }
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, (error) => isCode(error, "ENOENT") ? false : Promise.reject(error));
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}
