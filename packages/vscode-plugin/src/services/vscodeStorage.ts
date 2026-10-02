import * as os from "os";
import * as path from "path";
import { randomUUID } from "node:crypto";
import { lstat, open, readFile, rm } from "node:fs/promises";
import * as vscode from "vscode";
import { safeJoinRelative, type InstallScope, type MarketplaceStorage, type PackageFile } from "@ai-marketplace/core";
import { safeJoinWorkspace } from "./pathSafety";

const fileTypes = vscode.FileType ?? { File: 1, Directory: 2, SymbolicLink: 64 };

export class VscodeMarketplaceStorage implements MarketplaceStorage {
  private readonly globalRoot = vscode.Uri.file(os.homedir());
  private readonly harnessHome = vscode.Uri.file(process.env.DSH_HOME || path.join(os.homedir(), ".dsh"));

  public constructor(private readonly workspaceRoot: vscode.Uri) {}

  public async readFile(scope: InstallScope, relativePath: string): Promise<Uint8Array | undefined> {
    try {
      await this.assertNoSymlinkPath(scope, relativePath);
      return await vscode.workspace.fs.readFile(this.target(scope, relativePath));
    } catch (error) {
      if (isFileNotFound(error)) return undefined;
      throw error;
    }
  }

  public async exists(scope: InstallScope, relativePath: string): Promise<boolean> {
    await this.assertNoSymlinkPath(scope, relativePath);
    return uriExists(this.target(scope, relativePath));
  }

  public async writeFile(scope: InstallScope, relativePath: string, content: Uint8Array): Promise<void> {
    await this.assertNoSymlinkPath(scope, relativePath);
    const target = this.target(scope, relativePath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(target, ".."));
    await this.assertNoSymlinkPath(scope, relativePath);
    await vscode.workspace.fs.writeFile(target, content);
  }

