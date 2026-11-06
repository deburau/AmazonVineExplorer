# Amazon Vine Explorer - Development Guide for AI Agents

> **Wechsel auf ein anderes System?** Siehe [HANDOVER.md](HANDOVER.md) – dort steht,
> wie der Projektstand auf ein neues System (z. B. Ubuntu/Proxmox) mitgenommen wird.

## Project Overview

Amazon Vine Explorer is a Tampermonkey/Greasemonkey userscript that enhances the Amazon Vine website with advanced product tracking, database management, and UI improvements. This is a pure JavaScript project using ES6+ features with extensive DOM manipulation and IndexedDB storage.

**Technology Stack:**
- Language: JavaScript (ES6+, no TypeScript)
- Environment: Browser userscript (Tampermonkey/Greasemonkey)
- Storage: IndexedDB + Tampermonkey storage APIs
- Testing: None (manual testing only)
- Linting: ESLint 9.x with flat config
- Formatting: Prettier 3.x (configuration in `.prettierrc`)

## Development Commands

### Formatting and linting
```bash
# Format all sources with Prettier (the project style)
npm run format

# Check the formatting without changing anything
npm run format:check

# Run ESLint on all JavaScript files
npm run lint

# Fix the auto-fixable ESLint issues
npm run lint -- --fix

# Both checks at once (this is what CI should run)
npm run check
```

### Code quality gates
`eslint.config.mjs` defines warnings that keep the code from growing further. The
limits are set just above the current maximum of the existing code, so they do not
report anything today:

| Rule | Limit | Purpose |
|------|-------|---------|
| `complexity` | 20 | Branches per function |
| `max-lines-per-function` | 150 | Length of a function (comments and blank lines are ignored) |
| `max-statements` | 80 | Statements per function |
| `max-depth` | 5 | Nesting level of blocks |
| `prefer-const` | - | `let` that is never reassigned |

The rules are warnings, so `npm run lint` stays green. `npm run lint:strict` fails
on warnings and is meant for a later cleanup, not for the daily workflow.

**Exception:** The complexity of `vineFetch()` in `vine_fetch.js` is above the
limit. The function handles three kinds of requests and every kind needs its own
error handling. Splitting it would change the order of the response hooks, which
is relevant for the behaviour of the page, so the warning is suppressed with an
`eslint-disable` comment and a note.

**Never run a formatter on the markdown files** - the documentation is written by
hand and the changelog would be reflowed without any benefit. `*.md` is therefore
listed in `.prettierignore`.

### Testing
**Note:** This project has no automated browser tests. The behaviour of the
userscript is tested manually by:
1. Installing the userscript in Tampermonkey/Greasemonkey
2. Navigating to Amazon Vine websites
3. Verifying functionality works as expected

The **refactorings** are checked automatically, because a refactoring must not
change the behaviour. See the section "Verifying a refactoring".

## Git Workflow and Release Rules

### Branches
- `main` is the branch that is published to the users (see `@updateURL`/`@downloadURL`).
  **Never push to `main` without the explicit request of the maintainer.**
- Development happens in the `dev-*` branches (e.g. `dev-0.13.0`). Pushing to a `dev-*`
  branch is allowed without asking.
- The `@updateURL`/`@downloadURL` in `VineExplorer.user.js` deliberately point to `main`,
  so that the dev branches can be tested without affecting the other users.

### Versioning and Changelog
- Every user visible change gets a new version number in the `@version` line of
  `VineExplorer.user.js` (patch level, e.g. `0.13.0` -> `0.13.1`).
- Every change gets an entry in the `Changelog Deburau` section of `README.md`.
  The heading is `##### [YYYY-MM-DD] - Version <version>` followed by a short bullet list.
- The entries of the patch versions of a development branch are consolidated
  into one entry, that describes the final state. The intermediate steps are not
  interesting for the users.
- **The entries describe only what the users notice.** The internal
  implementation (the names of the fields, the version of the database, the
  names of the functions, the steps of a migration) does not belong into the
  changelog. A fix is described by its symptom, e.g. "the script did not
  start, if the database was created with an older version of AVE".
