# Change Log

All notable changes to the "vstofolder" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.1] - 2025-08-16

### Improved
- **Cache Optimization**: When workspace folders are added or removed, only affected cache entries are updated instead of clearing the entire cache, providing faster response times

## [1.2.0] - 2025-08-16

### Changed
- **Multi-workspace Display**: Workspace folder names now appear as the first element of directory paths (e.g., `workspace-name/src/components`) for better navigation clarity when working with multiple workspace folders

## [1.1.0] - 2025-01-27

### Added
- **Windsurf IDE Support**: Full compatibility with Windsurf IDE (Codeium's AI-powered VS Code fork)
- Environment detection for VS Code, Windsurf, and Cursor
- New configuration option `vstofolder.enableDetailedLogging` for debugging purposes
- Windsurf-specific documentation (WINDSURF.md)
- Enhanced logging with environment context
- Improved test coverage for multi-environment support

### Changed
- Updated package.json to include Windsurf engine compatibility
- Enhanced README with Windsurf compatibility information
- Optimized logging output for better performance in different environments
- Added keywords for better discoverability in extension marketplaces

### Technical
- Added environment detection in extension activation
- Updated FolderFinder constructor to accept environment parameter
- Improved error logging with environment context
- Added comprehensive tests for environment detection

## [1.0.0] - 2025-01-27

### Added
- Initial release with core folder finding functionality
- Quick folder navigation through searchable interface
- Smart filtering with git-ignore and VS Code exclude settings support
- Performance-optimized caching system
- Explorer integration for folder navigation