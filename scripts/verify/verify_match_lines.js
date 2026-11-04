#!/usr/bin/env node
/**
 * verify_match_lines.js
 *
 * Prueft die Zeilen, die den Grund einer Benachrichtigung nennen.
 *
 * Eine Desktop-Benachrichtigung und eine Gotify-Nachricht zeigen die Gruende
 * eines Treffers, eine Zeile je Art:
 *
 *   Keyword-Treffer: <keyword>
 *   Preis-Treffer: <preis>
 *   Kategorie-Treffer: <name der Kategorie>
 *
 * Es gibt also hoechstens drei Zeilen: eine Zeile nur, wenn es die Art des
 * Treffers auch gab. Der Preis ist der Preis des Produkts (bei Varianten die
 * Spanne), die Kategorie ist der Name der Kategorie der Seite.
 *
 * Geprueft werden:
 *   - nur Keyword, nur Preis und nur Kategorie
 *   - alle drei Zeilen zusammen (Reihenfolge)
 *   - die Spanne bei den Preisen der Varianten
 *   - eine andere Waehrung, ein unbekannter Preis
 *   - eine Kategoriebedingung ohne bekannte Kategorie (keine Zeile)
 *   - der Name des Symbols zu den Zeilen (getMatchImageName()), und dass die
 *     Bilddatei dazu im Verzeichnis images/ liegt - in der grossen Fassung und in
 *     der kleinen Fassung fuer die Nachricht von Gotify (aveMatchImageUrl())
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Zeilen der
 * Benachrichtigung ein Feature sind und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_match_lines.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { extractBody } = require('./lib/verify_helpers');

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

// Die Funktion, die die Zeilen bildet, und ihre Helfer.
const CODE = [
    extractBody(mainSrc, 'getTaxPrices'),
    extractBody(mainSrc, 'formatTaxPrize'),
    extractBody(mainSrc, 'formatMatchLines'),
    extractBody(mainSrc, 'getMatchImageName'),
    extractBody(mainSrc, 'aveMatchImageUrl')
].join('\n\n');

// Die Preise werden mit der Sprache des Systems formatiert, darum wird die
// Erwartung genauso berechnet wie im Script selbst.
const NUMBER_FORMAT = (value) => Intl.NumberFormat(undefined, { minimumFractionDigits: 2 }).format(value);

/**
 * Ruft formatMatchLines() in einer Sandbox aus.
 *
 * translate() liefert den Fallback des Aufrufers, damit der Test nicht von der
 * Sprache des Systems abhaengt.
 *
 * @param {object} entry Das geparste Keyword
 * @param {object} prod Das Produkt
 * @param {string} [categoryText] Der Name der Kategorie des Produkts
 * @returns {string[]} Die Zeilen der Benachrichtigung
 */
function matchLines(entry, prod, categoryText = '') {
    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
        // Der Fallback des Aufrufers ist der Text der Benachrichtigung.
        translate: (category, key, fallback) => fallback,
        Intl,
        Number,
        Array,
        Object,
        JSON,
        String
    };
    sandbox.globalThis = sandbox;

    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'match_lines.js' });
    return vm.runInContext(`formatMatchLines(${JSON.stringify(entry)}, ${JSON.stringify(prod)}, ${JSON.stringify(categoryText)})`, _ctx);
}

/**
 * Ruft getMatchImageName() in einer Sandbox aus.
 * @param {object} entry Das geparste Keyword
 * @returns {string} Der Name des Symbols
 */
function matchImageName(entry) {
    const sandbox = { console: { log: () => {}, warn: () => {}, error: () => {} }, Array, Object, JSON, String };
    sandbox.globalThis = sandbox;
    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'match_lines.js' });
    return vm.runInContext(`getMatchImageName(${JSON.stringify(entry)})`, _ctx);
}

/**
 * Ruft aveMatchImageUrl() in einer Sandbox aus.
 * @param {string} name Der Name des Symbols
 * @param {boolean} small true fuer die kleine Fassung
 * @returns {string} Die URL
 */