- A release consolidates all the entries of the patch versions of a minor
  version into one entry of the new minor version (e.g. all entries of
  `0.12.1.1` to `0.12.1.49` become one entry of `0.13.0`).
- Commit messages follow the pattern `type(scope): short description`
  (e.g. `fix(settings): read the settings if they are stored as a JSON string`).

### Working Style (important)
- Work **step by step: one single change at a time**. Do not bundle several fixes into
  one commit.
- After each step the maintainer tests the change manually in the browser and gives the
  feedback. Wait for that feedback before starting the next step.
- Keep `AGENTS.md` up to date: if a rule, a convention or the project structure changes,
  update this file in the same commit.

### Verifying a refactoring

A refactoring must not change the behaviour. Because the order of the side
effects is relevant, the behaviour is not checked by reading the code but by
comparing the old and the new implementation:

1. **Before** the refactoring, freeze the current state as the baseline:
   ```bash
   npm run verify:baseline
   ```
   This writes the current git commit into `scripts/verify/baselines.json`.

2. Make the refactoring.

3. Run the verifications:
   ```bash
   npm run verify
   ```
   Every script compares the baseline with the current working tree and reports
   the differences of the side effects (local storage accesses, database
   accesses, created DOM, calls of the other functions).

4. If the refactoring was correct, the result is "all scenarios are identical".

The baseline is only used for the comparison, it is never part of the build.

| Script | Compares |
|--------|----------|
| `verify_scan.js` | The local storage accesses of the background scan over seven scenarios |
| `verify_db_helpers.js` | The database accesses of `cleanUpDatabase()` and the marking of the products |
| `verify_settings_ui.js` | The created DOM of all nine setting types |
| `verify_new_items.js` | The notifications, the badge and the page title of the new entries (`processNewItems()`) |
| `verify_init.js` | The created DOM and the calls of the page initialisation |
| `verify_details_on_favorite.js` | The requests of the price details when a product is marked as favorite |
| `verify_site_detection.js` | The detection of the Vine pages against a table of 16 URLs |

The table names the verifications that guard a **refactoring**. Six of the 20 scripts
compare as described above, the other fourteen are **feature tests** that check the
current behaviour against expected values: `verify_site_detection.js`,
`verify_search.js`, `verify_keyword_conditions.js`, `verify_gotify_priority.js`,
`verify_left_side_buttons.js`,
`verify_keyword_order.js`,
`verify_match_lines.js`, `verify_category_load.js`, `verify_category_tree.js`,
`verify_settings_categories.js`, `verify_tax_prizes.js`, `verify_turbo_scan.js`,
`verify_fast_scan_interval.js` and `verify_request_delay.js`. The **complete list** with the number of the test cases and
what each script checks is in `docs/STAND.md`; `npm run verify` runs all of them.

**NOTE:** `verify_site_detection.js` is the only script that does not compare an
old with a new implementation. It checks the current behaviour against expected
values, because the support for the language segment of the URL is a change of
the behaviour and not a refactoring.

**NOTE:** A new verification needs the same structure: a `vm` sandbox with mocked
browser APIs, a list of the function names of the old and the new version and a
comparison of the side effects. The shared helpers are in
`scripts/verify/lib/verify_helpers.js`.

### Screenshots
- The maintainer creates screenshots with ShareX and pastes the **file path** into the chat.
  A pasted path is text, not an image. To see the screenshot, read the file with the `read`
  tool (it supports png, jpg, gif, webp and bmp).
- Screenshots are usually stored outside the repository. Do not commit them.
  The folder `.unotes/` in the repository is in the `.gitignore` and can be used
  as a place for them.

### Pushing
- `git push origin dev-<version>` is allowed without asking.
- `git push origin main` requires an explicit request.

## Code Style Guidelines

### Naming Conventions
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `AVE_VERSION`, `DATABASE_NAME`)
- **Classes**: `PascalCase` (e.g., `Product`, `DB_HANDLER`, `SETTINGS_DEFAULT`)
- **Functions**: `camelCase` (e.g., `parseTileData`, `createButton`)
- **Variables**: `camelCase` with underscore prefixes for private-like variables (e.g., `_currProd`, `_maxLoops`)
- **Global Variables**: Prefix with `AVE_` or descriptive names (e.g., `AVE_IS_THIS_SESSION_MASTER`)

