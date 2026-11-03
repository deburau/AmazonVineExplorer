/**
 * verify_details_on_favorite.js
 *
 * Vergleicht die alte (versionierte) und die neue Implementierung des Nachladens
 * der Preisdetails beim Favorisieren eines Produkts.
 *
 * Verglichen werden:
 *   1. die Folge der API-Aufrufe (requestProductDetails)
 *   2. die Folge der Datenbank-Zugriffe
 *   3. der Zustand der Produkte (isFav, isNotified, Preisdetails)
 *
 * Usage: node scripts/verify/verify_details_on_favorite.js
 */

const vm = require('vm');
const { prepare, prepareWithConstants, finish } = require('./lib/verify_helpers');

const OLD_NAMES = ['favStarEventhandlerClick', 'checkKeywordsForProduct', 'stringToRegex'];
const NEW_NAMES = [
    'favStarEventhandlerClick',
    'checkKeywordsForProduct',
    'stringToRegex',
    'loadProductDetailsIfEnabled',
    'requestProductDetailsQueued',
    'processProductDetailsQueue',
    'hasProductDetails',
    // Die Funktion, die die Preise des Produkts liefert.
    'getTaxPrices',
    // Der Keyword-Vergleich und die Funktionen fuer die Preisbedingungen.
    'matchesKeyword',
    'normalizePriceInput',
    'parsePriceCondition',
    'parseKeywordConfig',
    'matchPriceConditions',
    // Die Funktion, die die Details laedt.
    'loadProductDetails',
    // Die Funktion, die die Details aller Varianten eines Elternprodukts laedt.
    'loadProductDetailsOfVariations',
    // Die Funktionen, die die Verzoegerungen zwischen den Requests berechnen.
    'getRandomizedDelay',
    'getVariationRequestDelay',
    'getProductDetailsRequestDelay'
];

const CONSTANT_NAMES = ['PRODUCT_DETAILS_REQUEST_DELAY', 'productDetailsQueue'];

// Die echte requestProductDetails() wird mit extrahiert, damit der Test den
// echten Code prueft und nicht einen Nachbau.
const REQUEST_DETAILS_NAMES = ['requestProductDetails'];

// Die Funktion requestProductDetails() ruft loadProductDetailsOfVariations()
// auf. Die Funktion gibt es erst in der neuen Version, darum wird sie nur dort
// extrahiert und im alten Code durch einen Platzhalter ersetzt.
const VARIATION_NAMES = ['loadProductDetailsOfVariations'];

const { old: oldCode, new: newCode } = prepareWithConstants(
    'verify_details_on_favorite.js',
    OLD_NAMES,
    NEW_NAMES,
    CONSTANT_NAMES,
    'globals.js'
);

// Ohne die Konstanten, die werden schon im Hauptcode deklariert.
const { old: oldRequestDetailsBase, new: newRequestDetailsBase } = prepare(
    'verify_details_on_favorite.js',
    REQUEST_DETAILS_NAMES,
    REQUEST_DETAILS_NAMES
);

// Die Funktion fuer die Varianten gibt es nur in der neuen Version. Im alten
// Code wird sie durch eine leere Funktion ersetzt, damit der Vergleich laeuft.
const oldRequestDetails = oldRequestDetailsBase;
// Ohne die Konstanten, die sind schon im Hauptcode deklariert.
const { new: newVariations } = prepare('verify_details_on_favorite.js', VARIATION_NAMES, VARIATION_NAMES);
const newRequestDetails = `${newRequestDetailsBase}\n${newVariations}`;

/**
 * Baut eine Sandbox mit einer gemockten Datenbank und der Vine API.
 * @param {object} opts Szenario-Optionen
 */
