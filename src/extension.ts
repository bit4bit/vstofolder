import * as vscode from "vscode";
import { FolderFinder, DirectoryCache, CacheEntry } from "./folder-finder";

class ExtensionCache implements DirectoryCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: CacheEntry): void {
    this.cache.set(key, value);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  isCacheValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const config = vscode.workspace.getConfiguration("vstofolder");
    const cacheValidDurationMinutes = config.get<number>(
      "cacheValidationDuration",
      60,
    );
    const cacheValidDuration = cacheValidDurationMinutes * 60 * 1000;

    return (
      cacheValidDurationMinutes > 0 &&
      now - entry.timestamp < cacheValidDuration
    );
  }
}

let folderFinder: FolderFinder;
let cache: ExtensionCache;

export function activate(context: vscode.ExtensionContext) {
  cache = new ExtensionCache();
  folderFinder = new FolderFinder(cache);
  folderFinder.initialize(context);

  const findFolderDisposable = vscode.commands.registerCommand(
    "vstofolder.FindFolder",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder is open");
        return;
      }

      const directories = await getDirectories();

      if (directories.length === 0) {
        cache.clear();
        vscode.window.showInformationMessage("No directories found");
        return;
      }

      const selectedFolder = await vscode.window.showQuickPick(
        directories.sort(),
        {
          title: "Find Folder",
          placeHolder: "Select a folder to navigate to",
          canPickMany: false,
          matchOnDescription: true,
        },
      );

      if (selectedFolder) {
        await folderFinder.navigateToFolder(selectedFolder);
      }
    },
  );

  context.subscriptions.push(findFolderDisposable);

  vscode.workspace.onDidChangeWorkspaceFolders(
    () => {
      cache.clear();
      folderFinder.dispose();
      folderFinder.initialize(context);
    },
    null,
    context.subscriptions,
  );

  vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration("vstofolder.cacheValidationDuration")) {
        cache.clear();
      }
    },
    null,
    context.subscriptions,
  );

  async function getDirectories(): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    let allDirectories: string[] = [];

    for (const folder of workspaceFolders) {
      const cacheKey = folder.uri.toString();
      const cached = cache.get(cacheKey);

      if (cached && cache.isCacheValid(cached)) {
        allDirectories.push(...cached.directories);
      } else {
        const directories =
          await folderFinder.getDirectoriesForWorkspace(folder);

        cache.set(cacheKey, {
          directories: directories,
          timestamp: Date.now(),
        });

        allDirectories.push(...directories);
      }
    }

    return allDirectories;
  }
}

export function deactivate() {
  if (folderFinder) {
    folderFinder.dispose();
  }
  if (cache) {
    cache.clear();
  }
}