### Import/Module Patterns
- Uses Tampermonkey `@require` directives for dependencies
- No ES6 modules or CommonJS imports/exports
- Global scope sharing between required files
- All code shares the same global namespace
- The verification scripts under `scripts/verify/` are Node.js programs and use
  CommonJS, they run outside of the browser

### Adding a new global function

A new top level function in one of the project files has to be declared twice,
because all files share one global namespace:

1. In the `/* exported ... */` comment at the top of the file (for the linter)
2. In `eslint.config.mjs` in the list of the file it is declared in (so that the
   other files know the name)

```javascript
// VineExplorer.user.js
/* exported myNewFunction */
function myNewFunction() { ... }

// eslint.config.mjs
const mainFile = [ ..., 'myNewFunction' ];
```

### Code Organization
```javascript
// Function structure with comprehensive JSDoc
/**
 * @param {string} selector querySelector
 * @param {function} cb Callback Function
 * @param {object} [altDocument] Alternative document root
 * @param {number} [timeout] Timeout in milliseconds (default: 10000)
 * @returns {Promise<Element>}
 */
async function waitForHtmlElement(selector, cb, altDocument = document, timeout = 10000) {
    // Implementation
}
```

### Comment Style
All comments are written in **English**, also the ones in the German user
interface. The rules for the different kinds of comments:

| Kind | Format | Example |
|------|--------|---------|
| Description of a function | JSDoc `/** ... */` above the function | `/** Creates the tile of a product. */` |
| Important information in the code | `// NOTE: ...` | `// NOTE: The URL is relative and has to be resolved.` |
| A known problem that is not fixed | `// KNOWN: ...` | `// KNOWN: The document body is not always available.` |
| A normal explanation | `// ...` | `// The badge shows the number of new products.` |
| A CSS rule in a template literal | `/* ... */` | `/* Hide the tooltip content by default */` |

**NOTE:** In CSS `//` is **not** a comment. A line that starts with `//` makes the
browser discard the whole rule of the block, without any error message. The
comments of a CSS block therefore have to use the CSS syntax `/* ... */`. The
script `scripts/check_css_syntax.js` checks that and is part of `npm run check`.

**NOTE:** Every setting of `SETTINGS_USERCONFIG_DEFINES` needs a label and a
description in every language of the `I18N`. The key of the setting has to be
spelled the same way in all three places. It is checked as well that every
category of the texts (e.g. `settings`) has the same keys in every language,
because `translate()` falls back to the text of the caller when a translation is
missing. The script `scripts/check_settings_keys.js` checks that and is part of
`npm run check`.

**NOTE:** Every key that AVE writes to the `localStorage` has to be listed in
`AVE_LOCAL_STORAGE_KEYS` in `globals.js`. `clearAVEState()` removes exactly this
list, it is used by the reset of the settings and by the button that deletes the
database. A missing key would survive both, e.g. the scan would continue at the
page where it stopped although the database is empty. The script
`scripts/check_state_keys.js` checks that and is part of `npm run check`.

A function whose purpose is not obvious **must** have a JSDoc block that
explains what it does, what the parameters are and what it returns. A
comment that explains *why* something is done in that way is more valuable
than one that repeats *what* the code does.

### Error Handling Patterns
- **Always use try-catch** for async operations and JSON parsing
- **Provide descriptive error messages** with context
- **Implement timeout handling** for DOM operations (default: 10 seconds)
- **Use graceful degradation** - return null or default values on failure
- **Log appropriately** using the debug logging system (levels 0-15)

```javascript
try {
    const jsonData = await readFile(file);
    // Process data
    return jsonData;
} catch (error) {
    console.error('Error importing data:', error);
    alert(`Error importing data: ${error}`);
    return null;
}
```

## Architecture Patterns

### Database Operations
- Always use the `DB_HANDLER` class for IndexedDB operations
- Use async/await patterns for all database calls
- Database operations return Promises that resolve to data or null
- The database is versioned (`DATABASE_VERSION` in `globals.js`). Every new
  field of the products needs a new version and a migration in the upgrade of
  the database (`onupgradeneeded` in `class_db_handler.js`). The migration of
  the version 5 is `migrateProductToVersion5()`. The migration has to run
  inside the transaction of the upgrade, otherwise the changes are not written.

