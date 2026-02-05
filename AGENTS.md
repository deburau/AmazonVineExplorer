# Amazon Vine Explorer - Development Guide for AI Agents

## Project Overview

Amazon Vine Explorer is a Tampermonkey/Greasemonkey userscript that enhances the Amazon Vine website with advanced product tracking, database management, and UI improvements. This is a pure JavaScript project using ES6+ features with extensive DOM manipulation and IndexedDB storage.

**Technology Stack:**
- Language: JavaScript (ES6+, no TypeScript)
- Environment: Browser userscript (Tampermonkey/Greasemonkey)
- Storage: IndexedDB + Tampermonkey storage APIs
- Testing: None (manual testing only)
- Linting: ESLint 9.x with flat config

## Development Commands

### Linting
```bash
# Run ESLint on all JavaScript files
npx eslint .

# Fix auto-fixable issues
npx eslint . --fix
```

### Testing
**Note:** This project has no automated tests. Testing is done manually by:
1. Installing the userscript in Tampermonkey/Greasemonkey
2. Navigating to Amazon Vine websites
3. Verifying functionality works as expected

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
- **`VineExplorer.user.js`** (3,267 lines) - Main entry point, orchestrates all functionality
- **`globals.js`** (690 lines) - Global constants, settings definitions, utility functions
- **`class_db_handler.js`** (494 lines) - IndexedDB database management class
- **`class_product.js`** (37 lines) - Product data model
- **`vine_fetch.js`** (141 lines) - Enhanced fetch wrapper for API calls

### Key Patterns to Follow

1. **Event-Driven Architecture**: Use `ave_eventhandler` for component communication
2. **Session Management**: Multi-tab coordination with master/slave pattern
3. **Background Processing**: Automated scanning with rate limiting
4. **Infinite Scroll**: Dynamic content loading with buffering
5. **Settings System**: Dynamic UI generation from configuration

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

When working on this codebase, always prioritize stability and graceful error handling, as the userscript runs in production environments on live Amazon pages.