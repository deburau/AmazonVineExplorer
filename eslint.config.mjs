import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {files: ["**/*.js"], languageOptions: {sourceType: "commonjs"}},
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        DB_HANDLER: 'writable',
        Product: 'readonly',
        saveAs: 'readonly',
        GM_getValue: 'readonly',
        GM_setValue: 'readonly',
        GM: 'readonly',
        unsafeWindow: 'readonly',
        AVE_VERSION: 'readonly',
        AVE_TITLE: 'readonly',
        SECONDS_PER_DAY: 'readonly',
        SECONDS_PER_WEEK: 'readonly',
        SITE_IS_VINE: 'readonly',
        SITE_IS_SHOPPING: 'readonly',
        AVE_SESSION_ID: 'readonly',
        AVE_IS_THIS_SESSION_MASTER: 'writable',
        INIT_AUTO_SCAN: 'readonly',
        AUTO_SCAN_IS_RUNNING: 'readonly',
        AUTO_SCAN_PAGE_CURRENT: 'readonly',
        AUTO_SCAN_PAGE_MAX: 'readonly',
        PAGE_LOAD_TIMESTAMP: 'readonly',
        DATABASE_NAME: 'readonly',
        DATABASE_OBJECT_STORE_NAME: 'readonly',
        DATABASE_VERSION: 'readonly',
        ave_eventhandler: 'readonly',
        SETTINGS: 'readonly',
        SETTINGS_USERCONFIG_DEFINES: 'readonly',
        addBranding: 'readonly',
        fastStyleChanges: 'readonly',
        loadSettings: 'readonly',
        toTimestamp: 'readonly',
        toUnixTimestamp: 'readonly',
        unixTimeStamp: 'readonly',
        waitForHtmlElmement: 'readonly', // Typo from source
        waitForHtmlElementPromise: 'readonly',
        PAGETYPE: 'readonly',
        exportDatabase: 'readonly',
        importDatabase: 'readonly',
        GM_info: 'readonly',
        initBackgroundScan: 'readonly',
        database: 'readonly'
      }
    }
  },
  pluginJs.configs.recommended,
];