```javascript
// Correct pattern
try {
    const product = await DB_HANDLER.getProduct(asin);
    if (product) {
        // Process product
    }
} catch (error) {
    console.error('Database error:', error);
}
```

### UI Component Creation
- Use factory functions for creating UI elements
- Follow the event-driven patterns for component communication
- Use `waitForHtmlElement` utilities for DOM manipulation timing

```javascript
// Create button with proper event handling
const button = createButton({
    text: 'Click Me',
    onClick: (event) => {
        // Handle click
    }
});
```

### Settings Management
- Access settings through the global `SETTINGS` object
- Use `loadSettings()` and `saveSettings()` for persistence
- Define new settings in the configuration arrays

```javascript
// Access settings
const settingValue = SETTINGS.some_setting;

// Update and save
SETTINGS.some_setting = newValue;
await saveSettings();
```

### Network Requests
- Use the `vineFetch` wrapper for all HTTP requests
- Handle timeouts and errors appropriately
- Respect rate limiting for Amazon API calls

```javascript
try {
    const response = await vineFetch({
        url: apiUrl,
        method: 'GET',
        timeout: 10000
    });
    // Process response
} catch (error) {
    console.error('Network error:', error);
}
```

## File Structure and Responsibilities

### Core Files
- **`VineExplorer.user.js`** - Main entry point, orchestrates all functionality
- **`globals.js`** - Global constants, settings definitions, utility functions
- **`class_db_handler.js`** - IndexedDB database management class
- **`class_product.js`** - Product data model
- **`vine_fetch.js`** - Enhanced fetch wrapper for API calls
- **`i18n.js`** - Translations

### Tooling Files
- **`.prettierrc`** - Project style (print width 140, 4 spaces, single quotes)
- **`.prettierignore`** - Keeps the formatter away from the markdown files and the local notes
- **`eslint.config.mjs`** - Linter config and the list of the globals of every file
- **`scripts/verify/`** - The verification scripts for the refactorings (Node.js)
- **`scripts/verify/baselines.json`** - The git commit that every verification compares against

### Key Patterns to Follow

1. **Event-Driven Architecture**: Use `ave_eventhandler` for component communication
2. **Session Management**: Multi-tab coordination with master/slave pattern
3. **Background Processing**: Automated scanning with rate limiting
4. **Infinite Scroll**: Dynamic content loading with buffering
5. **Settings System**: Dynamic UI generation from configuration

### Init Structure

The initialisation of the page is split into small functions, one per
responsibility:

| Function | Responsibility |
|----------|----------------|
| `init()` | Starts the initialisation and calls the other functions |
| `initTileParsing()` | Parses the tiles of the page and starts the auto scan |
| `initNavigationButtons()` | Adds the buttons for the product sites |
| `initSearchBar()` | Adds the search bar for the products |
| `initPagination()` | Replaces the "next page" button of the pagination |

The helper script `scripts/verify/verify_init.js` compares the created DOM, the
database accesses and the calls of the old and the new implementation in four
scenarios (normal page, empty page, running auto scan and subpage request).

### Background Scan Structure

The background scan is split into small functions, one per responsibility. The
state that has to survive the single iterations of the scan loop is kept in a
`BackgroundScanState` object:

| Function | Responsibility |
|----------|----------------|
| `initBackgroundScan()` | Starts the scan and the pagination wait loop |
| `initBackgroundScanStorage()` | Writes the initial values to the local storage |
| `getBackgroundScanStageZeroSites()` | The queues of the first stage |
| `scanLoop()` | The endless loop: it waits and then makes one step |
| `scanStepBackground()` | One step: one page of the stage that is due |
| `getScanDelay()` | The waiting time between two pages |
| `getFastScanState()` | Reads if a fast scan is running or has to be started |
| `startFastScan()` | Remembers the position and sets the scan to its beginning |
| `prepareFastScan()` | Decides if a fast scan is started |
| `prepareScanIteration()` | Determines the stage and the sub stage |
| `scanStageZero()` … `scanStageIdle()` | The five stages of the scan |
| `backgroundScanFinished()` | Stores the state and starts the next iteration |
| `handleFastScanFinished()` | Handles the end of an iteration during a fast scan |
| `shouldStopFastScan()` | Decides if the fast scan has to be stopped |
| `stopFastScan()` | Restores the values of the background scan and stops the fast scan |
| `notifyAboutProductDrop()` | Sends the notification about a possible product drop |
| `formatDuration()` | Formats a duration for the screen text |

