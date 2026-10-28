import globals from 'globals';
import pluginJs from '@eslint/js';

/**
 * Amazon Vine Explorer - ESLint (flat config)
 *
 * The userscript shares one global scope between all @require files, so every
 * top level name of a file has to be declared as a global for the other files.
 */

/** Names declared in globals.js */
const globalsFile = [
    'AVE_EVENTHANDLER',
    'AVE_IS_THIS_SESSION_MASTER',
    'AVE_SESSION_ID',
    'AVE_TITLE',
    'AVE_VERSION',
    'AUTO_SCAN_IS_RUNNING',
    'AUTO_SCAN_PAGE_CURRENT',
    'AUTO_SCAN_PAGE_MAX',
    'DATABASE_NAME',
    'DATABASE_OBJECT_STORE_NAME',
    'DATABASE_VERSION',
    'INIT_AUTO_SCAN',
    'PAGE_LOAD_TIMESTAMP',
    'SECONDS_PER_DAY',
    'SECONDS_PER_WEEK',
    'SETTINGS',
    'SETTINGS_DEFAULT',
    'SETTINGS_USERCONFIG_DEFINES',
    'SITE_IS_SHOPPING',
    'SITE_IS_VINE',
    'addBranding',
    'ave_eventhandler',
    'delay',
    'fastStyleChanges',
    'findActiveMenuButton',
    'generateSessionID',
    'getCountry',
    'loadSettings',
    'saveSettings',
    'toTimestamp',
    'toUnixTimestamp',
    'unixTimeStamp',
    'waitForHtmlElement',
    'waitForHtmlElementPromise'
];

/** Names declared in i18n.js */
const i18nFile = ['I18N', 'detectLanguage', 't'];

/** Names declared in class_db_handler.js */
const dbHandlerFile = ['DB_HANDLER'];

/** Names declared in class_product.js */
const productFile = ['Product'];

/** Names declared in vine_fetch.js */
const vineFetchFile = [
    'extHelper_LastParentVariant',
    'extHelper_fetchHookKey',
    'extHelper_formatDimensionValue',
    'extHelper_getRequestUrl',
    'extHelper_installRecommendationFetchHook',
    'extHelper_isSpinnerFixEnabled',
    'extHelper_isVineApiRequest',
    'extHelper_pageWindow',
    'extHelper_processedRecommendationResponses',
    'extHelper_repairRecommendationData',
    'extHelper_repairRecommendationResponse',
    'vineFetch'
];

/** Names declared in VineExplorer.user.js */
const mainFile = [
    'PAGETYPE',
    'addAVESettingsMenu',
    'addAveSettingsTab',
    'addDBCleaningSymbol',
    'addDBLoadingSymbol',
    'addLeftSideButtons',
    'addLoadingSymbol',
    'addStyleToTile',
    'addTileEventhandlers',
    'appendInfiniteScrollTiles',
    'aveFixRelativeVineLinks',
    'aveResolveUrl',
    'aveUrlWithPage',
    'backgroundScanFinished',
    'backgroundScanLoop',
    'backGroundTileScanner',
    'btnEventhandlerClick',
    'cleanUpDatabase',
    'colorToHex',
    'completeDelayedInit',
    'componentToHex',
    'createButton',
    'createFavStarElement',
    'createFirstSeenElement',
    'createInfiniteScrollSite',
    'createNavButton',
    'createNewSite',
    'createProductSite',
    'createSettingsKeywordsTableElement',
    'createSettingsMenuElement',
    'createShareElement',
    'createTaxInfoElement',
    'createTileFromProduct',
    'createTimeSeenElement',
    'currentMainPage',
    'database',
    'desktopNotifikation',
    'detectCurrentPageType',
    'exportDatabase',
    'favStarEventhandlerClick',
    'fixProductImageUrl',
    'formatDuration',
    'getContrastColor',
    'getPageinationData',
    'getTilesFromURL',
    'getUrlParameter',
    'getBackgroundScanStageZeroSites',
    'gotifyNotification',
    'handleAutoScan',
    'handleInfiniteScroll',
    'importDatabase',
    'init',
    'initBackgroundScan',
    'initBackgroundScanStorage',
    'initTileEventHandlers',
    'injectDarkMode',
    'markAllCurrentDatabaseProductsAsSeen',
    'markAllCurrentSiteProductsAsSeen',
    'notifyAboutNewProducts',
    'notifyAboutUnseenItems',
    'parseTileData',
    'populateSettingsContainer',
    'prepareFastScan',
    'prepareScanIteration',
    'readFile',
    'reloadPageWithSubpageTarget',
    'requestProductDetails',
    'rgbToHex',
    'rgbaToHex',
    'checkKeywordsForProduct',
    'scanStageCleanup',
    'scanStageEncore',
    'scanStageIdle',
    'scanStageSkip',
    'scanStageZero',
    'searchKeywordsInProducts',
    'shareEventHandlerClick',
    'showAutoScanScreen',
    'showBackgroundScanScreen',
    'sort_by_key',
    'startAutoScan',
    'stickElementToTopScrollEVhandler',
    'stringToRegex',
    'timeAgo',
    'translate',
    'updateAutoScanScreenText',
    'updateBackgroundScanScreenText',
    'updateFavoritesBtn',
    'updateNewProductsBtn',
    'updateTileStyle',
    'stopBackgroundScan'
];

