# Changelog

All notable changes to Amazon Vine Explorer will be documented in this file.

## [0.11.31] - 2026-02-06

### Critical Fixes
- Fixed `pageination` → `pagination` typo (5 occurrences)
- Fixed `cb` undefined error in class_db_handler.js:134
- Refactored async Promise executor anti-pattern to clean async/await
- Fixed `ave` undefined race condition → `unsafeWindow.ave`
- Added missing ESLint globals (ave, getCountry, vineFetch, database)
- Fixed DB_HANDLER self-assignment error

### Bug Fixes
- Add try-catch wrapper around all JSON.parse() calls (3 locations)
- Add null checks before DOM manipulation (4 locations)
- Fixed icon parameter undefined error (VineExplorer.user.js:2851)

### Code Cleanup
- Removed unused constants: SECONDS_PER_DAY, SECONDS_PER_WEEK, INIT_AUTO_SCAN, AUTO_SCAN_IS_RUNNING, AUTO_SCAN_PAGE_*, PAGE_LOAD_TIMESTAMP, DATABASE_OBJECT_STORE_NAME, DATABASE_VERSION
- Removed unused function addOverlays() (~63 lines)
- Fixed ESLint config duplicates (loadSettings, saveSettings, unixTimeStamp)
- Prefixed unused parameters with underscore (_reject, cursorPosition, etc.)

### Improvements
- All JavaScript syntax validated successfully
- ESLint errors reduced: 53 → 29 (-45%)
- No runtime errors or parsing errors
- Robust error handling for JSON operations
- Safe DOM manipulation with null checks

### Files Changed
- VineExplorer.user.js (174 lines)
- class_db_handler.js (2 lines)
- eslint.config.mjs (6 lines)
- globals.js (48 lines)

---

## [0.11.30.5] - Previous Release

### Previous changes documented in commit history