import * as vscode from "vscode";
import * as path from "path";

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

interface CacheEntry {
  directories: string[];
  timestamp: number;
}

const directoryCache = new Map<string, CacheEntry>();
let fileWatcher: vscode.FileSystemWatcher | undefined;

const invalidateCache = (workspaceUri: vscode.Uri) => {
  const cacheKey = workspaceUri.toString();
  directoryCache.delete(cacheKey);
};

const initializeFileWatcher = (context: vscode.ExtensionContext) => {
  if (fileWatcher) {
    fileWatcher.dispose();
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  fileWatcher = vscode.workspace.createFileSystemWatcher(
    "**/*",
    false,
    true,
    false,
  );

  fileWatcher.onDidCreate((uri) => {
    for (const folder of workspaceFolders) {
      if (uri.fsPath.startsWith(folder.uri.fsPath)) {
        invalidateCache(folder.uri);
        break;
      }
    }
  });

  fileWatcher.onDidDelete((uri) => {
    for (const folder of workspaceFolders) {
      if (uri.fsPath.startsWith(folder.uri.fsPath)) {
        invalidateCache(folder.uri);
        break;
      }
    }
  });

  context.subscriptions.push(fileWatcher);
};

export function activate(context: vscode.ExtensionContext) {
  initializeFileWatcher(context);
  const findFolderDisposable = vscode.commands.registerCommand(
    "vstofolder.FindFolder",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder is open");
        return;
      }

      const gitExtension =
        vscode.extensions.getExtension("vscode.git")?.exports;
      let gitAPI: GitAPI | undefined;
      if (gitExtension) {
        gitAPI = gitExtension.getAPI(1);
      }

      let allDirectories: string[] = [];

      const isIgnoredByGit = async (uri: vscode.Uri): Promise<boolean> => {
        if (!gitAPI || gitAPI.repositories.length === 0) {
          return false;
        }

        const repo = gitAPI.repositories.find((repo) => {
          const repoPath = repo.rootUri.fsPath;
          const filePath = uri.fsPath;
          return filePath.startsWith(repoPath);
        });

        if (!repo) {
          return true;
        }

        const ignoredPaths = await repo.checkIgnore([uri.fsPath]);
        if (ignoredPaths.size > 0) {
          return true;
        }
        return false;
      };

      const isExcludedBySettings = (relativePath: string): boolean => {
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
      };

      const scanDirectory = async (
        dirUri: vscode.Uri,
        relativePath: string = "",
        directories: string[] = [],
      ) => {
        try {
          const items = await vscode.workspace.fs.readDirectory(dirUri);

          for (const [name, type] of items) {
            if (type === vscode.FileType.Directory && !name.startsWith(".")) {
              const childUri = vscode.Uri.joinPath(dirUri, name);

              const itemRelativePath = relativePath
                ? path.join(relativePath, name)
                : name;

              const isIgnored = await isIgnoredByGit(childUri);
              const isExcluded = isExcludedBySettings(itemRelativePath);

              if (isIgnored || isExcluded) {
                console.log(`Skipping ${itemRelativePath} due to exclusion`);
                continue;
              }

              directories.push(itemRelativePath);
              await scanDirectory(childUri, itemRelativePath, directories);
            }
          }
        } catch (error) {
          console.error(`Error scanning directory ${dirUri.fsPath}:`, error);
        }
      };

      for (const folder of workspaceFolders) {
        const cacheKey = folder.uri.toString();
        const cached = directoryCache.get(cacheKey);
        const now = Date.now();
        const config = vscode.workspace.getConfiguration("vstofolder");
        const cacheValidDurationMinutes = config.get<number>(
          "cacheValidationDuration",
          60,
        );
        const cacheValidDuration = cacheValidDurationMinutes * 60 * 1000;

        if (
          cached &&
          cacheValidDurationMinutes > 0 &&
          now - cached.timestamp < cacheValidDuration
        ) {
          allDirectories.push(...cached.directories);
        } else {
          const directories: string[] = [];
          await scanDirectory(folder.uri, "", directories);

          directoryCache.set(cacheKey, {
            directories: directories,
            timestamp: now,
          });

          allDirectories.push(...directories);
        }
      }

      if (allDirectories.length === 0) {
        vscode.window.showInformationMessage("No directories found");
        return;
      }

      const selectedFolder = await vscode.window.showQuickPick(
        allDirectories.sort(),
        {
          title: "Find Folder",
          placeHolder: "Select a folder to navigate to",
          canPickMany: false,
        },
      );

      if (selectedFolder) {
        const workspaceFolder = workspaceFolders[0];
        const folderUri = vscode.Uri.joinPath(
          workspaceFolder.uri,
          selectedFolder,
        );
        await vscode.commands.executeCommand("workbench.view.explorer");
        await vscode.commands.executeCommand("revealInExplorer", folderUri);
      }
    },
  );

  context.subscriptions.push(findFolderDisposable);

  vscode.workspace.onDidChangeWorkspaceFolders(
    () => {
      directoryCache.clear();
      initializeFileWatcher(context);
    },
    null,
    context.subscriptions,
  );

  vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration("vstofolder.cacheValidationDuration")) {
        directoryCache.clear();
      }
    },
    null,
    context.subscriptions,
  );
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
  directoryCache.clear();
}