async function run(code, opts, requestDetailsCode) {
    const log = [];
    const _store = {};

    // Die Produkte der Datenbank
    const _entries = (opts.entries || []).map((e) => Object.assign({}, e));
    const _clone = (e) => (e ? Object.assign({}, e) : e);

    const database = {
        getNewEntries() {
            log.push('db.getNewEntries');
            return Promise.resolve(_entries.filter((e) => e.isNew).map(_clone));
        },
        getById(id) {
            log.push(`db.getById ${id}`);
            const _found = _entries.find((e) => e.id === id);
            return Promise.resolve(_found ? _clone(_found) : undefined);
        },
        update(entry) {
            log.push(
                `db.update ${entry.id} isNotified=${entry.isNotified} isFav=${entry.isFav} prices=${JSON.stringify(entry.data_estimated_tax_prices)}`
            );
            const _idx = _entries.findIndex((e) => e.id === entry.id);
            if (_idx >= 0) _entries[_idx] = Object.assign({}, entry);
            return Promise.resolve(true);
        }
    };

    // Die Vine API. Die echte requestProductDetails() erwartet eine Response
    // mit einer json()-Methode.
    const _apiCall = (url) => {
        log.push(`api ${url}`);
        // Die Empfehlung eines Elternprodukts liefert die Varianten, die
        // Empfehlung eines Kindes liefert den Preis.
        const _isParent = url.includes('/recommendations/p1') && !url.includes('/item/');
        const _result = _isParent
            ? {
                  variations: [{ asin: 'CHILD1' }, { asin: 'CHILD2' }]
              }
            : {
                  variations: [],
                  featureBullets: ['bullet'],
                  byLineContributors: ['contributor'],
                  catalogSize: '42',
                  taxCurrency: 'EUR',
                  taxValue: 12.5,
                  limitedQuantity: 3
              };
        // Die zweite Variante ist teurer, der Preis des Produkts muss der
        // hoechste der Varianten sein.
        const _isChild2 = url.includes('/item/CHILD2');
        const _result2 = _isChild2 ? { ..._result, taxValue: 25.0 } : _result;
        return Promise.resolve({
            json: () => Promise.resolve({ result: _result2 })
        });
    };

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        document: {
            title: 'Test | Amazon',
            getElementById: () => null,
            getElementsByClassName: () => []
        },
        window: { location: { origin: 'https://www.amazon.de', href: 'https://www.amazon.de/vine/vine-items' } },
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
            EnableDetailsOnFavorite: opts.detailsOnFavorite !== false,
            EnableAutoMarkFavorite: !!opts.autoFavorite,
            EnableDesktopNotifikation: !!opts.desktop,
            VariationRequestDelay: 500,
            GotifyUrl: '',
            DesktopNotifikationKeywords: opts.keywords || []
        },
        database,
        vineFetch: _apiCall,
        requestProductDetails: async (prod) => {
            log.push(`requestProductDetails (mock) ${prod.id}`);
            if (prod.data_asin_is_parent) {
                const _res = await _apiCall(`/vine/api/recommendations/${prod.id}`);
                const _data = await _res.json();
                prod.data_childs = _data.result.variations || [];
                if (prod.data_childs.length > 0 && prod.data_childs[0].asin) {
                    const _childRes = await _apiCall(`/vine/api/recommendations/${prod.id}/item/${prod.data_childs[0].asin}`);
                    const _childData = await _childRes.json();
                    prod.data_tax_currency = _childData.result.taxCurrency;
                    prod.data_estimated_tax_prices = [_childData.result.taxValue];
                }
                return prod;
            }
            const _res = await _apiCall(`/vine/api/recommendations/${prod.id}/item/${prod.data_asin}`);
            const _data = await _res.json();
            prod.data_estimated_tax_prices = [_data.result.taxValue];
            prod.data_tax_currency = _data.result.taxCurrency;
            prod.data_feature_bullets = _data.result.featureBullets;
            return prod;
        },
        updateTileStyle: (prod) => log.push(`updateTileStyle ${prod.id}`),
        gotifyNotification: () => log.push('gotifyNotification'),
        desktopNotifikation: () => log.push('desktopNotifikation'),
        fixProductImageUrl: (u) => u,
        unixTimeStamp: () => 1800000000,
        translate: (cat, key, fallback) => fallback,
        delay: (ms) => {
            log.push(`delay ${ms}`);
            return new Promise((r) => setTimeout(r, 0));
        },
        setTimeout: (cb) => {
            return 1;
        },
        AVE_VERSION: '1.0',
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
    vm.runInContext(code, ctx, { filename: 'details.js' });
    // Die echte requestProductDetails() ueberschreibt den Mock.
    vm.runInContext(requestDetailsCode, ctx, { filename: 'requestdetails.js' });

    // Der Aufruf haengt davon ab, ob der Keyword-Match oder der Stern-Klick
    // getestet wird.
    if (opts.mode === 'keyword') {
        // Das Produkt wird von der Funktion veraendert, darum wird eine Kopie
        // verwendet. Sonst wuerde das Produkt der naechsten Szene veraendert.
        // NOTE: Die Funktion ist asynchron, sie wartet auf die Preise, bevor sie
        // die Benachrichtigung sendet.
        await sandbox.checkKeywordsForProduct(Object.assign({}, opts.product), opts.keywords || ['wichtig']);
    } else {
        sandbox.favStarEventhandlerClick({}, { recommendation_id: opts.product.id });
    }

    // Die Datenbank-Operationen sind asynchron, es wird auf sie gewartet.
    return new Promise((resolve) =>
        setTimeout(() => {
            resolve({
                log,
                entries: _entries
            });
        }, 100)
    );
}