**NOTE:** The scan must be verified with a comparison, because a change of the
order of the local storage accesses changes the behaviour of the scan. The
helper script `scripts/verify/verify_scan.js` runs the old and the new implementation
in a sandbox with mocked browser APIs and compares the resulting local storage
accesses step by step. It covers seven scenarios, among them the start of a fast
scan and the three reasons why a fast scan is stopped.

### Project State

The current state of the project is documented in `docs/STAND.md`. It holds the
branch, the version, the open points and the procedure of the verifications. It
is the place to look first, because the conversation can be compacted and the
details of the chat would be lost.

## Development Best Practices

### When Adding New Features
1. **Define settings** in the appropriate configuration arrays
2. **Add global functions** to `globals.js` if they're utilities
3. **Use existing patterns** for UI creation and event handling
4. **Implement comprehensive error handling** with try-catch
5. **Add JSDoc documentation** for all public functions
6. **Test across different Amazon Vine pages** and browser environments

### When Modifying Existing Code
1. **Preserve existing patterns** and naming conventions
2. **Maintain backward compatibility** with settings and data
3. **Update global variable declarations** in `eslint.config.mjs` if adding new globals
4. **Test session management** features when modifying multi-tab behavior

### Performance Considerations
- **Debounce DOM operations** to prevent layout thrashing
- **Use requestAnimationFrame** for visual updates
- **Implement proper cleanup** for event listeners and observers
- **Batch database operations** where possible
- **Respect Amazon's rate limits** to avoid being blocked

## Debugging and Troubleshooting

### Debug Logging
The project uses a multi-level debug logging system:
```javascript
// Set debug level (0-15, higher = more verbose)
console.log(`[${logLevel}] Your message here`);
```

### Common Issues
- **Race conditions**: Use `waitForHtmlElement` for DOM timing
- **Database locks**: Ensure proper transaction handling
- **Session conflicts**: Test multi-tab scenarios
- **API rate limits**: Implement proper delays between requests

### Testing Checklist
- [ ] Userscript loads without errors
- [ ] Settings panel opens and saves correctly
- [ ] Database operations work (add/edit/delete products)
- [ ] UI elements appear on correct pages
- [ ] Event handlers fire properly
- [ ] Multi-tab session management works
- [ ] Background scanning functions correctly
- [ ] Error handling shows user-friendly messages

## Important Notes

- **This is a userscript project** - code runs in the browser context on Amazon Vine pages
- **No build process** - files are deployed directly
- **Global scope is shared** between all required files
- **Amazon's DOM changes frequently** - robust selectors and timing are essential
- **Cross-origin requests** are handled through Tampermonkey APIs
- **LocalStorage is avoided** in favor of Tampermonkey storage for cross-browser compatibility

### The language segment of the URL

Amazon can put a language segment in front of the path of a page, e.g.
`https://www.amazon.de/-/de/vine/vine-items` or `https://www.amazon.de/-/en/vine/vine-items`.
The segment depends on the language settings of the browser, Firefox uses it more
often than Chrome. It is **not** part of the page structure.

Every check of the path has to ignore it:

- `aveStripLocalePrefix(pathname)` in `globals.js` removes it from a path.
  `SITE_IS_VINE` and `SITE_IS_SHOPPING` use the cleaned path.
- `aveGetVineBaseUrl()` in `VineExplorer.user.js` returns the base URL of the
  Vine pages **with** the segment, so that the next pages are loaded in the same
  language as the current one.
- `detectCurrentPageType()` uses the cleaned path.

A check of the path that forgets the segment makes the script inactive on the
affected pages. `scripts/verify/verify_site_detection.js` guards against that.

When working on this codebase, always prioritize stability and graceful error handling, as the userscript runs in production environments on live Amazon pages.