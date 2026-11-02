#!/usr/bin/env node
/**
 * verify_price_conditions.js
 *
 * Prueft die Preisbedingungen der Keywords.
 *
 * Ein Keyword kann Preisbedingungen enthalten, z. B.
 * "toaster [price >= 10] [price < 20]".
 * Die Bedingungen werden nur zusammen mit dem Keyword geprueft.
 *
 * Geprueft werden:
 *   - die Normalisierung der Preise aus der Benutzereingabe (normalizePriceInput())
 *   - das Parsen einer Preisbedingung (parsePriceCondition())
 *   - das Parsen eines Keywords mit Bedingungen (parseKeywordConfig())
 *   - der Vergleich der Bedingungen mit den Preisen (matchPriceConditions())
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Preisbedingungen
 * ein Feature sind und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_price_conditions.js
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

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Funktionen werden
// aus der echten Datei geschnitten, damit der Test die echte Implementierung
// prueft und keinen Nachbau.
const CODE = [
    extractBody(mainSrc, 'normalizePriceInput'),
    extractBody(mainSrc, 'parsePriceCondition'),
    extractBody(mainSrc, 'parseKeywordConfig'),
    extractBody(mainSrc, 'matchPriceConditions')
].join('\n\n');

const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math,
    Number,
    Array,
    Object,
    JSON,
    String
};
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: 'price_conditions.js' });

const normalizePriceInput = vm.runInContext('normalizePriceInput', ctx);
const parsePriceCondition = vm.runInContext('parsePriceCondition', ctx);
const parseKeywordConfig = vm.runInContext('parseKeywordConfig', ctx);
const matchPriceConditions = vm.runInContext('matchPriceConditions', ctx);

/**
 * Die erwarteten Ergebnisse der Normalisierung der Preise.
 * null bedeutet, dass die Eingabe kein gueltiger Preis ist.
 */
const PRICE_CASES = [
    { label: 'Eine ganze Zahl', input: '10', expected: 10 },
    { label: 'Ein Preis mit Punkt', input: '10.50', expected: 10.5 },
    { label: 'Ein Preis mit Komma', input: '10,50', expected: 10.5 },
    { label: 'Ein Preis ohne Nachkommastellen', input: '10.', expected: 10 },
    { label: 'Ein Preis ohne Vorkommastellen', input: '.5', expected: 0.5 },
    { label: 'Ein negativer Preis', input: '-5.25', expected: -5.25 },
    { label: 'Tausendertrennzeichen mit Komma am Ende', input: '1.234,56', expected: 1234.56 },
    { label: 'Tausendertrennzeichen mit Punkt am Ende', input: '1,234.56', expected: 1234.56 },
    { label: 'Zwei Punkte sind nicht erlaubt', input: '1.234.567', expected: null },
    { label: 'Zwei Kommas sind nicht erlaubt', input: '1,234,567', expected: null },
    { label: 'Buchstaben sind nicht erlaubt', input: 'abc', expected: null },
    { label: 'Eine Einheit ist nicht erlaubt', input: '10 EUR', expected: null },
    { label: 'Eine leere Eingabe ist nicht erlaubt', input: '', expected: null },
    { label: 'Nur ein Trennzeichen am Ende', input: '10,', expected: 10 }
];

/**
 * Die erwarteten Ergebnisse des Parsens einer Preisbedingung.
 */
const CONDITION_CASES = [
    { label: 'Groesser als', input: 'price > 10', expected: { op: '>', price: 10 } },
    { label: 'Groesser oder gleich', input: 'price >= 10', expected: { op: '>=', price: 10 } },
    { label: 'Kleiner als', input: 'price < 10', expected: { op: '<', price: 10 } },
    { label: 'Kleiner oder gleich', input: 'price <= 10', expected: { op: '<=', price: 10 } },
    { label: 'Gleich', input: 'price = 10', expected: { op: '=', price: 10 } },
    { label: 'Gleich (zwei Zeichen)', input: 'price == 10', expected: { op: '==', price: 10 } },
    { label: 'Ungleich', input: 'price != 10', expected: { op: '!=', price: 10 } },
    { label: 'Ungleich (zwei Zeichen)', input: 'price <> 10', expected: { op: '<>', price: 10 } },
    {
        label: 'Preis mit Komma und Leerzeichen',
        input: 'price >= 10,50',
        expected: { op: '>=', price: 10.5 }
    },
    { label: 'Ein unbekanntes Feld', input: 'data_estimated_tax_prize > 10', expected: null },
    { label: 'Ein unbekannter Operator', input: 'price ~ 10', expected: null },
    { label: 'Ein ungueltiger Preis', input: 'price > abc', expected: null }
];

/**
 * Die erwarteten Ergebnisse des Parsens eines Keywords.
 */
