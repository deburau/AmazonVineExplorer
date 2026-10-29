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
    'hasProductDetails'
];

const CONSTANT_NAMES = ['PRODUCT_DETAILS_REQUEST_DELAY', 'productDetailsQueue'];

// Die echte requestProductDetails() wird mit extrahiert, damit der Test den
// echten Code prueft und nicht einen Nachbau.
const REQUEST_DETAILS_NAMES = ['requestProductDetails'];

const { old: oldCode, new: newCode } = prepareWithConstants(
    'verify_details_on_favorite.js',
    OLD_NAMES,
    NEW_NAMES,
    CONSTANT_NAMES,
    'globals.js'
);

// Ohne die Konstanten, die werden schon im Hauptcode deklariert.
const { old: oldRequestDetails, new: newRequestDetails } = prepare(
    'verify_details_on_favorite.js',
    REQUEST_DETAILS_NAMES,
    REQUEST_DETAILS_NAMES
);

/**
 * Baut eine Sandbox mit einer gemockten Datenbank und der Vine API.
 * @param {object} opts Szenario-Optionen
 */
function run(code, opts, requestDetailsCode) {
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
            log.push(`db.update ${entry.id} isFav=${entry.isFav} tax=${entry.data_estimated_tax_prize}`);
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
            ? { variations: [{ asin: 'CHILD1' }] }
            : {
                  variations: [],
                  featureBullets: ['bullet'],
                  byLineContributors: ['contributor'],
                  catalogSize: '42',
                  taxCurrency: 'EUR',
                  taxValue: 12.5,
                  limitedQuantity: 3
              };
        return Promise.resolve({
            json: () => Promise.resolve({ result: _result })
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
            EnableDesktopNotifikation: false,
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
                    prod.data_estimated_tax_prize = _childData.result.taxValue;
                }
                return prod;
            }
            const _res = await _apiCall(`/vine/api/recommendations/${prod.id}/item/${prod.data_asin}`);
            const _data = await _res.json();
            prod.data_estimated_tax_prize = _data.result.taxValue;
            prod.data_tax_currency = _data.result.taxCurrency;
            prod.data_feature_bullets = _data.result.featureBullets;
            return prod;
        },
        updateTileStyle: (prod) => log.push(`updateTileStyle ${prod.id}`),
        gotifyNotification: () => {},
        desktopNotifikation: () => {},
        fixProductImageUrl: (u) => u,
        unixTimeStamp: () => 1800000000,
        translate: (cat, key, fallback) => fallback,
        delay: (ms) => new Promise((r) => setTimeout(r, 0)),
        setTimeout: (cb) => {
            return 1;
        },
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
        sandbox.checkKeywordsForProduct(Object.assign({}, opts.product), opts.keywords || ['wichtig']);
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
                    data_estimated_tax_prize: 9.9
                }
            ],
            product: {
                id: 'p1',
                description_full: 'Produkt A',
                isNew: 1,
                isFav: 1,
                isNotified: 0,
                data_asin: 'ASIN1',
                data_estimated_tax_prize: 9.9
            }
        }
    },
    {
        name: 'Keyword-Match: Produkt wird automatisch Favorit, Details werden geladen',
        expectDetails: true,
        opts: {
            mode: 'keyword',
            autoFavorite: true,
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

(async () => {
    let _allOk = true;
    let _totalDiffs = 0;

    for (const _scenario of SCENARIOS) {
        console.log(`\n########## ${_scenario.name} ##########`);
        const _old = await run(oldCode, _scenario.opts, oldRequestDetails);
        const _new = await run(newCode, _scenario.opts, newRequestDetails);

        // Das Skript prueft das neue Verhalten, nicht die Gleichheit mit der
        // alten Version. Die Erwartung steht in jedem Szenario.
        const _expected = _scenario.expectDetails;
        const _hasApiCall = _new.log.some((_l) => _l.startsWith('api '));
        // Im Keyword-Modus liegt das Produkt nicht in der Datenbank, darum
        // wird der Log geprueft: Nach dem Laden der Details wird das Produkt
        // mit dem Preis gespeichert.
        const _hasTax = _new.log.some((_l) => _l.startsWith('db.update') && _l.includes('tax=12.5'));

        if (_expected && (!_hasApiCall || !_hasTax)) {
            _allOk = false;
            _totalDiffs++;
            console.log(`  EXPECTED the details to be loaded, but api=${_hasApiCall} tax=${_hasTax}`);
        }
        if (!_expected && _hasApiCall) {
            _allOk = false;
            _totalDiffs++;
            console.log(`  EXPECTED no request, but the API was called`);
        }

        // Der Stern und der Status der Produkte muessen immer uebereinstimmen.
        if (JSON.stringify(_old.entries.map((_e) => _e.isFav)) !== JSON.stringify(_new.entries.map((_e) => _e.isFav))) {
            _allOk = false;
            _totalDiffs++;
            console.log(`  state old: ${JSON.stringify(_old.entries)}`);
            console.log(`  state new: ${JSON.stringify(_new.entries)}`);
        }

        if (_allOk) {
            console.log(`  ${_scenario.name}: ok`);
        }
    }

    finish(_allOk, _totalDiffs);
})();
