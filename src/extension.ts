import * as vscode from "vscode";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const findFolderDisposable = vscode.commands.registerCommand(
    "vstofolder.FindFolder",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder is open");
        return;
      }

      const directories: string[] = [];

      const scanDirectory = async (
        dirUri: vscode.Uri,
        relativePath: string = "",
      ) => {
        try {
          const items = await vscode.workspace.fs.readDirectory(dirUri);

          for (const [name, type] of items) {
            if (type === vscode.FileType.Directory && !name.startsWith(".")) {
              const itemRelativePath = relativePath
                ? path.join(relativePath, name)
                : name;

              directories.push(itemRelativePath);

              const childUri = vscode.Uri.joinPath(dirUri, name);
              await scanDirectory(childUri, itemRelativePath);
            }
          }
        } catch (error) {
          console.error(`Error scanning directory ${dirUri.fsPath}:`, error);
        }
      };

      for (const folder of workspaceFolders) {
        await scanDirectory(folder.uri);
      }

      if (directories.length === 0) {
        vscode.window.showInformationMessage("No directories found");
        return;
      }

      const selectedFolder = await vscode.window.showQuickPick(
        directories.sort(),
        {
          title: "Find Folder",
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
}

export function deactivate() {}