const KEYWORD_CASES = [
    {
        label: 'Ein einfaches Keyword bleibt unveraendert',
        input: 'toaster',
        expected: { keyword: 'toaster', conditions: [], valid: true }
    },
    {
        label: 'Ein regulaerer Ausdruck bleibt unveraendert',
        input: '/wicht.*produkt/i',
        expected: { keyword: '/wicht.*produkt/i', conditions: [], valid: true }
    },
    {
        label: 'Ein Keyword mit einer Preisbedingung',
        input: 'toaster [price >= 10]',
        expected: { keyword: 'toaster', conditions: [{ op: '>=', price: 10 }], valid: true }
    },
    {
        label: 'Ein Keyword mit zwei Preisbedingungen',
        input: 'toaster [price >= 10] [price < 20]',
        expected: {
            keyword: 'toaster',
            conditions: [
                { op: '>=', price: 10 },
                { op: '<', price: 20 }
            ],
            valid: true
        }
    },
    {
        label: 'Eine Preisbedingung ohne Keyword',
        input: '[price >= 10]',
        expected: { keyword: '', conditions: [{ op: '>=', price: 10 }], valid: true }
    },
    {
        label: 'Eine kaputte Preisbedingung macht das Keyword ungueltig',
        input: 'toaster [price > abc]',
        expected: { keyword: 'toaster [price > abc]', conditions: [], valid: false }
    },
    {
        label: 'Ein Keyword mit dem Wort price, aber ohne Bedingung',
        input: 'special price',
        expected: { keyword: 'special price', conditions: [], valid: true }
    },
    {
        label: 'Eine Bedingung mit dem alten Feldnamen ist ungueltig',
        input: 'toaster [data_estimated_tax_prices >= 10]',
        expected: { keyword: 'toaster [data_estimated_tax_prices >= 10]', conditions: [], valid: false }
    }
];

/**
 * Die erwarteten Ergebnisse des Vergleichs der Bedingungen mit den Preisen.
 */
const MATCH_CASES = [
    {
        label: 'Ein Preis ist gleich',
        conditions: [{ op: '=', price: 12.5 }],
        prices: [12.5],
        expected: true
    },
    {
        label: 'Kein Preis ist gleich',
        conditions: [{ op: '=', price: 12.5 }],
        prices: [10, 25],
        expected: false
    },
    {
        label: 'Kein Preis ist gleich (ungleich)',
        conditions: [{ op: '!=', price: 12.5 }],
        prices: [10, 25],
        expected: true
    },
    {
        label: 'Ein Preis ist gleich (ungleich)',
        conditions: [{ op: '!=', price: 12.5 }],
        prices: [12.5, 25],
        expected: false
    },
    {
        label: 'Der kleinste Preis ist kleiner',
        conditions: [{ op: '<', price: 20 }],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Der kleinste Preis ist nicht kleiner',
        conditions: [{ op: '<', price: 12.5 }],
        prices: [12.5, 25],
        expected: false
    },
    {
        label: 'Der kleinste Preis ist kleiner oder gleich',
        conditions: [{ op: '<=', price: 12.5 }],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Der groesste Preis ist groesser',
        conditions: [{ op: '>', price: 20 }],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Der groesste Preis ist nicht groesser',
        conditions: [{ op: '>', price: 25 }],
        prices: [12.5, 25],
        expected: false
    },
    {
        label: 'Der groesste Preis ist groesser oder gleich',
        conditions: [{ op: '>=', price: 25 }],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Zwei Bedingungen passen',
        conditions: [
            { op: '>=', price: 10 },
            { op: '<', price: 20 }
        ],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Eine von zwei Bedingungen passt nicht',
        conditions: [
            { op: '>=', price: 10 },
            { op: '<', price: 12.5 }
        ],
        prices: [12.5, 25],
        expected: false
    },
    {
        label: 'Ohne Preise passt keine Bedingung',
        conditions: [{ op: '!=', price: 12.5 }],
        prices: [],
        expected: false
    }
];

console.log('Preisbedingungen der Keywords pruefen');
console.log('='.repeat(70));

let _errors = 0;

/**
 * Vergleicht zwei Werte und gibt eine Fehlermeldung aus, wenn sie sich unterscheiden.
 * @param {*} expected Der erwartete Wert
 * @param {*} actual Der erhaltene Wert
 * @param {string} label Die Bezeichnung der Pruefung
 */
function check(expected, actual, label) {
    if (JSON.stringify(expected) === JSON.stringify(actual)) return;
    _errors++;
    console.log(`  FAIL ${label}`);
    console.log(`         erwartet: ${JSON.stringify(expected)}  bekommen: ${JSON.stringify(actual)}`);
}

for (const _case of PRICE_CASES) {
    check(_case.expected, normalizePriceInput(_case.input), _case.label);
}

for (const _case of CONDITION_CASES) {
    check(_case.expected, parsePriceCondition(_case.input), _case.label);
}

for (const _case of KEYWORD_CASES) {
    check(_case.expected, parseKeywordConfig(_case.input), _case.label);
}

for (const _case of MATCH_CASES) {
    check(_case.expected, matchPriceConditions(_case.conditions, _case.prices), _case.label);
}

const _total = PRICE_CASES.length + CONDITION_CASES.length + KEYWORD_CASES.length + MATCH_CASES.length;
if (_errors === 0) {
    console.log(`  alle ${_total} Faelle sind ok`);
} else {
    console.log(`  ${_errors} von ${_total} Faellen sind fehlgeschlagen`);
}

console.log('');
console.log('='.repeat(70));
if (_errors === 0) {
    console.log(`>>> RESULT: all ${_total} test cases passed`);
    process.exit(0);
}
console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
process.exit(1);