/** Userscript API globals (Tampermonkey) */
const userscriptGlobals = {
    GM_info: 'readonly',
    GM_getValue: 'readonly',
    GM_setValue: 'readonly',
    GM_deleteValue: 'readonly',
    GM_listValues: 'readonly',
    GM_notification: 'readonly',
    GM: 'readonly',
    'GM.xmlHttpRequest': 'readonly',
    GM_xmlhttpRequest: 'readonly',
    GM_setClipboard: 'readonly',
    unsafeWindow: 'readonly',
    saveAs: 'readonly'
};

const allProjectFiles = ['globals.js', 'i18n.js', 'class_db_handler.js', 'class_product.js', 'vine_fetch.js', 'VineExplorer.user.js'];

/**
 * Builds the list of globals that are declared in *other* project files.
 * @param {string} currentFile Name of the file that is linted
 * @returns {string[]} Names of globals declared elsewhere
 */
function foreignGlobals(currentFile) {
    const perFile = {
        'globals.js': globalsFile,
        'i18n.js': i18nFile,
        'class_db_handler.js': dbHandlerFile,
        'class_product.js': productFile,
        'vine_fetch.js': vineFetchFile,
        'VineExplorer.user.js': mainFile
    };
    const result = [];
    for (const file of allProjectFiles) {
        if (file === currentFile) continue;
        result.push(...perFile[file]);
    }
    return result;
}

export default [
    {
        // The local notes folder contains helper scripts and measurements.
        // It is not part of the repository and must not be linted.
        ignores: ['.unotes/**']
    },
    pluginJs.configs.recommended,
    {
        files: allProjectFiles,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...userscriptGlobals
            }
        },
        rules: {
            'no-redeclare': 'off',
            'no-unused-vars': [
                'error',
                {
                    args: 'none',
                    varsIgnorePattern: '^(_|extHelper_)'
                }
            ],
            'no-empty': ['error', { allowEmptyCatch: true }],
            // Quality gates. The limits are set just above the current maximum of the
            // existing code, so they do not report anything today but keep new code
            // from growing further. They are warnings on purpose: the lint run stays
            // green and the existing code is not blocked.
            complexity: ['warn', 20],
            'max-depth': ['warn', 5],
            'max-lines-per-function': [
                'warn',
                {
                    max: 150,
                    skipBlankLines: true,
                    skipComments: true
                }
            ],
            'max-statements': ['warn', 80],
            'prefer-const': ['warn', { destructuring: 'all' }],
            'no-unused-private-class-members': 'warn'
        }
    },
    ...allProjectFiles.map((file) => ({
        files: [file],
        languageOptions: {
            globals: Object.fromEntries(foreignGlobals(file).map((name) => [name, 'readonly']))
        }
    })),
    {
        // globals.js uses a top level "return" to abort the execution inside frames.
        // The "commonjs" sourceType allows that syntax without changing the runtime behaviour.
        // The "exported" comments do not work in that mode, so the shared names are ignored instead.
        files: ['globals.js'],
        languageOptions: {
            sourceType: 'commonjs'
        },
        rules: {
            'no-unused-vars': [
                'error',
                {
                    args: 'none',
                    varsIgnorePattern: `^(${globalsFile.join('|')})$`
                }
            ]
        }
    }
];
