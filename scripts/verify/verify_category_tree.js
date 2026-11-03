#!/usr/bin/env node
/**
 * verify_category_tree.js
 *
 * Prueft, wie die Kategorien der Vine-Seiten gelesen werden.
 *
 * Die Kategorien stehen im Sidebar der Vine-Seite. Der Baum wird fuer die Auswahl
 * der Kategorien des Turbo-Scans gebraucht: die erste Seite zeigt alle
 * Hauptkategorien, die Seite einer Hauptkategorie zeigt deren Unterkategorien.
 *
 * Geprueft werden:
 *   - parseCategoryNodes(): Name, Anzahl und Nummern aus einem Knoten
 *   - die Selektoren, mit denen die Knoten gesucht werden
 *   - parseCategoryTree(): Haupt- und Unterkategorien einer Seite
 *   - getVineCategoryParents(): die Hauptkategorien aus der Seite und aus dem
 *     Speicher (mit dem Rueckfall auf den Speicher)
 *   - getVineCategoryChildren(): die Unterkategorien einer Hauptkategorie
 *     (sie werden traege geladen, damit nicht beim Oeffnen der Einstellungen
 *     alle 24 Seiten geholt werden)
 *
 * NOTE: Das HTML wird nicht geparst (das Projekt hat keinen HTML-Parser als
 * Abhaengigkeit). Die Knoten sind nachgebaut, sie verhalten sich aber wie die
 * echten: der Text enthaelt den Namen und die Anzahl, der Link die Nummern.
 * Dass die Selektoren zum echten HTML von Amazon passen, wurde im Browser
 * geprueft und ist im Test mit festgehalten.
 *
 * Usage: node scripts/verify/verify_category_tree.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { extractBody, extractConstants } = require('./lib/verify_helpers');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Liest eine Datei aus dem Repository.
 * @param {string} name Der Name der Datei
 * @returns {string} Der Inhalt der Datei
 */
function readSource(name) {
    return fs.readFileSync(path.join(REPO_ROOT, name), 'utf8');
}

const mainSrc = readSource('VineExplorer.user.js');

const CODE = [
    extractConstants(mainSrc, ['CATEGORY_CACHE_MAX_AGE_SECONDS']),
    extractBody(mainSrc, 'parseCategoryNodes'),
    extractBody(mainSrc, 'parseCategoryTree'),
    extractBody(mainSrc, 'getVineCategoryParents'),
    extractBody(mainSrc, 'getVineCategoryChildren'),
    extractBody(mainSrc, 'fetchCategoryPage'),
    extractBody(mainSrc, 'readCategoryCache'),
    extractBody(mainSrc, 'writeCategoryCache'),
    extractBody(mainSrc, 'isCategoryCacheFresh')
].join('\n\n');

/**
 * Baut einen Kategorie-Knoten nach, wie ihn die Seite liefert.
 *
 * @param {string} text Der Text des Knotens, z.B. "Garten (1249)"
 * @param {string} href Der Link mit den Nummern
 * @returns {object} Der Knoten
 */
function makeNode(text, href) {
    const _link = {
        textContent: text.replace(/\s*\(\d+\)\s*$/, ''),
        getAttribute: () => href
    };
    return {
        textContent: text,
        // Der Knoten wird mit dem Selektor "a[href*=\"pn=\"]" gesucht.
        querySelector: (selector) => (selector.includes('pn=') ? _link : null)
    };
}

/**
 * Baut ein Dokument nach, wie es parseCategoryNodes() erwartet.
 *
 * @param {object[]} parents Die Hauptkategorien
 * @param {object[]} children Die Unterkategorien
 * @returns {object} Das Dokument
 */
function makeDoc(parents = [], children = []) {
    return {
        selectors: [],
        querySelectorAll(selector) {
            this.selectors.push(selector);
            if (selector.includes('parent-node')) return parents;
            if (selector.includes('child-node')) return children;
            return [];
        }
    };
}

/**
 * Baut eine Sandbox mit gemocktem local storage, Netzwerk und DOM.
 *
 * @param {object} opts Die Optionen des Tests
 * @returns {object} Die Sandbox
 */
