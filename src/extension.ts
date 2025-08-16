import * as vscode from "vscode";
import { FolderFinder, DirectoryCache, CacheEntry } from "./folder-finder";

function detectEnvironment(): string {
  const appName = vscode.env.appName;
  if (appName.toLowerCase().includes("windsurf")) {
    return "windsurf";
  }
  if (appName.toLowerCase().includes("cursor")) {
    return "cursor";
  }
  return "vscode";
}

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
}

interface Repository {
  rootUri: vscode.Uri;
  checkIgnore(paths: string[]): Promise<Set<string>>;
}

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

function getGitAPI(): GitAPI | undefined {
  const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
  if (gitExtension) {
    return gitExtension.getAPI(1);
  }
  return undefined;
}

async function isIgnoredByGit(uri: vscode.Uri): Promise<boolean> {
  try {
    const gitAPI = getGitAPI();
    if (!gitAPI || gitAPI.repositories.length === 0) {
      return false;
    }

    const repo = gitAPI.repositories.find((repo) => {
      const repoPath = repo.rootUri.fsPath;
      const filePath = uri.fsPath;
      return filePath.startsWith(repoPath);
    });

    if (!repo) {
      return false;
    }

    const ignoredPaths = await repo.checkIgnore([uri.fsPath]);
    return ignoredPaths.size > 0;
  } catch (error) {
    return false;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const environment = detectEnvironment();
  console.log(`vstofolder: Running in ${environment} (${vscode.env.appName})`);

  cache = new ExtensionCache();
  folderFinder = new FolderFinder(cache, isIgnoredByGit, environment);
  folderFinder.initialize(context);

  const findFolderDisposable = vscode.commands.registerCommand(
    "vstofolder.FindFolder",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder is open");
        return;
      }

      const directories = await getDirectories(workspaceFolders);

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
    async (event) => {
      for (const removed of event.removed) {
        cache.delete(removed.uri.toString());
      }

      for (const added of event.added) {
        const directories =
          await folderFinder.getDirectoriesForWorkspace(added);
        cache.set(added.uri.toString(), {
          directories: directories,
          timestamp: Date.now(),
        });
      }

      folderFinder.updateWorkspaceFolders(context);
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

  async function getDirectories(
    workspaceFolders: readonly vscode.WorkspaceFolder[],
  ): Promise<string[]> {
    let allDirectories: string[] = [];

    for (const folder of workspaceFolders) {
      const cacheKey = folder.uri.toString();
      const cached = cache.get(cacheKey);
      const workspaceName = folder.name;

      allDirectories.push(`${workspaceName}/`);

      if (cached && cache.isCacheValid(cached)) {
        const prefixedDirectories = cached.directories.map(
          (dir) => `${workspaceName}/${dir}`,
        );
        allDirectories.push(...prefixedDirectories);
      } else {
        const directories =
          await folderFinder.getDirectoriesForWorkspace(folder);

        cache.set(cacheKey, {
          directories: directories,
          timestamp: Date.now(),
        });

        const prefixedDirectories = directories.map(
          (dir) => `${workspaceName}/${dir}`,
        );
        allDirectories.push(...prefixedDirectories);
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
