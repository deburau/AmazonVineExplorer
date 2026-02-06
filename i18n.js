'use strict';

const I18N = {
    de: {
        buttons: {
            moreDetails: 'Weitere Details',
            markPageAsSeen: 'Seite als gesehen markieren',
            markAllAsSeen: 'Alle als gesehen markieren',
            backToTop: 'Zum Seitenanfang',
            settingsTab: 'AVE Einstellungen',
        },
        badges: {
            preRelease: 'Vorabversion',
            featured: 'Empfohlen',
        },
        notifications: {
            nothingToSee: 'Hier gibt es nix zu sehen.\nZumindest noch nicht :P',
            copySuccess: 'Text wurde in die Zwischenablage kopiert.',
            copyError: 'Fehler beim Kopieren in die Zwischenablage:',
        },
        share: {
            myFSE: 'Mein FSE',
            availableAll: 'Verfügbar für Alle',
            additional: 'Zusätzliche Artikel',
            page: 'Seite',
        },
        settings: {
            header: (title, version) => `Einstellungen ${title} - Version ${version}`
        }
    },
    en: {
        buttons: {
            moreDetails: 'More Details',
            markPageAsSeen: 'Mark page as seen',
            markAllAsSeen: 'Mark all as seen',
            backToTop: 'Back to top',
            settingsTab: 'AVE Settings',
        },
        badges: {
            preRelease: 'Pre-release',
            featured: 'Featured',
        },
        notifications: {
            nothingToSee: 'Nothing to see here.\nAt least not yet :P',
            copySuccess: 'Text copied to clipboard',
            copyError: 'Error copying to clipboard:',
        },
        share: {
            myFSE: 'My FSE',
            availableAll: 'Available for All',
            additional: 'Additional Items',
            page: 'Page',
        },
        settings: {
            header: (title, version) => `Settings ${title} - Version ${version}`
        }
    }
};

function detectLanguage() {
    const userLang = SETTINGS.UI_LANGUAGE || 'de';
    if (userLang === 'de' || userLang === 'en') return userLang;
    return 'de';
}

const LANG = detectLanguage();

function t(category, key, ...args) {
    if (!I18N[LANG] || !I18N[LANG][category]) {
        console.warn(`Translation missing for category: ${category}`);
        return key || '';
    }
    const message = I18N[LANG][category][key];
    if (!message) {
        console.warn(`Translation missing for key: ${category}.${key}`);
        return key || '';
    }
    if (typeof message === 'function') {
        return message(...args);
    }
    return message;
}