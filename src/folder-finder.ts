import * as vscode from "vscode";
import * as path from "path";

export interface CacheEntry {
  directories: string[];
  timestamp: number;
}

export interface DirectoryCache {
  get(key: string): CacheEntry | undefined;
  set(key: string, value: CacheEntry): void;
  delete(key: string): void;
  clear(): void;
}

export class FolderFinder {
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private environment: string;

  constructor(
    private cache: DirectoryCache,
    private scmIgnoreCheck: (uri: vscode.Uri) => Promise<boolean>,
    environment: string = "vscode",
  ) {
    this.environment = environment;
  }

  initialize(context: vscode.ExtensionContext) {
    this.initializeFileWatcher(context);
  }

  updateWorkspaceFolders(context: vscode.ExtensionContext) {
    this.initializeFileWatcher(context);
  }

  dispose() {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }

  async getDirectories(): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    let allDirectories: string[] = [];

    for (const folder of workspaceFolders) {
      const directories = await this.getDirectoriesForWorkspace(folder);
      allDirectories.push(...directories);
    }

    return allDirectories;
  }

  async getDirectoriesForWorkspace(
    folder: vscode.WorkspaceFolder,
  ): Promise<string[]> {
    const directories: string[] = [];
    await this.scanDirectory(folder.uri, "", directories);
    return directories;
  }

  private async scanDirectory(
    dirUri: vscode.Uri,
    relativePath: string = "",
    directories: string[] = [],
  ): Promise<void> {
    try {
      const items = await vscode.workspace.fs.readDirectory(dirUri);

      for (const [name, type] of items) {
        if (type === vscode.FileType.Directory && !name.startsWith(".")) {
          const childUri = vscode.Uri.joinPath(dirUri, name);
          const itemRelativePath = relativePath
            ? path.join(relativePath, name)
            : name;

          const isIgnored = await this.scmIgnoreCheck(childUri);
          const isExcluded = this.isExcludedBySettings(itemRelativePath);

          if (isIgnored || isExcluded) {
            const config = vscode.workspace.getConfiguration("vstofolder");
            const enableDetailedLogging = config.get<boolean>(
              "enableDetailedLogging",
              false,
            );

            if (enableDetailedLogging) {
              console.log(
                `[${this.environment}] Skipping ${itemRelativePath} due to exclusion`,
              );
            }
            continue;
          }

          directories.push(itemRelativePath);
          await this.scanDirectory(childUri, itemRelativePath, directories);
        }
      }
    } catch (error) {
      console.error(
        `[${this.environment}] Error scanning directory ${dirUri.fsPath}:`,
        error,
      );
    }
  }

  private isExcludedBySettings(relativePath: string): boolean {
    const config = vscode.workspace.getConfiguration();
    const filesExclude = config.get<Record<string, boolean>>(
      "files.exclude",
      {},
    );
    const searchExclude = config.get<Record<string, boolean>>(
      "search.exclude",
      {},
    );

    const allExcludes = { ...filesExclude, ...searchExclude };

    for (const pattern in allExcludes) {
      if (allExcludes[pattern]) {
        const globPattern = new RegExp(
          pattern
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/]*")
            .replace(/\?/g, ".")
            .replace(/\./g, "\\."),
        );

        if (
          globPattern.test(relativePath) ||
          globPattern.test(relativePath + "/")
        ) {
          return true;
        }
      }
    }

    return false;
  }

  async navigateToFolder(selectedFolder: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    let targetWorkspace = workspaceFolders[0];
    let folderPath = selectedFolder;

    if (selectedFolder.endsWith("/")) {
      const workspaceName = selectedFolder.slice(0, -1);
      const foundWorkspace = workspaceFolders.find(
        (ws) => ws.name === workspaceName,
      );
      if (foundWorkspace) {
        targetWorkspace = foundWorkspace;
        folderPath = "";
      }
    } else {
      const pathParts = selectedFolder.split("/");
      if (pathParts.length > 1) {
        const workspaceName = pathParts[0];
        folderPath = pathParts.slice(1).join("/");

        const foundWorkspace = workspaceFolders.find(
          (ws) => ws.name === workspaceName,
        );
        if (foundWorkspace) {
          targetWorkspace = foundWorkspace;
        }
      }
    }

    const folderUri = folderPath
      ? vscode.Uri.joinPath(targetWorkspace.uri, folderPath)
      : targetWorkspace.uri;
    await vscode.commands.executeCommand("workbench.view.explorer");
    await vscode.commands.executeCommand("revealInExplorer", folderUri);
  }

  private invalidateCache(workspaceUri: vscode.Uri): void {
    const cacheKey = workspaceUri.toString();
    this.cache.delete(cacheKey);
  }

  private initializeFileWatcher(context: vscode.ExtensionContext): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      "**/*",
      false,
      true,
      false,
    );

    this.fileWatcher.onDidCreate((uri) => {
      for (const folder of workspaceFolders) {
        if (uri.fsPath.startsWith(folder.uri.fsPath)) {
          this.invalidateCache(folder.uri);
          break;
        }
      }
    });

    this.fileWatcher.onDidDelete((uri) => {
      for (const folder of workspaceFolders) {
        if (uri.fsPath.startsWith(folder.uri.fsPath)) {
          this.invalidateCache(folder.uri);
          break;
        }
      }
    });

    context.subscriptions.push(this.fileWatcher);
  }
}
