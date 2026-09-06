import type * as vscode from "vscode";
import { InstalledStateStore as CoreInstalledStateStore } from "@ai-marketplace/core";
import { VscodeMarketplaceStorage } from "./vscodeStorage";

export class InstalledStateStore extends CoreInstalledStateStore {
  public constructor(root: vscode.Uri) {
    super(new VscodeMarketplaceStorage(root), "workspace");
  }
}