const SCENARIOS = [
    {
        name: 'Stern-Klick: Produkt wird Favorit, Details werden geladen',
        expectDetails: true,
        opts: {
            mode: 'star',
            entries: [{ id: 'p1', description_full: 'Produkt A', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN1' }],
            product: { id: 'p1', description_full: 'Produkt A', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN1' }
        }
    },
    {
        name: 'Stern-Klick: Einstellung ist aus, es werden keine Details geladen',
        expectDetails: false,
        opts: {
            mode: 'star',
            detailsOnFavorite: false,
            entries: [{ id: 'p1', description_full: 'Produkt A', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN1' }],
            product: { id: 'p1', description_full: 'Produkt A', isNew: 1, isFav: 0, isNotified: 0, data_asin: 'ASIN1' }
        }
    },
    {
        name: 'Stern-Klick: Produkt ist bereits Favorit, Details sind schon da',
        expectDetails: false,
        opts: {
            mode: 'star',
            entries: [
                {
                    id: 'p1',
                    description_full: 'Produkt A',
                    isNew: 1,
                    isFav: 1,
                    isNotified: 0,
                    data_asin: 'ASIN1',
                    data_estimated_tax_prices: [9.9]
                }
            ],
            product: {
                id: 'p1',
                description_full: 'Produkt A',
                isNew: 1,
                isFav: 1,
                isNotified: 0,
                data_asin: 'ASIN1',
                data_estimated_tax_prices: [9.9]
            }
        }
    },
    {
        name: 'Keyword-Match: Produkt wird automatisch Favorit, Details werden geladen',
        expectDetails: true,
        // Die Benachrichtigung wird erst gesendet, nachdem die Preise geladen sind.
        expectNotificationAfterDetails: true,
        opts: {
            mode: 'keyword',
            autoFavorite: true,
            desktop: true,
            keywords: ['wichtig'],
            entries: [],
            product: {
                id: 'p1',
                description_full: 'Ein WICHTIGES Produkt',
                isNew: 1,
                isFav: 0,
                isNotified: 0,
                data_asin: 'ASIN1'
            }
        }
    },
    {
        name: 'Keyword-Match mit Preisbedingung: der Preis passt, es wird benachrichtigt',
        expectDetails: true,
        // Die Benachrichtigung wird erst gesendet, nachdem die Preise geladen sind.
        expectNotificationAfterDetails: true,
        opts: {
            mode: 'keyword',
            autoFavorite: true,
            desktop: true,
            keywords: ['wichtig [price >= 10]'],
            entries: [],
            product: {
                id: 'p1',
                description_full: 'Ein WICHTIGES Produkt',
                isNew: 1,
                isFav: 0,
                isNotified: 0,
                data_asin: 'ASIN1'
            }
        }
    },
    {
        name: 'Keyword-Match mit Preisbedingung: das Keyword passt nicht, die Preise werden nicht geladen',
        expectDetails: false,
        // Die Preise werden nur nach einem erfolgreichen Keyword-Match geladen.
        expectNoNotification: true,
        opts: {
            mode: 'keyword',
            autoFavorite: true,
            desktop: true,
            keywords: ['wichtig [price >= 10]'],
            entries: [],
            product: {
                id: 'p1',
                description_full: 'Ein belangloses Produkt',
                isNew: 1,
                isFav: 0,
                isNotified: 0,
                data_asin: 'ASIN1'
            }
        }
    },
    {
        name: 'Keyword-Match mit Preisbedingung: der Preis passt nicht, es wird nicht benachrichtigt',
        expectDetails: true,
        // Der Preis passt nicht, darum wird das Produkt nicht benachrichtigt und
        // nicht als gesehen markiert.
        expectNoNotification: true,
        opts: {
            mode: 'keyword',
            autoFavorite: true,
            desktop: true,
            keywords: ['wichtig [price >= 20]'],
            entries: [],
            product: {
                id: 'p1',
                description_full: 'Ein WICHTIGES Produkt',
                isNew: 1,
                isFav: 0,
                isNotified: 0,
                data_asin: 'ASIN1'
            }
        }
    },
    {
        name: 'Keyword-Match mit Preisbedingung und ausgeschalteter Einstellung: die Preise werden trotzdem geladen',
        expectDetails: true,
        // Die Preise werden auch geladen, wenn die Einstellung aus ist, weil
        // die Preisbedingung sonst nicht geprueft werden kann.
        expectNotificationAfterDetails: true,
        opts: {
            mode: 'keyword',
            autoFavorite: true,
            desktop: true,
            detailsOnFavorite: false,
            keywords: ['wichtig [price >= 10]'],
            entries: [],
            product: {
                id: 'p1',
                description_full: 'Ein WICHTIGES Produkt',
                isNew: 1,
                isFav: 0,
                isNotified: 0,
                data_asin: 'ASIN1'
            }
        }
    },
    {
        name: 'Keyword-Match: Auto-Favorit ist aus, es werden keine Details geladen',
        expectDetails: false,
        opts: {
            mode: 'keyword',
            autoFavorite: false,
            keywords: ['wichtig'],
            entries: [],
            product: {
                id: 'p1',
                description_full: 'Ein WICHTIGES Produkt',
                isNew: 1,
                isFav: 0,
                isNotified: 0,
                data_asin: 'ASIN1'
            }
        }
    },
    {
        name: 'Keyword-Match: Einstellung ist aus, es werden keine Details geladen',
        expectDetails: false,
        opts: {
            mode: 'keyword',
            autoFavorite: true,
            detailsOnFavorite: false,
            keywords: ['wichtig'],
            entries: [],
            product: {
                id: 'p1',
                description_full: 'Ein WICHTIGES Produkt',
                isNew: 1,
                isFav: 0,
                isNotified: 0,
                data_asin: 'ASIN1'
            }
        }
    },
    {
        name: 'Stern-Klick: Produkt mit Eltern-ASIN, der Preis kommt von der Variante',
        expectDetails: true,
        // Der Preis des Produkts ist der hoechste der Varianten.
        expectPrice: 25.0,
        // Die Preise aller Varianten werden gespeichert.
        expectVariantPrices: [12.5, 25],
        // Zwischen den Varianten wird die Verzoegerung der Einstellung verwendet.
        expectVariationDelay: true,
        expectChildRequests: 2,
        opts: {
            mode: 'star',
            entries: [
                {
                    id: 'p1',
                    description_full: 'Produkt A',
                    isNew: 1,
                    isFav: 0,
                    isNotified: 0,
                    data_asin: 'PARENT1',
                    data_asin_is_parent: true
                }
            ],
            product: {
                id: 'p1',
                description_full: 'Produkt A',
                isNew: 1,
                isFav: 0,
                isNotified: 0,
                data_asin: 'PARENT1',
                data_asin_is_parent: true
            }
        }
    }
];

/**
 * Prueft, ob die Details eines Produkts geladen und gespeichert wurden.
 *
 * Im Keyword-Modus liegt das Produkt nicht in der Datenbank, darum wird der Log
 * geprueft: Nach dem Laden der Details wird das Produkt mit dem Preis
 * gespeichert. Bei einem Elternprodukt ist der Preis der hoechste der
 * Varianten, die Zahl steht ohne Nachkommastellen im Log (25 statt 25.0).
 *
 * @param {object} scenario Das Szenario mit den Erwartungen
 * @param {object} newRun Der Lauf der neuen Implementierung
 * @returns {string[]} Die Beschreibungen der Abweichungen
 */
function findDetailProblems(scenario, newRun) {
    const _problems = [];
    const _hasApiCall = newRun.log.some((l) => l.startsWith('api '));

    const _expectedPrice = scenario.expectPrice !== undefined ? scenario.expectPrice : 12.5;
    const _expectedTax = String(_expectedPrice).replace(/\.0$/, '');
    const _expectedPrices = scenario.expectVariantPrices ? JSON.stringify(scenario.expectVariantPrices) : `[${_expectedTax}]`;
    const _hasTax = newRun.log.some((l) => l.startsWith('db.update') && l.includes(`prices=${_expectedPrices}`));

    if (scenario.expectDetails && (!_hasApiCall || !_hasTax)) {
        _problems.push(`EXPECTED the details to be loaded, but api=${_hasApiCall} tax=${_hasTax}`);
    }
    if (!scenario.expectDetails && _hasApiCall) {
        _problems.push('EXPECTED no request, but the API was called');
    }
    // Bei einem Elternprodukt werden die Preise aller Varianten gespeichert.
    if (scenario.expectVariantPrices && !_hasTax) {
        _problems.push(`EXPECTED the prices of the variations to be stored: ${_expectedPrices}`);
    }

    return _problems;
}

/**
 * Prueft die Zeitpunkte im Log: die Verzoegerung zwischen den Varianten, die
 * Reihenfolge von Preis und Benachrichtigung und die unterbliebene
 * Benachrichtigung.
 *
 * @param {object} scenario Das Szenario mit den Erwartungen
 * @param {object} newRun Der Lauf der neuen Implementierung
 * @returns {string[]} Die Beschreibungen der Abweichungen
 */
function findTimingProblems(scenario, newRun) {
    const _problems = [];

    // Zwischen den Varianten wird die Verzoegerung der Einstellung verwendet
    // (500 ms +/- 50 Prozent).
    if (scenario.expectVariationDelay) {
        const _delays = newRun.log.filter((l) => l.startsWith('delay ')).map((l) => parseInt(l.slice(6), 10));
        const _allInRange = _delays.length > 0 && _delays.every((d) => d >= 250 && d <= 750);
        if (!_allInRange) {
            _problems.push(`EXPECTED the delay between the variations to be between 250 and 750 ms: ${JSON.stringify(_delays)}`);
        }
    }

    // Die Benachrichtigung wird erst gesendet, nachdem die Preise des Produkts
    // geladen und gespeichert sind.
    if (scenario.expectNotificationAfterDetails) {
        const _detailsIndex = newRun.log.findIndex((l) => l.startsWith('db.update') && l.includes('prices=[12.5]'));
        const _notificationIndex = newRun.log.findIndex((l) => l.startsWith('desktopNotifikation'));
        if (_detailsIndex < 0 || _notificationIndex < 0 || _notificationIndex < _detailsIndex) {
            _problems.push(`EXPECTED the notification after the prices: ${JSON.stringify(newRun.log)}`);
        }
    }

    // Wenn die Preisbedingung nicht passt, wird das Produkt nicht benachrichtigt
    // und nicht als gesehen markiert.
    if (scenario.expectNoNotification) {
        const _hasNotification = newRun.log.some((l) => l.startsWith('desktopNotifikation'));
        const _isNotified = newRun.log.some((l) => l.startsWith('db.update') && l.includes('isNotified=true'));
        if (_hasNotification || _isNotified) {
            _problems.push(`EXPECTED no notification, but: ${JSON.stringify(newRun.log)}`);
        }
    }

    return _problems;
}

/**
 * Vergleicht den Zustand der Produkte der beiden Laeufe.
 *
 * @param {object} oldRun Der Lauf der alten Implementierung
 * @param {object} newRun Der Lauf der neuen Implementierung
 * @returns {string[]} Die Beschreibungen der Abweichungen
 */
function findStateProblems(oldRun, newRun) {
    const _oldFav = JSON.stringify(oldRun.entries.map((e) => e.isFav));
    const _newFav = JSON.stringify(newRun.entries.map((e) => e.isFav));
    if (_oldFav === _newFav) return [];

    return [`state old: ${JSON.stringify(oldRun.entries)}`, `state new: ${JSON.stringify(newRun.entries)}`];
}

/**
 * Prueft einen Lauf gegen die Erwartungen des Szenarios.
 *
 * Das Skript prueft das neue Verhalten, nicht die Gleichheit mit der alten
 * Version. Die Erwartung steht in jedem Szenario.
 *
 * @param {object} scenario Das Szenario mit den Erwartungen
 * @param {object} oldRun Der Lauf der alten Implementierung
 * @param {object} newRun Der Lauf der neuen Implementierung
 * @returns {string[]} Die Beschreibungen der Abweichungen
 */
function findProblems(scenario, oldRun, newRun) {
    return [...findDetailProblems(scenario, newRun), ...findTimingProblems(scenario, newRun), ...findStateProblems(oldRun, newRun)];
}

(async () => {
    let _allOk = true;
    let _totalDiffs = 0;

    for (const _scenario of SCENARIOS) {
        console.log(`\n########## ${_scenario.name} ##########`);
        const _old = await run(oldCode, _scenario.opts, oldRequestDetails);
        const _new = await run(newCode, _scenario.opts, newRequestDetails);

        const _problems = findProblems(_scenario, _old, _new);
        for (const _problem of _problems) console.log(`  ${_problem}`);

        if (_problems.length === 0) {
            console.log(`  ${_scenario.name}: ok`);
        } else {
            _allOk = false;
            _totalDiffs += _problems.length;
        }
    }

    finish(_allOk, _totalDiffs);
})();
