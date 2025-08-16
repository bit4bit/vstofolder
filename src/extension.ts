// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
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

      const scanDirectory = (dirPath: string, relativePath: string = "") => {
        try {
          const items = fs.readdirSync(dirPath);
          items.forEach((item) => {
            const fullPath = path.join(dirPath, item);
            const itemRelativePath = relativePath
              ? path.join(relativePath, item)
              : item;

            try {
              const stats = fs.lstatSync(fullPath);
              if (
                stats.isDirectory() &&
                !stats.isSymbolicLink() &&
                !item.startsWith(".")
              ) {
                directories.push(itemRelativePath);
                scanDirectory(fullPath, itemRelativePath);
              }
            } catch (error) {
              console.error(`Error accessing ${fullPath}:`, error);
            }
          });
        } catch (error) {
          console.error(`Error scanning directory ${dirPath}:`, error);
        }
      };

      workspaceFolders.forEach((folder) => {
        scanDirectory(folder.uri.fsPath);
      });

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
        const fullPath = path.join(workspaceFolder.uri.fsPath, selectedFolder);
        const folderUri = vscode.Uri.file(fullPath);
        await vscode.commands.executeCommand("workbench.view.explorer");
        await vscode.commands.executeCommand("revealInExplorer", folderUri);
      }
    },
  );

  context.subscriptions.push(findFolderDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
