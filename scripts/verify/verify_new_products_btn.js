/**
 * verify_new_products_btn.js
 *
 * Vergleicht die alte (git HEAD) und die neue Implementierung von
 * updateNewProductsBtn(). Beide werden in einem vm-Kontext mit gemockter
 * Datenbank und gemockten Benachrichtigungen ausgefuehrt.
 *
 * Verglichen werden:
 *   1. die Folge der Datenbank-Zugriffe
 *   2. die ausgeloesten Benachrichtigungen (Desktop, Gotify)
 *   3. die Aenderungen an Badge und Seitentitel
 *   4. die Aenderungen an den Produkten (isNotified, isFav)
 *
 * Usage: node scripts/verify/verify_new_products_btn.js
 */

const vm = require('vm');
const { prepare, finish } = require('./lib/verify_helpers');

const OLD_NAMES = ['updateNewProductsBtn'];
const NEW_NAMES = [
    'updateNewProductsBtn',
    'notifyAboutUnseenItems',
    'searchKeywordsInProducts',
    'checkKeywordsForProduct',
    'notifyAboutNewProducts',
    'stringToRegex'
];

const { old: oldCode, new: newCode } = prepare('verify_new_products_btn.js', OLD_NAMES, NEW_NAMES);

/**
 * Baut eine Sandbox und fuehrt updateNewProductsBtn() aus.
 * @param {object} opts Szenario-Optionen
 */
function run(code, opts) {
    const log = [];
    const _store = {};

    // Mock der Datenbank
    const _entries = (opts.entries || []).map((e) => Object.assign({}, e));
    const _clone = (e) => (e ? Object.assign({}, e) : e);

    const database = {
        getNewEntries() {
            log.push('db.getNewEntries');
            return Promise.resolve(_entries.filter((e) => e.isNew).map(_clone));
        },
        update(entry) {
            log.push(`db.update ${entry.id} isNotified=${entry.isNotified} isFav=${entry.isFav}`);
            const _idx = _entries.findIndex((e) => e.id === entry.id);
            if (_idx >= 0) _entries[_idx] = Object.assign({}, entry);
            return Promise.resolve(true);
        }
    };

    const _badge = {
        style: {},
        innerText: opts.badgeText !== undefined ? opts.badgeText : '0'
    };

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        document: {
            title: opts.title || 'Page Title | Amazon',
            getElementById: (id) => (id === 'ave-new-items-btn-badge' ? _badge : null)
        },
        window: { location: { origin: 'https://www.amazon.de' } },
        localStorage: {
            getItem(k) {
                log.push(`get ${k}`);
                return _store[k] !== undefined ? _store[k] : null;
            },
            setItem(k, v) {
                log.push(`set ${k}`);
                _store[k] = String(v);
            },
            removeItem(k) {
                delete _store[k];
            }
        },
        SETTINGS: {
            DebugLevel: 0,
            UnseenItemsNotificationThreshold: opts.unseenThreshold || 0,
            UnseenItemsNotificationRepitionMinutes: opts.unseenRepition || 0,
            NewItemsNotificationThreshold: 0,
            EnableDesktopNotifikation: !!opts.desktop,
            EnableAutoMarkFavorite: !!opts.autoFavorite,
            GotifyUrl: opts.gotify ? 'https://gotify.example.com' : '',
            DesktopNotifikationKeywords: opts.keywords || [],
            DesktopNotifikationDelay: opts.notifDelay || 0
        },
        database,
        AUTO_SCAN_IS_RUNNING: false,
        newProductWasAdded: opts.newProductWasAdded !== false,
        oldCountOfNewItems: opts.oldCount || 0,
        lastDesktopNotifikationTimestamp: opts.lastNotifTs || 0,
        AVE_VERSION: '1.0',
        gotifyNotification: (msg, prod) => log.push(`gotify: ${String(msg).substring(0, 60)}${prod ? ' [withProd]' : ''}`),
        desktopNotifikation: (title, msg) => log.push(`desktop: ${title} | ${String(msg).substring(0, 60)}`),
        fixProductImageUrl: (u) => u,
        unixTimeStamp: () => 1800000000,
        translate: (cat, key, fallback) => fallback,
        Promise,
        Math,
        JSON,
        String,
        Number,
        parseInt,
        Object,
        Array
    };
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx, { filename: 'newproducts.js' });

    sandbox.updateNewProductsBtn();

    // Die Datenbank-Operationen sind asynchron, es wird auf sie gewartet.
    return new Promise((resolve) =>
        setTimeout(() => {
            resolve({
                log,
                badge: { display: _badge.style.display, innerText: _badge.innerText },
                title: sandbox.document.title,
                entries: _entries
            });
        }, 50)
    );
}