  public async writeFileAtomic(scope: InstallScope, relativePath: string, content: Uint8Array): Promise<void> {
    await this.assertNoSymlinkPath(scope, relativePath);
    const target = this.target(scope, relativePath);
    const temporary = vscode.Uri.joinPath(target, "..", `.ai-marketplace-${randomUUID()}.tmp`);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(target, ".."));
    await this.assertNoSymlinkPath(scope, relativePath);
    try {
      await vscode.workspace.fs.writeFile(temporary, content);
      await vscode.workspace.fs.rename(temporary, target, { overwrite: true });
    } finally {
      await Promise.resolve(vscode.workspace.fs.delete(temporary, { useTrash: false })).catch(() => undefined);
    }
  }

  public async replaceDirectory(scope: InstallScope, relativePath: string, files: readonly PackageFile[]): Promise<void> {
    await this.assertNoSymlinkPath(scope, relativePath);
    const target = this.target(scope, relativePath);
    const parent = vscode.Uri.joinPath(target, "..");
    const temporary = vscode.Uri.joinPath(parent, `.ai-marketplace-${randomUUID()}.tmp`);
    const backup = vscode.Uri.joinPath(parent, `.ai-marketplace-${randomUUID()}.backup`);
    await vscode.workspace.fs.createDirectory(temporary);
    await this.assertNoSymlinkPath(scope, relativePath);
    let movedOld = false;
    try {
      for (const file of files) {
        const fileTarget = safeJoinWorkspace(temporary, file.relativePath);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(fileTarget, ".."));
        await vscode.workspace.fs.writeFile(fileTarget, file.content);
      }
      if (await uriExists(target)) {
        await vscode.workspace.fs.rename(target, backup, { overwrite: false });
        movedOld = true;
      }
      try {
        await vscode.workspace.fs.rename(temporary, target, { overwrite: false });
      } catch (error) {
        if (movedOld) await Promise.resolve(vscode.workspace.fs.rename(backup, target, { overwrite: false })).catch(() => undefined);
        throw error;
      }
      if (movedOld) await vscode.workspace.fs.delete(backup, { recursive: true, useTrash: false });
    } finally {
      await Promise.resolve(vscode.workspace.fs.delete(temporary, { recursive: true, useTrash: false })).catch(() => undefined);
      await Promise.resolve(vscode.workspace.fs.delete(backup, { recursive: true, useTrash: false })).catch(() => undefined);
    }
  }

  public async move(scope: InstallScope, fromRelativePath: string, toRelativePath: string): Promise<void> {
    await this.assertNoSymlinkPath(scope, fromRelativePath);
    await this.assertNoSymlinkPath(scope, toRelativePath);
    const to = this.target(scope, toRelativePath);
    if (await uriExists(to)) throw new Error(`Move destination '${toRelativePath}' already exists.`);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(to, ".."));
    const from = this.target(scope, fromRelativePath);
    if (from.scheme === "file" && to.scheme === "file" && path.parse(from.fsPath).root !== path.parse(to.fsPath).root) {
      await vscode.workspace.fs.copy(from, to, { overwrite: false });
      await vscode.workspace.fs.delete(from, { recursive: true, useTrash: false });
    } else {
      await vscode.workspace.fs.rename(from, to, { overwrite: false });
    }
  }

  public async remove(scope: InstallScope, relativePath: string): Promise<void> {
    try {
      await this.assertNoSymlinkPath(scope, relativePath);
      await vscode.workspace.fs.delete(this.target(scope, relativePath), { recursive: true, useTrash: false });
    } catch (error) {
      if (!isFileNotFound(error)) throw error;
    }
  }

  public async withOperationLock<T>(scopes: readonly InstallScope[], action: () => Promise<T>): Promise<T> {
    const lockUris = [...new Set(scopes.map((scope) => scope === "global" ? "global" : "workspace"))]
      .sort()
      .map((scope) => vscode.Uri.joinPath(this.root(scope), ".ai_marketplace", ".operation.lock"));
    const locks: Array<{ close(): Promise<void>; uri: vscode.Uri }> = [];
    const remoteReleases: Array<() => void> = [];
    try {
      for (const uri of lockUris) {
        if (uri.scheme !== "file") {
          remoteReleases.push(await acquireInProcessLock(uri.fsPath));
          continue;
        }
        const lockDirectory = vscode.Uri.joinPath(uri, "..");
        await assertNotSymlink(lockDirectory.fsPath);
        await vscode.workspace.fs.createDirectory(lockDirectory);
        await assertNotSymlink(lockDirectory.fsPath);
        const handle = await acquireLock(uri.fsPath);
        locks.push({ close: () => handle.close(), uri });
      }
      return await action();
    } finally {
      for (const lock of locks.reverse()) {
        await lock.close().catch(() => undefined);
        await rm(lock.uri.fsPath, { force: true }).catch(() => undefined);
      }
      for (const release of remoteReleases.reverse()) release();
    }
  }

  private root(scope: InstallScope): vscode.Uri {
    return scope === "global" ? this.globalRoot : this.workspaceRoot;
  }

  public async listFiles(scope: InstallScope, relativePath: string): Promise<readonly string[]> {
    await this.assertNoSymlinkPath(scope, relativePath);
    const root = this.target(scope, relativePath);
    const result: string[] = [];
    const walk = async (directory: vscode.Uri, prefix: string): Promise<void> => {
      for (const [name, type] of await vscode.workspace.fs.readDirectory(directory)) {
        if ((type & fileTypes.SymbolicLink) !== 0) throw new Error("Marketplace payload contains a symbolic link.");
        const path = prefix ? safeJoinRelative(prefix, name) : safeJoinRelative(name);
        if ((type & fileTypes.Directory) !== 0) await walk(vscode.Uri.joinPath(directory, name), path);
        else if ((type & fileTypes.File) !== 0) result.push(path);
        else throw new Error("Marketplace payload contains an unsupported filesystem entry.");
      }
    };
    await walk(root, "");
    return result.sort();
  }

  private target(scope: InstallScope, relativePath: string): vscode.Uri {
    if (scope === "global" && relativePath.startsWith(".dsh/")) {
      return safeJoinWorkspace(this.harnessHome, relativePath.slice(".dsh/".length));
    }
    return safeJoinWorkspace(this.root(scope), relativePath);
  }

  private async assertNoSymlinkPath(scope: InstallScope, relativePath: string): Promise<void> {
    const harness = scope === "global" && relativePath.startsWith(".dsh/");
    const root = harness ? this.harnessHome : this.root(scope);
    const pathToCheck = harness ? relativePath.slice(".dsh/".length) : relativePath;
    const segments = safeJoinRelative(pathToCheck).split("/");
    let cursor = root;
    for (const segment of ["", ...segments]) {
      if (segment) cursor = vscode.Uri.joinPath(cursor, segment);
      try {
        const stat = await vscode.workspace.fs.stat(cursor);
        if ((stat.type & fileTypes.SymbolicLink) !== 0) throw new Error(`Marketplace path contains a symbolic link: ${cursor.fsPath}`);
      } catch (error) {
        if (!isFileNotFound(error)) throw error;
      }
    }
  }
}

const inProcessLocks = new Map<string, Promise<void>>();

async function acquireInProcessLock(key: string): Promise<() => void> {
  const previous = inProcessLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolveLock) => { release = resolveLock; });
  const queued = previous.then(() => current);
  inProcessLocks.set(key, queued);
  await previous;
  return () => {
    release();
    if (inProcessLocks.get(key) === queued) inProcessLocks.delete(key);
  };
}

async function acquireLock(lockPath: string) {
  try {
    const handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
    return handle;
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
  }
  if (await isStaleLock(lockPath)) {
    await rm(lockPath, { force: true });
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
      return handle;
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    }
  }
  throw new Error(`Another marketplace operation holds ${lockPath}.`);
}

async function isStaleLock(lockPath: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(await readFile(lockPath, "utf8")) as { pid?: unknown; startedAt?: unknown };
    if (typeof parsed.pid !== "number" || !Number.isSafeInteger(parsed.pid) || parsed.pid <= 0 || typeof parsed.startedAt !== "string") return false;
    const startedAt = Date.parse(parsed.startedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < 300_000) return false;
    try {
      process.kill(parsed.pid, 0);
      return false;
    } catch (error) {
      return hasCode(error, "ESRCH");
    }
  } catch {
    return false;
  }
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

async function assertNotSymlink(path: string): Promise<void> {
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error(`Marketplace metadata directory must not be a symbolic link: ${path}`);
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof vscode.FileSystemError && error.code === "FileNotFound";
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (error) {
    if (isFileNotFound(error)) return false;
    throw error;
  }
}
