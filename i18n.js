'use strict';
/* exported I18N, detectLanguage, t */
// Flat i18n dictionary for UI strings (DE/EN).
const I18N = {
    de: {
        buttons: {
            moreDetails: 'Weitere Details',
            markPageAsSeen: 'Seite als gesehen markieren',
            markAllAsSeen: 'Alle als gesehen markieren',
            backToTop: 'Zum Seitenanfang',
            settingsTab: 'AVE Einstellungen',
            favorites: 'Favoriten',
            newEntries: 'Neue Einträge'
        },
        badges: {
            preRelease: 'Vorabversion',
            featured: 'Empfohlen'
        },
        notifications: {
            nothingToSee: 'Hier gibt es nix zu sehen.\nZumindest noch nicht :P',
            copySuccess: 'Text wurde in die Zwischenablage kopiert.',
            copyError: 'Fehler beim Kopieren in die Zwischenablage:',
            unseenItemsTitle: (version) => `Amazon Vine Explorer - ${version}`,
            unseenItemsBody: (count) => `Es wurden ${count} neue Eintraege gefunden`
        },
        share: {
            myFSE: 'Mein FSE',
            availableAll: 'Verfügbar für Alle',
            additional: 'Zusätzliche Artikel',
            page: 'Seite:'
        },
        settings: {
            header: (title, version) => `Einstellungen ${title} - Version ${version}`,
            languageLabel: 'Sprache'
        },
        settingsLabels: {
            UI_LANGUAGE: 'Sprache',
            EnableFullWidth: 'Volle Breite aktivieren',
            DarkMode: 'Dark Mode aktivieren (Reload erforderlich)',
            DisableAmazonNavbar: 'Amazon Navbar deaktivieren',
            DisableCategories: 'Kategorien deaktivieren',
            DisableFooter: 'Footer deaktivieren',
            DisableSuggestions: 'Vorschläge deaktivieren',
            DisableBtnPotLuck: 'Button Potluck deaktivieren',
            DisableBtnLastChance: 'Button Last Chance deaktivieren',
            DisableBtnSeller: 'Button Seller deaktivieren',
            EnableTopLogoChange: 'Top-Logo ändern aktivieren',
            EnableBtnAll: 'Button Alle Produkte aktivieren',
            EnablePaginationTop: 'Paginierung oben aktivieren',
            EnableBackgroundScan: 'Background Scan aktivieren',
            EnableInfiniteScrollLiveQuerry: 'Infinite Scroll Live-Query aktivieren',
            EnableInfiniteSpinnerFix: 'Endloses Laden bei Varianten beheben',
            EnableDesktopNotifikation: 'Desktop-Benachrichtigungen aktivieren',
            EnableAutoMarkFavorite: 'Auto-Favorit markieren aktivieren',
            EnableDetailsOnFavorite: 'Preisdetails beim Favorisieren laden',
            EnableCleanupFavorites: 'Favoriten bei Cleanup löschen',
            EnableBtnMarkAllAsSeen: 'Button Alles als gesehen markieren',
            ShowFirstSeen: 'Erst gesehen statt zuletzt gesehen',
            DesktopNotifikationKeywords: 'Desktop-Benachrichtigung Keywords',
            GotifyUrl: 'URL des Gotify-Servers',
            GotifyToken: 'Gotify Anwendungstoken',
            BackGroundScanDelayPerPage: 'Background Scan Min. Delay pro Seite (ms)',
            BackGroundScannerRandomness: 'Background Scan Randomness pro Seite (ms)',
            DesktopNotifikationDelay: 'Desktop-Benachrichtigung Delay (Sek.)',
            SearchBarInputDelay: 'Suchleiste Verzögerung (ms)',
            IdlePeriodAfterScan: 'Wartezeit nach Scan (Min.)',
            HoursBeforeCleanup: 'Stunden bis Cleanup',
            MaxItemsPerPage: 'Maximale Items pro Seite',
            UnseenItemsNotificationThreshold: 'Schwellwert ungesehene Items',
            UnseenItemsNotificationRepitionMinutes: 'Wartezeit ungesehene Items (Min.)',
            NewItemsNotificationThreshold: 'Schwellwert neue Items',
            NewItemsNotificationRepititionMinutes: 'Wartezeit neue Items (Min.)',
            BtnColorNewProducts: 'Button-Farbe Neue Produkte',
            BtnColorNewProductsBadge: 'Badge-Farbe Neue Produkte',
            BtnColorMarkCurrSiteAsSeen: 'Button-Farbe Seite als gesehen',
            BtnColorMarkAllAsSeen: 'Button-Farbe Alles als gesehen',
            BtnColorBackToTop: 'Button-Farbe Nach oben',
            BtnColorUpdateDB: 'Button-Farbe DB aktualisieren',
            BtnColorAllProducts: 'Button-Farbe Alle Produkte',
            BtnColorFavorites: 'Button-Farbe Favoriten',
            BtnColorFavoritesBadge: 'Badge-Farbe Favoriten',
            FavStarColorDefault: 'Farbe Favoritenstern (aus)',
            FavStarColorChecked: 'Farbe Favoritenstern (an)',
            DarkModeBackgroundColor: 'Dark Mode Hintergrundfarbe',
            DarkModeColor: 'Dark Mode Textfarbe',
            DisableFooterShopping: 'Shopping Footer deaktivieren',
            DisableSuggestionsShopping: 'Shopping Vorschläge deaktivieren',
            DebugLevel: 'Debuglevel',
            TITLE_AMAZON_VINE: 'Amazon Vine',
            TITLE_COLORS: 'Farben und Styles',
            TITLE_SHOPPING: 'Amazon Shopping',
            TITLE_DEV: 'Einstellungen für Entwickler und Tester',
            BUTTON_RESET_SETTINGS: 'Einstellungen zurücksetzen',
            BUTTON_DB_EXPORT: 'Datenbank exportieren >>>',
            BUTTON_DB_IMPORT: 'Datenbank importieren <<<',
            BUTTON_DB_DELETE: 'Datenbank löschen'
        },
        settingsDescriptions: {
            UI_LANGUAGE: 'Legt die Sprache der Oberfläche fest.',
            EnableFullWidth: 'Nutzt die volle Breite des Displays.',
            DarkMode: 'Aktiviert den Dark Mode (Neuladen nötig).',
            DisableAmazonNavbar: 'Blendet die Amazon Navbar aus.',
            DisableCategories: 'Blendet die Kategorien aus.',
            DisableFooter: 'Blendet die Fußzeile aus.',
            DisableSuggestions: 'Blendet die Vorschläge aus.',
            DisableBtnPotLuck: 'Blendet den Button PotLuck (FSE) aus.',
            DisableBtnLastChance: 'Blendet den Button Last Chance (VFA) aus.',
            DisableBtnSeller: 'Blendet den Button Seller (ZA) aus.',
            EnableTopLogoChange: 'Ersetzt das Amazon-Logo durch das AVE-Logo.',
            EnableBtnAll: 'Zeigt den Button „Alle Produkte“ an.',
            EnablePaginationTop: 'Zeigt die Paginierung oben an (nur ZA-Seite).',
            EnableBackgroundScan: 'Aktiviert den Scan im Hintergrund.',
            EnableInfiniteScrollLiveQuerry: 'Lädt die Produkte direkt von Amazon statt aus der Datenbank.',
            EnableInfiniteSpinnerFix: 'Behebt fehlerhafte Variantendaten.',
            EnableDesktopNotifikation: 'Benachrichtigt bei neuen Produkten.',
            EnableAutoMarkFavorite: 'Markiert neue Produkte bei Keyword-Treff als Favorit.',
            EnableDetailsOnFavorite: 'Lädt den Preis beim Favorisieren. Beim Scan nicht, sonst sperrt Amazon den Account.',
            EnableCleanupFavorites: 'Entfernt beim Cleanup auch die Favoriten.',
            EnableBtnMarkAllAsSeen: 'Zeigt den Button „Alle als gesehen markieren“ an.',
            ShowFirstSeen: 'Zeigt das Datum des ersten statt des letzten Auftretens.',
            DesktopNotifikationKeywords: 'Keywords für Benachrichtigung und Auto-Favorit.',
            GotifyUrl: 'Adresse des Gotify-Servers, z. B. https://gotify.example.com',
            GotifyToken: 'Authentifizierungs-Token der Gotify-Anwendung.',
            BackGroundScanDelayPerPage: 'Min. Wartezeit pro Seite in Millisekunden.',
            BackGroundScannerRandomness: 'Max. zufällige Wartezeit pro Seite in Millisekunden.',
            DesktopNotifikationDelay: 'Min. Zeit zwischen Benachrichtigungen in Sekunden (0 = aus).',
            SearchBarInputDelay: 'Wartezeit bis zur Suche in Millisekunden.',
            IdlePeriodAfterScan: 'Wartezeit bis zum nächsten Scan in Minuten (0 = sofort).',
            HoursBeforeCleanup: 'Stunden ohne gesehen zu werden bis zum Löschen (0 = sofort).',
            MaxItemsPerPage: 'Maximale Anzahl der Produkte pro Seite.',
            UnseenItemsNotificationThreshold: 'Ab wie vielen ungesehenen Produkten benachrichtigt wird (0 = aus).',
            UnseenItemsNotificationRepitionMinutes: 'Wartezeit zwischen den Benachrichtigungen in Minuten.',
            NewItemsNotificationThreshold: 'Ab wie vielen neuen Produkten benachrichtigt wird (0 = aus).',
            NewItemsNotificationRepitionMinutes: 'Wartezeit zwischen den Benachrichtigungen in Minuten.',
            DisableFooterShopping: 'Blendet die Fußzeile der Shopping-Seite aus.',
            DisableSuggestionsShopping: 'Blendet die Vorschläge der Shopping-Seite aus.',
            BUTTON_RESET_SETTINGS: 'Setzt alle Einstellungen zurück.',
            BUTTON_DB_EXPORT: 'Lädt die Datenbank als Datei herunter.',
            BUTTON_DB_IMPORT: 'Löscht die Datenbank und importiert eine Datei.',
            BUTTON_DB_DELETE: 'Löscht die Datenbank (nur für Entwickler).',
            TITLE_AMAZON_VINE: 'Einstellungen für Amazon Vine',
            TITLE_COLORS: 'Farben und Styles',
            TITLE_SHOPPING: 'Einstellungen für Amazon Shopping',
            TITLE_DEV: 'Einstellungen für Entwickler und Tester',
            BtnColorNewProducts: 'Farbe des Buttons „Neue Einträge“.',
            BtnColorNewProductsBadge: 'Farbe des Badges am Button „Neue Einträge“.',
            BtnColorMarkCurrSiteAsSeen: 'Farbe des Buttons „Seite als gesehen markieren“.',
            BtnColorMarkAllAsSeen: 'Farbe des Buttons „Alle als gesehen markieren“.',
            BtnColorBackToTop: 'Farbe des Buttons „Zum Seitenanfang“.',
            BtnColorUpdateDB: 'Farbe des Buttons „Datenbank aktualisieren“.',
            BtnColorAllProducts: 'Farbe des Buttons „Alle Produkte“.',
            BtnColorFavorites: 'Farbe des Buttons „Favoriten“.',
            BtnColorFavoritesBadge: 'Farbe des Badges am Button „Favoriten“.',
            FavStarColorDefault: 'Farbe des Favoritensterns, wenn nicht ausgewählt.',
            FavStarColorChecked: 'Farbe des Favoritensterns, wenn ausgewählt.',
            DarkModeBackgroundColor: 'Hintergrundfarbe im Dark Mode.',
            DarkModeColor: 'Textfarbe im Dark Mode.',
            DebugLevel: 'Ausgabe in der Konsole: 0 = keine, 15 = alles.'
        },
        settingsPlaceholders: {
            DesktopNotifikationKeywords: 'Gib deine Highlight-Keywords ein, eins pro Zeile, und klick außerhalb'
        }
    },
    en: {
        buttons: {
            moreDetails: 'More Details',
            markPageAsSeen: 'Mark page as seen',
            markAllAsSeen: 'Mark all as seen',
            backToTop: 'Back to top',
            settingsTab: 'AVE Settings',
            favorites: 'Favorites',
            newEntries: 'New Entries'
        },
        badges: {
            preRelease: 'Pre-release',
            featured: 'Featured'
        },
        notifications: {
            nothingToSee: 'Nothing to see here.\nAt least not yet :P',
            copySuccess: 'Text copied to clipboard',
            copyError: 'Error copying to clipboard:',
            unseenItemsTitle: (version) => `Amazon Vine Explorer - ${version}`,
            unseenItemsBody: (count) => `${count} new entries found`
        },
        share: {
            myFSE: 'My FSE',
            availableAll: 'Available for All',
            additional: 'Additional Items',
            page: 'Page:'
        },
        settings: {
            header: (title, version) => `Settings ${title} - Version ${version}`,
            languageLabel: 'Language'
        },
        settingsLabels: {
            UI_LANGUAGE: 'Language',
            EnableFullWidth: 'Enable Full Width',
            DarkMode: 'Enable Dark Mode (reload required)',
            DisableAmazonNavbar: 'Disable Amazon Navbar',
            DisableCategories: 'Disable Categories',
            DisableFooter: 'Disable Footer',
            DisableSuggestions: 'Disable Suggestions',
            DisableBtnPotLuck: 'Disable Button Potluck',
            DisableBtnLastChance: 'Disable Button Last Chance',
            DisableBtnSeller: 'Disable Button Seller',
            EnableTopLogoChange: 'Enable Top Logo Change',
            EnableBtnAll: 'Enable Button All Products',
            EnablePaginationTop: 'Enable Pagination on top',
            EnableBackgroundScan: 'Enable Background Scan',
            EnableInfiniteScrollLiveQuerry: 'Enable Infinite Scroll Live Query',
            EnableInfiniteSpinnerFix: 'Enable Infinite Spinner Fix',
            EnableDesktopNotifikation: 'Enable Desktop Notifications',
            EnableAutoMarkFavorite: 'Enable auto marking product as favorite',
            EnableDetailsOnFavorite: 'Load the price details when a product is marked as favorite',
            EnableCleanupFavorites: 'Also remove favorites when cleaning up products',
            EnableBtnMarkAllAsSeen: 'Enable Button Mark all as seen',
            ShowFirstSeen: 'Show first seen instead of last seen',
            DesktopNotifikationKeywords: 'Desktop Notification Highlight Keywords',
            GotifyUrl: 'URL of the Gotify Server',
            GotifyToken: 'Gotify application token',
            BackGroundScanDelayPerPage: 'Background Scan Per Page Min Delay (ms)',
            BackGroundScannerRandomness: 'Background Scan Randomness per Page (ms)',
            DesktopNotifikationDelay: 'Desktop Notification Delay (Seconds)',
            SearchBarInputDelay: 'Search Bar Input Delay (ms)',
            IdlePeriodAfterScan: 'Idle period after a scan',
            HoursBeforeCleanup: 'Hours before cleanup',
            MaxItemsPerPage: 'Maximum items per page',
            UnseenItemsNotificationThreshold: 'Unseen items notification threshold',
            UnseenItemsNotificationRepitionMinutes: 'Minutes between unseen item notifications',
            NewItemsNotificationThreshold: 'New items notification threshold',
            NewItemsNotificationRepititionMinutes: 'Minutes between new item notifications',
            BtnColorNewProducts: 'Button Color New Products',
            BtnColorNewProductsBadge: 'Button Color New Products Badge',
            BtnColorMarkCurrSiteAsSeen: 'Button Color Mark Current Site As Seen',
            BtnColorMarkAllAsSeen: 'Button Color Mark All As Seen',
            BtnColorBackToTop: 'Button Color Back To Top',
            BtnColorUpdateDB: 'Button Color Update Database',
            BtnColorAllProducts: 'Button Color All Products',
            BtnColorFavorites: 'Button Color Favorites',
            BtnColorFavoritesBadge: 'Button Color Favorites Badge',
            FavStarColorDefault: 'Color Favorite Star unchecked',
            FavStarColorChecked: 'Color Favorite Star checked',
            DarkModeBackgroundColor: 'Dark Mode Background Color',
            DarkModeColor: 'Dark Mode Text Color',
            DisableFooterShopping: 'Disable Footer (Shopping)',
            DisableSuggestionsShopping: 'Disable Suggestions (Shopping)',
            DebugLevel: 'Debug level',
            TITLE_AMAZON_VINE: 'Amazon Vine',
            TITLE_COLORS: 'Colors and Styles',
            TITLE_SHOPPING: 'Amazon Shopping',
            TITLE_DEV: 'Settings for Developers and Testers',
            BUTTON_RESET_SETTINGS: 'RESET SETTINGS TO DEFAULT',
            BUTTON_DB_EXPORT: 'DATABASE EXPORT >>>',
            BUTTON_DB_IMPORT: 'DATABASE IMPORT <<<',
            BUTTON_DB_DELETE: 'DELETE DATABASE'
        },
        settingsDescriptions: {
            UI_LANGUAGE: 'Sets the language of the interface.',
            EnableFullWidth: 'Uses the full width of the display.',
            DarkMode: 'Enables the dark mode (reload required).',
            DisableAmazonNavbar: 'Hides the Amazon navbar.',
            DisableCategories: 'Hides the categories.',
            DisableFooter: 'Hides the footer.',
            DisableSuggestions: 'Hides the suggestions.',
            DisableBtnPotLuck: 'Hides the PotLuck button (FSE).',
            DisableBtnLastChance: 'Hides the Last Chance button (VFA).',
            DisableBtnSeller: 'Hides the Seller button (ZA).',
            EnableTopLogoChange: 'Replaces the Amazon logo with the AVE logo.',
            EnableBtnAll: 'Shows the "All Products" button.',
            EnablePaginationTop: 'Shows the pagination on top (ZA page only).',
            EnableBackgroundScan: 'Enables the scan in the background.',
            EnableInfiniteScrollLiveQuerry: 'Loads the products directly from Amazon instead of the database.',
            EnableInfiniteSpinnerFix: 'Repairs faulty variant data.',
            EnableDesktopNotifikation: 'Notifies about new products.',
            EnableAutoMarkFavorite: 'Marks new products as favorite on a keyword match.',
            EnableDetailsOnFavorite: 'Loads the price when favoriting. Not during the scan, Amazon blocks the account.',
            EnableCleanupFavorites: 'Removes the favorites during the cleanup as well.',
            EnableBtnMarkAllAsSeen: 'Shows the "Mark all as seen" button.',
            ShowFirstSeen: 'Shows the date of the first appearance instead of the last one.',
            DesktopNotifikationKeywords: 'Keywords for the notification and the auto favorite.',
            GotifyUrl: 'Address of the Gotify server, e.g. https://gotify.example.com',
            GotifyToken: 'Authentication token of the Gotify application.',
            BackGroundScanDelayPerPage: 'Minimum wait time per page in milliseconds.',
            BackGroundScannerRandomness: 'Maximum random wait time per page in milliseconds.',
            DesktopNotifikationDelay: 'Minimum time between notifications in seconds (0 = off).',
            SearchBarInputDelay: 'Wait time until the search starts in milliseconds.',
            IdlePeriodAfterScan: 'Wait time until the next scan in minutes (0 = immediately).',
            HoursBeforeCleanup: 'Hours without being seen before it is removed (0 = immediately).',
            MaxItemsPerPage: 'Maximum number of products per page.',
            UnseenItemsNotificationThreshold: 'From how many unseen products a notification is sent (0 = off).',
            UnseenItemsNotificationRepitionMinutes: 'Wait time between the notifications in minutes.',
            NewItemsNotificationThreshold: 'From how many new products a notification is sent (0 = off).',
            NewItemsNotificationRepitionMinutes: 'Wait time between the notifications in minutes.',
            DisableFooterShopping: 'Hides the footer of the shopping page.',
            DisableSuggestionsShopping: 'Hides the suggestions of the shopping page.',
            BUTTON_RESET_SETTINGS: 'Resets all settings.',
            BUTTON_DB_EXPORT: 'Downloads the database as a file.',
            BUTTON_DB_IMPORT: 'Deletes the database and imports a file.',
            BUTTON_DB_DELETE: 'Deletes the database (developers only).',
            TITLE_AMAZON_VINE: 'Settings for Amazon Vine',
            TITLE_COLORS: 'Colors and styles',
            TITLE_SHOPPING: 'Settings for Amazon Shopping',
            TITLE_DEV: 'Settings for developers and testers',
            BtnColorNewProducts: 'Color of the "New Entries" button.',
            BtnColorNewProductsBadge: 'Color of the badge on the "New Entries" button.',
            BtnColorMarkCurrSiteAsSeen: 'Color of the "Mark page as seen" button.',
            BtnColorMarkAllAsSeen: 'Color of the "Mark all as seen" button.',
            BtnColorBackToTop: 'Color of the "Back to top" button.',
            BtnColorUpdateDB: 'Color of the "Update Database" button.',
            BtnColorAllProducts: 'Color of the "All Products" button.',
            BtnColorFavorites: 'Color of the "Favorites" button.',
            BtnColorFavoritesBadge: 'Color of the badge on the "Favorites" button.',
            FavStarColorDefault: 'Color of the favorite star when not selected.',
            FavStarColorChecked: 'Color of the favorite star when selected.',
            DarkModeBackgroundColor: 'Background color in the dark mode.',
            DarkModeColor: 'Text color in the dark mode.',
            DebugLevel: 'Output in the console: 0 = none, 15 = everything.'
        },
        settingsPlaceholders: {
            DesktopNotifikationKeywords: 'Type in your highlight keywords one per line and click outside to submit'
        }
    }
};