const SCENARIOS = [
    {
        name: 'Keine neuen Eintraege',
        opts: { entries: [] }
    },
    {
        name: 'Neue Eintraege, kein Schwellwert',
        opts: {
            entries: [
                { id: 'p1', description_full: 'Ein neues Produkt', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN1' },
                { id: 'p2', description_full: 'Noch eins', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN2' }
            ]
        }
    },
    {
        name: 'Schwellwert erreicht, Desktop-Notification',
        opts: {
            unseenThreshold: 2,
            desktop: true,
            entries: [
                { id: 'p1', description_full: 'Produkt A', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN1' },
                { id: 'p2', description_full: 'Produkt B', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN2' }
            ]
        }
    },
    {
        name: 'Schwellwert erreicht, Gotify',
        opts: {
            unseenThreshold: 1,
            gotify: true,
            entries: [{ id: 'p1', description_full: 'Produkt A', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN1' }]
        }
    },
    {
        name: 'Keyword-Treffer mit Desktop-Notification',
        opts: {
            desktop: true,
            keywords: ['wichtig'],
            entries: [
                {
                    id: 'p1',
                    description_full: 'Ein WICHTIGES Produkt',
                    isNew: 1,
                    isFav: 0,
                    isNotified: 0,
                    data_asin: 'ASIN1',
                    data_img_url: 'img'
                },
                {
                    id: 'p2',
                    description_full: 'Nichts Besonderes',
                    isNew: 1,
                    isFav: 0,
                    isNotified: 0,
                    data_asin: 'ASIN2',
                    data_img_url: 'img'
                }
            ]
        }
    },
    {
        name: 'Keyword-Treffer, Auto-Favorite',
        opts: {
            autoFavorite: true,
            keywords: ['wichtig'],
            entries: [
                {
                    id: 'p1',
                    description_full: 'Ein WICHTIGES Produkt',
                    isNew: 1,
                    isFav: 0,
                    isNotified: 0,
                    data_asin: 'ASIN1',
                    data_img_url: 'img',
                    link: '/dp/ASIN1'
                }
            ]
        }
    },
    {
        name: 'Keyword als Regex',
        opts: {
            desktop: true,
            keywords: ['/wicht.*produkt/i'],
            entries: [
                {
                    id: 'p1',
                    description_full: 'Ein wichtiges Produkt',
                    isNew: 1,
                    isFav: 0,
                    isNotified: 0,
                    data_asin: 'ASIN1',
                    data_img_url: 'img'
                }
            ]
        }
    },
    {
        name: 'Bereits notifiziertes Produkt wird uebersprungen',
        opts: {
            desktop: true,
            keywords: ['wichtig'],
            entries: [
                {
                    id: 'p1',
                    description_full: 'Ein WICHTIGES Produkt',
                    isNew: 1,
                    isFav: 0,
                    isNotified: 1,
                    data_asin: 'ASIN1',
                    data_img_url: 'img'
                }
            ]
        }
    },
    {
        name: 'Desktop-Notification ueber Anzahl der neuen Produkte',
        opts: {
            desktop: true,
            notifDelay: 60,
            lastNotifTs: 1799999000,
            entries: [{ id: 'p1', description_full: 'Produkt A', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN1' }]
        }
    }
];

(async () => {
    let _allOk = true;
    let _totalDiffs = 0;
    for (const _scenario of SCENARIOS) {
        console.log(`\n########## ${_scenario.name} ##########`);
        const _old = await run(oldCode, _scenario.opts);
        const _new = await run(newCode, _scenario.opts);

        const _diffs = [];
        if (JSON.stringify(_old.log) !== JSON.stringify(_new.log)) _diffs.push('log');
        if (JSON.stringify(_old.badge) !== JSON.stringify(_new.badge)) _diffs.push('badge');
        if (_old.title !== _new.title) _diffs.push('title');
        if (JSON.stringify(_old.entries) !== JSON.stringify(_new.entries)) _diffs.push('entries');

        if (_diffs.length === 0) {
            console.log('identisch');
        } else {
            _allOk = false;
            _totalDiffs += _diffs.length;
            console.log(`ABWEICHUNG in: ${_diffs.join(', ')}`);
            console.log(`  log  alt: ${JSON.stringify(_old.log)}`);
            console.log(`  log  neu: ${JSON.stringify(_new.log)}`);
            console.log(`  badge alt: ${JSON.stringify(_old.badge)} neu: ${JSON.stringify(_new.badge)}`);
            console.log(`  title alt: "${_old.title}" neu: "${_new.title}"`);
            console.log(`  entr alt: ${JSON.stringify(_old.entries)}`);
            console.log(`  entr neu: ${JSON.stringify(_new.entries)}`);
        }
    }

    finish(_allOk, _totalDiffs);
})();
