# VS To Folder

A VS Code extension that provides quick navigation to any folder in your workspace through a searchable quick pick interface.

## Features

- **Quick Folder Navigation**: Instantly find and navigate to any folder in your workspace
- **Smart Filtering**: Respects VS Code's `files.exclude` and `search.exclude` settings
- **Git Integration**: Automatically excludes git-ignored directories
- **Performance Optimized**: Intelligent caching system to handle large workspaces efficiently
- **Explorer Integration**: Automatically reveals selected folders in the Explorer view

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Find Folder" and select the command
3. Browse or search through the list of available folders
4. Select a folder to navigate to it in the Explorer

Alternatively, you can bind the `vstofolder.FindFolder` command to a keyboard shortcut for even faster access.

## Configuration

The extension contributes the following setting:

- `vstofolder.cacheValidationDuration`: Cache validation duration in minutes (default: 60)
  - Set to `0` to disable caching
  - Higher values improve performance but may not reflect recent filesystem changes
  - Lower values ensure fresh results but may impact performance in large workspaces

## How It Works

The extension scans your workspace folders and builds a directory tree while:
- Excluding hidden directories (starting with `.`)
- Respecting your VS Code exclude settings (`files.exclude` and `search.exclude`)
- Filtering out git-ignored directories when a git repository is detected
- Caching results for improved performance on subsequent searches

## Installation

Install from the VS Code Marketplace or package the extension locally:

```bash
npm install
npm run compile
```

## Requirements

- VS Code 1.103.0 or higher
- Git extension (optional, for git-ignore functionality)

## Known Issues

- Large workspaces may experience initial scanning delays
- Cache invalidation occurs on any file system change, which may impact performance in very active projects

## Release Notes

### 0.0.1

Initial release with core folder finding functionality.

## Contributing

This extension is built with TypeScript and follows VS Code extension development patterns. Contributions are welcome!

## License

See LICENSE file for details.