/**
 * Resolves the current UI language from the settings, with a safe fallback.
 * @returns {string} The language code ("de" or "en")
 */
function detectLanguage() {
    if (!SETTINGS || typeof SETTINGS.UI_LANGUAGE === 'undefined') {
        return 'de';
    }
    const userLang = SETTINGS.UI_LANGUAGE || 'de';
    if (userLang === 'de' || userLang === 'en') return userLang;
    return 'de';
}

/**
 * Looks up the message of a translation in the current language.
 *
 * The message can be a string or a function that formats the text with the
 * arguments of the caller.
 *
 * @param {string} category The category of the translation (e.g. "buttons")
 * @param {string} key The key of the translation
 * @returns {string|Function|null} The message or null if it does not exist
 */
function lookupTranslation(category, key) {
    const lang = detectLanguage();
    if (!I18N[lang] || !I18N[lang][category]) {
        return null;
    }
    return I18N[lang][category][key] || null;
}

/**
 * Looks up a translation and formats it if the entry is a function.
 *
 * If the translation is missing, the key is returned and a warning is logged.
 *
 * @param {string} category The category of the translation (e.g. "buttons")
 * @param {string} key The key of the translation
 * @param {...any} args The arguments of the formatter function
 * @returns {string} The translated text
 */
function t(category, key, ...args) {
    const lang = detectLanguage();
    if (!I18N[lang] || !I18N[lang][category]) {
        console.warn(`Translation missing for category: ${category}`);
        return key || '';
    }
    const message = lookupTranslation(category, key);
    if (!message) {
        console.warn(`Translation missing for key: ${category}.${key}`);
        return key || '';
    }
    if (typeof message === 'function') {
        return message(...args);
    }
    return message;
}
