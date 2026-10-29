/**
 * verify_init.js
 *
 * Vergleicht die alte (git HEAD) und die neue Implementierung von init().
 * Beide werden in einem vm-Kontext mit gemocktem DOM und gemockter Datenbank
 * ausgefuehrt.
 *
 * Verglichen werden:
 *   1. die Folge der DOM-Aenderungen (erzeugte Elemente in Reihenfolge)
 *   2. die Aufrufe der Datenbank
 *   3. die Aufrufe der uebrigen Funktionen (Navigation, Suche, Scan)
 *   4. die Reihenfolge dieser Aufrufe
 *
 * Usage: node scripts/verify/verify_init.js
 */

const vm = require('vm');
const { prepare, finish } = require('./lib/verify_helpers');

// NOTE: The baseline is the state before the auto scan was removed. The
// functions of the page initialisation are already split there, so both
// versions use the same list.
const OLD_NAMES = ['init', 'initTileParsing', 'initNavigationButtons', 'initSearchBar', 'initPagination'];
const NEW_NAMES = ['init', 'initTileParsing', 'initNavigationButtons', 'initSearchBar', 'initPagination'];

const { old: oldCode, new: newCode } = prepare('verify_init.js', OLD_NAMES, NEW_NAMES);

/** Minimaler DOM-Mock, der die erzeugten Elemente protokolliert. */
function createDomMock(log) {
    const _mkEl = (tag, id) => {
        const _el = {
            tagName: tag.toUpperCase(),
            id: id || '',
            children: [],
            attributes: {},
            style: {},
            classList: {
                _classes: [],
                add(...n) {
                    this._classes.push(...n);
                },
                remove(...n) {
                    this._classes = this._classes.filter((c) => !n.includes(c));
                },
                contains(n) {
                    return this._classes.includes(n);
                }
            },
            _listeners: {},
            setAttribute(n, v) {
                this.attributes[n] = String(v);
                log.push(`  setAttribute ${this.tagName}#${this.id} ${n}=${v}`);
            },
            getAttribute(n) {
                return this.attributes[n] !== undefined ? this.attributes[n] : null;
            },
            removeAttribute(n) {
                delete this.attributes[n];
            },
            appendChild(child) {
                this.children.push(child);
                log.push(`  append ${this.tagName}#${this.id} <- ${child.tagName}#${child.id}`);
                return child;
            },
            remove() {},
            addEventListener(t, cb) {
                this._listeners[t] = cb;
                log.push(`  addEventListener ${this.tagName}#${this.id} ${t}`);
            },
            querySelector() {
                return null;
            },
            querySelectorAll() {
                return [];
            },
            cloneNode() {
                const _c = _mkEl(tag, this.id);
                _c._listeners = this._listeners;
                _c.attributes = Object.assign({}, this.attributes);
                _c.children = this.children.slice();
                return _c;
            },
            click() {
                if (this._listeners['click']) this._listeners['click']({ target: this });
            }
        };
        // lastChild/firstChild werden von Amazon und dem AVE-Code benutzt.
        Object.defineProperty(_el, 'lastChild', {
            get() {
                return this.children.length ? this.children[this.children.length - 1] : null;
            }
        });
        Object.defineProperty(_el, 'firstChild', {
            get() {
                return this.children.length ? this.children[0] : null;
            }
        });
        Object.defineProperty(_el, 'innerHTML', {
            get() {
                return this._innerHTML || '';
            },
            set(v) {
                this._innerHTML = v;
                log.push(`  innerHTML ${this.tagName}#${this.id}`);
            }
        });
        Object.defineProperty(_el, 'innerText', {
            get() {
                return this._innerText || '';
            },
            set(v) {
                this._innerText = v;
            }
        });
        Object.defineProperty(_el, 'textContent', {
            get() {
                return this._textContent || '';
            },
            set(v) {
                this._textContent = v;
            }
        });
        Object.defineProperty(_el, 'className', {
            get() {
                return this.classList._classes.join(' ');
            },
            set(v) {
                this.classList._classes = String(v).split(/\s+/).filter(Boolean);
            }
        });
        return _el;
    };

    const _navContainer = _mkEl('div', 'vvp-items-button-container');
    const _pagination = _mkEl('div', 'a-pagination');
    // Der "next"-Button der Pagination
    const _nextBtn = _mkEl('span', 'next-button');
    _nextBtn.classList.add('a-disabled');
    const _nextBtnLink = _mkEl('a', 'next-link');
    _nextBtnLink.attributes['href'] = 'vine-items?queue=encore&pn=&cn=&page=2';
    _nextBtn.appendChild(_nextBtnLink);
    _pagination.appendChild(_nextBtn);

    const _tiles = [];
    for (let i = 0; i < 3; i++) {
        const _t = _mkEl('div', `tile-${i}`);
        _t.classList.add('vvp-item-tile');
        _t.setAttribute = function (n, v) {
            this.attributes[n] = String(v);
        };
        _t.attributes['data-recommendation-id'] = `prod-${i}`;
        _tiles.push(_t);
    }

    const document = {
        _navContainer,
        _pagination,
        _tiles,
        title: 'Test | Amazon',
        createElement: (tag) => _mkEl(tag, ''),
        getElementById: (id) => (id === 'vvp-items-button-container' ? _navContainer : null),
        querySelectorAll: (sel) => {
            if (sel === '.a-pagination') return [_pagination];
            if (sel === '.vvp-item-tile') return _tiles;
            return [];
        },
        querySelector: () => null,
        getElementsByClassName: (cls) => (cls === 'vvp-item-tile' ? _tiles : []),
        body: _mkEl('body', ''),
        addEventListener: () => {}
    };
    return document;
}