function createSandbox(opts = {}) {
    const _store = new Map();
    const _requests = [];
    const _docs = new Map();

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
        localStorage: {
            getItem: (key) => (_store.has(key) ? _store.get(key) : null),
            setItem: (key, value) => _store.set(key, String(value))
        },
        DOMParser: class {
            parseFromString(html) {
                if (!_docs.has(html)) throw new Error(`kein Dokument fuer "${html}"`);
                return _docs.get(html);
            }
        },
        delay: () => Promise.resolve(),
        getRandomizedDelay: (ms) => ms,
        aveGetVineBaseUrl: () => 'https://www.amazon.de/vine/vine-items',
        vineFetch: async (url) => {
            _requests.push(url);
            if (opts.failRequests) throw new Error('the page could not be loaded');
            // Jede Hauptkategorie liefert ihre eigenen Unterkategorien.
            const _pn = (url.match(/pn=(\d+)/) || [])[1] || '';
            return { ok: true, text: async () => `PAGE:${_pn}` };
        }
    };
    sandbox.globalThis = sandbox;
    sandbox._store = _store;
    sandbox._requests = _requests;
    sandbox._docs = _docs;

    // Die erste Seite (ohne pn) zeigt alle Hauptkategorien, die Seite einer
    // Hauptkategorie zeigt deren Unterkategorien.
    _docs.set(
        'PAGE:',
        makeDoc([
            makeNode('Küche, Haushalt & Wohnen (13602)', '/vine/vine-items?pn=3167641'),
            makeNode('Garten (1249)', '/vine/vine-items?pn=10925031')
        ])
    );
    _docs.set('PAGE:3167641', makeDoc([], [makeNode('Basteln, Malen & Handarbeiten (4616)', '/vine/vine-items?pn=3167641&cn=1080144030')]));
    _docs.set(
        'PAGE:10925031',
        makeDoc(
            [],
            [
                makeNode('Gartendeko (238)', '/vine/vine-items?pn=10925031&cn=87837030'),
                makeNode('Gartenarbeit (226)', '/vine/vine-items?pn=10925031&cn=5211155030')
            ]
        )
    );

    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'category_tree.js' });
    sandbox._ctx = _ctx;
    return sandbox;
}

let _errors = 0;
const _results = [];

/**
 * Vergleicht zwei Werte und merkt sich das Ergebnis.
 * @param {*} expected Der erwartete Wert
 * @param {*} actual Der erhaltene Wert
 * @param {string} label Die Bezeichnung der Pruefung
 */
function check(expected, actual, label) {
    if (JSON.stringify(expected) === JSON.stringify(actual)) {
        _results.push(`  OK   ${label}`);
        return;
    }
    _errors++;
    _results.push(`  FAIL ${label}`);
    _results.push(`         erwartet: ${JSON.stringify(expected)}  bekommen: ${JSON.stringify(actual)}`);
}

console.log('Kategorien der Vine-Seiten lesen');
console.log('='.repeat(70));

const _sandbox = createSandbox();
const _ctx = _sandbox._ctx;
const _parseCategoryNodes = vm.runInContext('parseCategoryNodes', _ctx);
const _parseCategoryTree = vm.runInContext('parseCategoryTree', _ctx);

// --- parseCategoryNodes() ---
const _parentsDoc = makeDoc([
    makeNode('Küche, Haushalt & Wohnen (13602)', '/vine/vine-items?queue=all_items&pn=3167641'),
    makeNode('Garten (1249)', '/vine/vine-items?queue=all_items&pn=10925031')
]);
check(
    [
        { name: 'Küche, Haushalt & Wohnen', count: 13602, pn: '3167641', cn: '' },
        { name: 'Garten', count: 1249, pn: '10925031', cn: '' }
    ],
    _parseCategoryNodes(_parentsDoc, 'parent-node'),
    'Name, Anzahl und Nummer einer Hauptkategorie'
);
check(['#vvp-browse-nodes-container .parent-node'], _parentsDoc.selectors, 'Der Selektor der Hauptkategorien');

const _childrenDoc = makeDoc([], [makeNode('Gartendeko (238)', '/vine/vine-items?queue=all_items&pn=10925031&cn=87837030')]);
check(
    [{ name: 'Gartendeko', count: 238, pn: '10925031', cn: '87837030' }],
    _parseCategoryNodes(_childrenDoc, 'child-node'),
    'Name, Anzahl und beide Nummern einer Unterkategorie'
);