function matchImageUrl(name, small) {
    const sandbox = { console: { log: () => {}, warn: () => {}, error: () => {} }, Array, Object, JSON, String };
    sandbox.globalThis = sandbox;
    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'match_lines.js' });
    return vm.runInContext(`aveMatchImageUrl(${JSON.stringify(name)}, ${small ? 'true' : 'false'})`, _ctx);
}

/**
 * Baut den Eintrag eines Keywords fuer den Test.
 * @param {object} parts Die Teile des Eintrags
 * @returns {object} Der Eintrag
 */
function entry(parts = {}) {
    return Object.assign({ keyword: '', conditions: [], categories: [], valid: true }, parts);
}

const KEYWORD_ONLY = entry({ keyword: 'kaffee' });
const PRICE_ONLY = entry({ conditions: [{ op: '>=', price: 10 }] });
const CATEGORY_ONLY = entry({ categories: [{ text: 'kaffee' }] });
const ALL_THREE = entry({ keyword: 'kaffee', conditions: [{ op: '<=', price: 20 }], categories: [{ text: 'kaffee' }] });

const CASES = [
    {
        label: 'Nur ein Keyword-Treffer',
        entry: KEYWORD_ONLY,
        prod: { data_estimated_tax_prices: [12.5], data_tax_currency: 'EUR' },
        expected: ['Keyword-Treffer: kaffee']
    },
    {
        label: 'Nur ein Preis-Treffer',
        entry: PRICE_ONLY,
        prod: { data_estimated_tax_prices: [12.5], data_tax_currency: 'EUR' },
        expected: [`Preis-Treffer: ${NUMBER_FORMAT(12.5)} €`]
    },
    {
        label: 'Nur ein Kategorie-Treffer',
        entry: CATEGORY_ONLY,
        prod: { data_estimated_tax_prices: [], data_tax_currency: 'EUR' },
        categoryText: 'Lebensmittel & Getränke > Getränke, Kaffee & Tee',
        expected: ['Kategorie-Treffer: Lebensmittel & Getränke > Getränke, Kaffee & Tee']
    },
    {
        label: 'Alle drei Zeilen, in der Reihenfolge Keyword, Preis, Kategorie',
        entry: ALL_THREE,
        prod: { data_estimated_tax_prices: [12.5, 25], data_tax_currency: 'EUR' },
        categoryText: 'Kaffee',
        expected: ['Keyword-Treffer: kaffee', `Preis-Treffer: ${NUMBER_FORMAT(12.5)} - ${NUMBER_FORMAT(25)} €`, 'Kategorie-Treffer: Kaffee']
    },
    {
        label: 'Keyword und Preis',
        entry: entry({ keyword: 'toaster', conditions: [{ op: '>', price: 5 }] }),
        prod: { data_estimated_tax_prices: [9], data_tax_currency: 'EUR' },
        expected: ['Keyword-Treffer: toaster', `Preis-Treffer: ${NUMBER_FORMAT(9)} €`]
    },
    {
        label: 'Keyword und Kategorie',
        entry: entry({ keyword: 'kaffee', categories: [{ text: 'kaffee' }] }),
        prod: { data_estimated_tax_prices: [9], data_tax_currency: 'EUR' },
        categoryText: 'Kaffee',
        expected: ['Keyword-Treffer: kaffee', 'Kategorie-Treffer: Kaffee']
    },
    {
        label: 'Eine andere Waehrung hat kein Symbol',
        entry: PRICE_ONLY,
        prod: { data_estimated_tax_prices: [12.5], data_tax_currency: 'USD' },
        expected: [`Preis-Treffer: ${NUMBER_FORMAT(12.5)}`]
    },
    {
        // Kann nur passieren, wenn die Bedingung ohne Preis gepasst hat. Die
        // Zeile ist trotzdem definiert, sie zeigt "--.--".
        label: 'Ein unbekannter Preis',
        entry: PRICE_ONLY,
        prod: { data_estimated_tax_prices: [], data_tax_currency: 'EUR' },
        expected: ['Preis-Treffer: --.--']
    },
    {
        label: 'Eine Kategoriebedingung ohne bekannte Kategorie',
        entry: CATEGORY_ONLY,
        prod: { data_estimated_tax_prices: [], data_tax_currency: 'EUR' },
        categoryText: '',
        expected: []
    },
    {
        label: 'Ein Keyword ohne Bedingungen',
        entry: entry({ keyword: 'toaster' }),
        prod: { data_estimated_tax_prices: [9], data_tax_currency: 'EUR' },
        expected: ['Keyword-Treffer: toaster']
    }
];