/** Fuehrt die Implementierung aus und liefert das Protokoll. */
function run(code, opts) {
    const log = [];

    const _document = createDomMock(log);

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        document: _document,
        window: { location: { href: 'https://www.amazon.de/vine/vine-items', origin: 'https://www.amazon.de' } },
        localStorage: {
            _s: {},
            getItem(k) {
                return this._s[k] !== undefined ? this._s[k] : null;
            },
            setItem(k, v) {
                this._s[k] = String(v);
            },
            removeItem(k) {
                delete this._s[k];
            }
        },
        SETTINGS: {
            DebugLevel: 0,
            EnableBtnAll: true,
            EnableBackgroundScan: true,
            BtnColorAllProducts: '#fff',
            BtnColorFavorites: '#ff0',
            BtnColorNewProducts: '#0f0',
            BtnColorFavoritesBadge: '#f00',
            BtnColorNewProductsBadge: '#f00',
            SearchBarInputDelay: 500
        },
        database: {
            query: (q) => {
                log.push(`db.query ${JSON.stringify(q)}`);
                return Promise.resolve([]);
            }
        },
        getUrlParameter: (name) => (name === 'ave-subpage' ? opts.subpage || null : null),
        // NOTE: The auto scan was removed, but the baseline still calls the
        // functions. They are mocked, so that the baseline can be executed.
        showAutoScanScreen: (t) => log.push(`showAutoScanScreen ${t}`),
        startAutoScan: () => log.push('startAutoScan'),
        handleAutoScan: () => log.push('handleAutoScan'),
        completeDelayedInit: () => log.push('completeDelayedInit'),
        initBackgroundScan: () => log.push('initBackgroundScan'),
        createNewSite: (t) => log.push(`createNewSite ${t}`),
        createNavButton: (id, text) => {
            log.push(`createNavButton ${id}`);
            const _el = _document.createElement('span');
            _el.id = id;
            return _el;
        },
        parseTileData: (tile) => {
            log.push(`parseTileData ${tile.getAttribute('data-recommendation-id')}`);
            return Promise.resolve({ id: tile.getAttribute('data-recommendation-id'), gotFromDB: true });
        },
        addStyleToTile: (tile, prod) => log.push(`addStyleToTile ${prod.id}`),
        addLeftSideButtons: () => log.push('addLeftSideButtons'),
        updateNewProductsBtn: () => log.push('updateNewProductsBtn'),
        updateFavoritesBtn: () => log.push('updateFavoritesBtn'),
        markAllCurrentSiteProductsAsSeen: () => Promise.resolve(),
        aveResolveUrl: (href) => 'https://www.amazon.de/vine/vine-items?page=2',
        translate: (cat, key, fallback) => fallback,
        PAGETYPE: { NEW_ITEMS: 0, FAVORITES: 1, ALL: 2, SEARCH_RESULT: 9 },
        // NOTE: The auto scan was removed, but the baseline still uses the
        // variables. They are always false, because the auto scan could never
        // be started.
        AUTO_SCAN_IS_RUNNING: false,
        AUTO_SCAN_PAGE_CURRENT: 1,
        AUTO_SCAN_PAGE_MAX: 5,
        INIT_AUTO_SCAN: false,
        newProductWasAdded: false,
        searchInputTimeout: null,
        Promise,
        Math,
        JSON,
        String,
        Number,
        parseInt,
        Object,
        Array,
        setTimeout: (cb) => {
            log.push('setTimeout');
            return 1;
        },
        clearTimeout: () => {}
    };
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx, { filename: 'init.js' });

    sandbox.init(opts.hasTiles !== false);

    return new Promise((resolve) =>
        setTimeout(() => {
            resolve(log);
        }, 30)
    );
}

const SCENARIOS = [
    { name: 'Normale Seite mit Produkten', opts: { hasTiles: true } },
    { name: 'Leere Seite ohne Produkte', opts: { hasTiles: false } },
    { name: 'Subpage-Parameter vorhanden', opts: { hasTiles: true, subpage: '2' } }
];

(async () => {
    let _allOk = true;
    let _totalDiffs = 0;
    for (const _scenario of SCENARIOS) {
        console.log(`\n########## ${_scenario.name} ##########`);
        const _old = await run(oldCode, _scenario.opts);
        const _new = await run(newCode, _scenario.opts);

        if (JSON.stringify(_old) === JSON.stringify(_new)) {
            console.log(`identisch (${_old.length} Schritte)`);
        } else {
            _allOk = false;
            _totalDiffs++;
            console.log('ABWEICHUNG:');
            const _max = Math.max(_old.length, _new.length);
            for (let i = 0; i < _max; i++) {
                const _o = _old[i] === undefined ? '(fehlt)' : _old[i];
                const _n = _new[i] === undefined ? '(fehlt)' : _new[i];
                if (_o !== _n) console.log(`  Schritt ${i}: alt "${_o}"  neu "${_n}"`);
            }
        }
    }

    finish(_allOk, _totalDiffs);
})();