// Ein Knoten ohne Link (die Buttons, die AVE in denselben Container setzt).
const _buttonDoc = makeDoc([{ textContent: 'Seite als gesehen markieren', querySelector: () => null }]);
check([], _parseCategoryNodes(_buttonDoc, 'parent-node'), 'Ein Knoten ohne Link wird uebersprungen');

// --- parseCategoryTree() ---
const _treeDoc = makeDoc([makeNode('Garten (1249)', '?pn=10925031')], [makeNode('Gartendeko (238)', '?pn=10925031&cn=87837030')]);
check(
    { parents: 1, children: 1 },
    (() => {
        const _tree = _parseCategoryTree(_treeDoc);
        return { parents: _tree.parents.length, children: _tree.children.length };
    })(),
    'Der Baum einer Seite enthaelt beide Listen'
);

// --- getVineCategoryParents() und getVineCategoryChildren() ---
(async () => {
    const _getParents = vm.runInContext('getVineCategoryParents', _ctx);
    const _getChildren = vm.runInContext('getVineCategoryChildren', _ctx);

    const _parents = await _getParents();
    check(
        [
            { name: 'Küche, Haushalt & Wohnen', count: 13602, pn: '3167641' },
            { name: 'Garten', count: 1249, pn: '10925031' }
        ],
        _parents.map((p) => ({ name: p.name, count: p.count, pn: p.pn })),
        'Die Hauptkategorien aus der Seite'
    );

    check(
        ['https://www.amazon.de/vine/vine-items?queue=all_items&pn=&cn=&page=1'],
        _sandbox._requests,
        'Fuer die Hauptkategorien ist ein einziger Request noetig'
    );
    check(true, _sandbox._store.has('AVE_CATEGORY_CACHE'), 'Die Kategorien werden im local storage abgelegt');

    const _requestsBefore = _sandbox._requests.length;
    await _getParents();
    check(_requestsBefore, _sandbox._requests.length, 'Ein zweiter Aufruf benutzt den gespeicherten Stand');

    // Die Unterkategorien werden erst geladen, wenn sie gebraucht werden.
    const _children = await _getChildren('10925031');
    check(
        ['Gartendeko', 'Gartenarbeit'],
        _children.map((c) => c.name),
        'Die Unterkategorien einer Hauptkategorie'
    );
    check(
        ['https://www.amazon.de/vine/vine-items?queue=all_items&pn=10925031&cn=&page=1'],
        _sandbox._requests.slice(_requestsBefore),
        'Fuer eine Hauptkategorie ist ein Request noetig'
    );

    // Die Unterkategorien stehen nach dem Laden im Speicher.
    const _requestsBeforeChildren = _sandbox._requests.length;
    await _getChildren('10925031');
    check(_requestsBeforeChildren, _sandbox._requests.length, 'Ein zweiter Aufruf benutzt die gespeicherten Unterkategorien');

    // Ohne lesbare Seiten werden die gespeicherten Kategorien benutzt.
    const _failing = createSandbox({ failRequests: true });
    _failing._store.set('AVE_CATEGORY_CACHE', _sandbox._store.get('AVE_CATEGORY_CACHE'));
    const _fallbackParents = await vm.runInContext('getVineCategoryParents', _failing._ctx)();
    check(2, _fallbackParents.length, 'Ohne lesbare Seiten werden die gespeicherten Hauptkategorien benutzt');
    const _fallbackChildren = await vm.runInContext('getVineCategoryChildren', _failing._ctx)('10925031');
    check(2, _fallbackChildren.length, 'Ohne lesbare Seiten werden die gespeicherten Unterkategorien benutzt');

    // Ohne lesbare Seiten und ohne Speicher gibt es einen Fehler.
    const _failing2 = createSandbox({ failRequests: true });
    let _threw = false;
    try {
        await vm.runInContext('getVineCategoryParents', _failing2._ctx)();
    } catch {
        _threw = true;
    }
    check(true, _threw, 'Ohne lesbare Seiten und ohne Speicher gibt es einen Fehler');

    for (const _line of _results) console.log(_line);
    console.log('');
    console.log('='.repeat(70));
    const _total = _results.length;
    if (_errors === 0) {
        console.log(`>>> RESULT: all ${_total} test cases passed`);
        process.exit(0);
    }
    console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
    process.exit(1);
})();
