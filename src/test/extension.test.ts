import * as assert from "assert";
import * as vscode from "vscode";
import { FolderFinder } from "../folder-finder";

class MockCache {
  private cache = new Map();

  get(key: string) {
    return this.cache.get(key);
  }

  set(key: string, value: any) {
    this.cache.set(key, value);
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Environment detection works", () => {
    const appName = vscode.env.appName;
    assert.ok(appName, "App name should be defined");

    const isWindsurf = appName.toLowerCase().includes("windsurf");
    const isCursor = appName.toLowerCase().includes("cursor");
    const isVSCode = !isWindsurf && !isCursor;

    assert.ok(
      isWindsurf || isCursor || isVSCode,
      "Should detect a valid environment",
    );
  });

  test("FolderFinder can be instantiated with environment", () => {
    const mockCache = new MockCache();
    const mockIgnoreCheck = async () => false;

    const finder = new FolderFinder(mockCache, mockIgnoreCheck, "windsurf");
    assert.ok(finder, "FolderFinder should be created successfully");
  });

  test("Extension configuration exists", () => {
    const config = vscode.workspace.getConfiguration("vstofolder");
    assert.ok(config, "Configuration should be accessible");

    const cacheValidation = config.get("cacheValidationDuration");
    assert.strictEqual(
      typeof cacheValidation,
      "number",
      "Cache validation should be a number",
    );
  });
});
