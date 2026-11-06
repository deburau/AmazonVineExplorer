#!/usr/bin/env node
/**
 * verify_search.js
 *
 * Prueft die Suche nach Produkten in der Datenbank.
 *
 * Die Suche kann die Preisbedingungen der Keywords benutzen, z.B.
 * "kaffee price>=10". Anders als bei einem Keyword ist der Text nicht
 * Pflicht: "price<5" sucht nach dem Preis allein. Die Bedingungen stehen ohne
 * Klammern, ein Text in Klammern ist Text.
 *
 * Geprueft werden:
 *   - die Suche nach Text (wie bisher, alle Woerter muessen vorkommen)
 *   - Text und Preisbedingung zusammen
 *   - die Suche nur nach dem Preis
 *   - Produkte ohne bekannten Preis werden ignoriert
 *   - eine ungueltige Preisbedingung liefert kein Ergebnis
 *   - Klammern sind Text und keine Bedingung
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Preissuche ein
 * Feature ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_search.js
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

// Die Suche benutzt die Funktionen der Keywords, sie werden mit geprueft.
const CODE = [
    // Die Grenzen der Prioritaet einer Gotify-Nachricht (siehe parseKeywordConfig()).
    extractConstants(mainSrc, ['GOTIFY_PRIORITY_MIN', 'GOTIFY_PRIORITY_MAX']),
    extractBody(mainSrc, 'stringToRegex'),
    extractBody(mainSrc, 'normalizePriceInput'),
    extractBody(mainSrc, 'parsePriceCondition'),
    extractBody(mainSrc, 'aveIsConditionWord'),
    extractBody(mainSrc, 'aveSplitQuotedWords'),
    extractBody(mainSrc, 'aveUnquoteKeywordPart'),
    extractBody(mainSrc, 'parseCategoryCondition'),
    extractBody(mainSrc, 'parseGotifyPriorityCondition'),
    extractBody(mainSrc, 'parseKeywordConfig'),
    extractBody(mainSrc, 'getTaxPrices'),
    extractBody(mainSrc, 'matchPriceConditions'),
    extractBody(mainSrc, 'searchProducts')
].join('\n\n');

/**
 * Die Produkte der Datenbank. Nur bei "kaffee" ist ein Preis bekannt.
 */
const PRODUCTS = [
    { id: 'p1', description_full: 'kaffee vollautomat', data_estimated_tax_prices: [12.5] },
    { id: 'p2', description_full: 'kaffee maschine', data_estimated_tax_prices: [25] },
    { id: 'p3', description_full: 'kaffee tassen', data_estimated_tax_prices: [] },
    { id: 'p4', description_full: 'kaffee bohnen', data_estimated_tax_prices: [3] },
    { id: 'p5', description_full: 'teekanne glas', data_estimated_tax_prices: [40] },
    { id: 'p6', description_full: 'teekanne deckel' }
];

/**
 * Fuehrt die Suche in einer Sandbox mit gemockter Datenbank aus.
 *
 * @param {string} queryText Der Suchtext
 * @returns {Promise<string[]>} Die Ids der gefundenen Produkte
 */
async function search(queryText) {
    const _log = [];
    const sandbox = {
        console: { log: () => {}, warn: (text) => _log.push(text), error: () => {} },
        SETTINGS: { DebugLevel: 0 },
        database: {
            // Wie die echte Suche: alle Woerter muessen im Text vorkommen.
            query(words) {
                const _keys = words.map((word) => String(word).toLowerCase());
                return Promise.resolve(
                    PRODUCTS.filter((prod) => _keys.every((key) => prod.description_full.toLowerCase().includes(key))).map((prod) =>
                        Object.assign({}, prod)
                    )
                );
            },
            getAll() {
                return Promise.resolve(PRODUCTS.map((prod) => Object.assign({}, prod)));
            }
        },
        // Die Funktion matchPriceConditions() braucht Math.
        Math,
        Number,
        Array,
        Object,
        JSON,
        String,
        Promise
    };
    sandbox.globalThis = sandbox;

    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'search.js' });
    const _result = await vm.runInContext(`searchProducts(${JSON.stringify(queryText)})`, _ctx);
    return { ids: _result.map((prod) => prod.id), warnings: _log };
}