let _errors = 0;
// NOTE: Die Anzahl der Pruefungen wird gezaehlt, damit sie nicht gepflegt werden muss.
let _checks = 0;

/**
 * Prueft die Zeilen einer Benachrichtigung.
 * @param {object} testCase Der Fall
 */
function check(testCase) {
    _checks++;
    const _lines = matchLines(testCase.entry, testCase.prod, testCase.categoryText || '');
    if (JSON.stringify(_lines) === JSON.stringify(testCase.expected)) {
        console.log(`  OK   ${testCase.label}`);
        return;
    }
    _errors++;
    console.log(`  FAIL ${testCase.label}`);
    console.log(`         erwartet: ${JSON.stringify(testCase.expected)}  bekommen: ${JSON.stringify(_lines)}`);
}

/**
 * Prueft den Namen des Symbols und ob die Bilddatei dazu im Repository liegt.
 * @param {object} entry Das geparste Keyword
 * @param {string} expected Der erwartete Dateiname ohne Endung
 */
function checkImageName(entry, expected) {
    _checks++;
    const _name = matchImageName(entry);
    const _big = path.join(REPO_ROOT, 'images', `${_name}.png`);
    const _small = path.join(REPO_ROOT, 'images', `${_name}_small.png`);
    const _url = matchImageUrl(_name, true);
    const _problems = [];
    if (_name !== expected) _problems.push(`erwartet "${expected}", bekommen "${_name}"`);
    if (!fs.existsSync(_big)) _problems.push('grosse Bilddatei fehlt');
    if (!fs.existsSync(_small)) _problems.push('kleine Bilddatei fehlt');
    if (!_url.endsWith(`/main/images/${expected}_small.png`)) _problems.push(`URL falsch: ${_url}`);
    if (_problems.length > 0) {
        _errors++;
        console.log(`  FAIL Symbol ${expected}: ${_problems.join(', ')}`);
        return;
    }
    console.log(`  OK   Symbol ${_name}.png und ${_name}_small.png (Dateien und URL vorhanden)`);
}

console.log('Zeilen der Benachrichtigung pruefen (Keyword, Preis, Kategorie)');
console.log('='.repeat(70));

for (const _testCase of CASES) {
    check(_testCase);
}

console.log('');
console.log('Symbol der Benachrichtigung pruefen (Dateien in images/)');
console.log('-'.repeat(70));
checkImageName(entry({ keyword: 'kaffee' }), 'vine_logo_match_k');
checkImageName(entry({ conditions: [{ op: '>', price: 1 }] }), 'vine_logo_match_p');
checkImageName(entry({ categories: [{ text: 'kaffee' }] }), 'vine_logo_match_c');
checkImageName(entry({ keyword: 'kaffee', categories: [{ text: 'kaffee' }] }), 'vine_logo_match_k_c');
checkImageName(entry({ keyword: 'kaffee', conditions: [{ op: '>', price: 1 }] }), 'vine_logo_match_k_p');
checkImageName(entry({ categories: [{ text: 'kaffee' }], conditions: [{ op: '>', price: 1 }] }), 'vine_logo_match_c_p');
checkImageName(ALL_THREE, 'vine_logo_match_k_c_p');
checkImageName(entry({}), 'vine_logo_match_none');

console.log('');
console.log('='.repeat(70));
const _total = _checks;
if (_errors === 0) {
    console.log(`>>> RESULT: all ${_total} test cases passed`);
    process.exit(0);
}
console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
process.exit(1);
