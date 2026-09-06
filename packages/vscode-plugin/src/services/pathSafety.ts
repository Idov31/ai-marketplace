import * as vscode from "vscode";
import {
  installRelativePath,
  installRootRelativePath,
  cloudInstallPath,
  offloadRootRelativePath,
  offloadRelativePath,
  repoJoin,
  safeJoinRelative,
  stateRelativePath,
  legacyStateRelativePath,
  toPosixRelativePath,
  PathSafetyError
} from "./pathPlanning";

export {
  installRelativePath,
  installRootRelativePath,
  cloudInstallPath,
  offloadRootRelativePath,
  offloadRelativePath,
  repoJoin,
  safeJoinRelative,
  stateRelativePath,
  legacyStateRelativePath,
  toPosixRelativePath,
  PathSafetyError
};

export function getWorkspaceRoot(): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new PathSafetyError("AI Marketplace requires an open workspace folder.");
  }
  return folder.uri;
}

export function safeJoinWorkspace(root: vscode.Uri, ...segments: readonly string[]): vscode.Uri {
  const relativePath = safeJoinRelative(...segments);
  return vscode.Uri.joinPath(root, ...relativePath.split("/"));
}