let _errors = 0;
// NOTE: Die Anzahl der Pruefungen wird gezaehlt, damit sie nicht gepflegt werden muss.
let _checks = 0;

/**
 * Prueft das Ergebnis einer Suche.
 * @param {string} queryText Der Suchtext
 * @param {string[]} expected Die erwarteten Ids
 * @param {string} label Die Bezeichnung der Pruefung
 */
async function check(queryText, expected, label) {
    _checks++;
    const _result = await search(queryText);
    if (JSON.stringify(_result.ids) === JSON.stringify(expected)) {
        console.log(`  OK   ${label}`);
        return;
    }
    _errors++;
    console.log(`  FAIL ${label}`);
    console.log(`         Suche: "${queryText}"  erwartet: ${JSON.stringify(expected)}  bekommen: ${JSON.stringify(_result.ids)}`);
}

(async () => {
    console.log('Suche nach Produkten pruefen');
    console.log('='.repeat(70));

    await check('kaffee', ['p1', 'p2', 'p3', 'p4'], 'Die Suche nach einem Wort');
    await check('kaffee bohnen', ['p4'], 'Die Suche nach zwei Woertern (alle muessen vorkommen)');
    await check('tee', ['p5', 'p6'], 'Die Suche nach einem anderen Wort');

    await check('kaffee price>=10', ['p1', 'p2'], 'Text und eine Preisbedingung');
    await check('kaffee price < 10', ['p4'], 'Text und eine Preisbedingung mit Leerzeichen');
    await check('kaffee price>=10 price<20', ['p1'], 'Text und zwei Preisbedingungen');

    await check('price<10', ['p4'], 'Nur nach dem Preis suchen');
    await check('price >= 40', ['p5'], 'Nur nach einem hohen Preis suchen');
    await check('price>=0', ['p1', 'p2', 'p4', 'p5'], 'Ein Preis, der immer passt: nur Produkte mit Preis');
    await check('price<=100', ['p1', 'p2', 'p4', 'p5'], 'Ein Preis, der immer passt (kleiner oder gleich)');
    await check('price != 12.5', ['p2', 'p4', 'p5'], 'Ein Preis, der nicht gleich ist');

    // NOTE: Produkte ohne bekannten Preis koennen keine Preisbedingung erfuellen.
    await check('price>=0 teekanne', ['p5'], 'Ein Produkt ohne Preis ist nicht im Ergebnis');
    await check('', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], 'Eine leere Suche findet alle Produkte');

    const _invalid = await search('price > abc');
    await check('price > abc', [], 'Eine ungueltige Preisbedingung liefert kein Ergebnis');
    _checks++;
    if (_invalid.warnings.length === 0) {
        _errors++;
        console.log('  FAIL Eine ungueltige Preisbedingung wird gemeldet');
    } else {
        console.log('  OK   Eine ungueltige Preisbedingung wird gemeldet');
    }

    // Ein Teil in doppelten Anfuehrungszeichen: die Anfuehrungszeichen werden
    // entfernt, gesucht wird der Text mit seinen Leerzeichen.
    await check('"kaffee bohnen"', ['p4'], 'Ein verbatim-String in der Suche');

    // Die Klammern sind kein Teil der Syntax mehr: der Text wird gesucht.
    await check('[kaffee]', [], 'Ein Text in Klammern ist kein Treffer, wenn er nicht im Text steht');
    await check('[price=0]', [], 'Eine Bedingung in Klammern ist Text und keine Bedingung');
    await check('[price>=0]', [], 'Auch eine Preisbedingung in Klammern sucht nur den Text');

    // Die Kategorie ist nicht in der Datenbank, die Suche kann sie nicht pruefen.
    const _category = await search('kaffee category=getränke');
    await check('kaffee category=getränke', [], 'Eine Kategoriebedingung liefert kein Ergebnis');
    _checks++;
    if (_category.warnings.length === 0) {
        _errors++;
        console.log('  FAIL Eine Kategoriebedingung wird gemeldet');
    } else {
        console.log('  OK   Eine Kategoriebedingung wird gemeldet');
    }

    console.log('');
    console.log('='.repeat(70));
    const _total = _checks;
    if (_errors === 0) {
        console.log(`>>> RESULT: all ${_total} test cases passed`);
        process.exit(0);
    }
    console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
    process.exit(1);
})();
