#!/usr/bin/env node
/**
 * verify_keyword_conditions.js
 *
 * Prueft die Bedingungen der Keywords (Preis und Kategorie).
 *
 * Ein Keyword kann Preisbedingungen enthalten, z. B.
 * "toaster price>=10 price<20", und Kategoriebedingungen, z. B.
 * "category~getraenke". Ein Text oder eine Kategorie muss angegeben sein, nur
 * Preisbedingungen koennen nie matchen.
 *
 * NOTE: Die Bedingungen stehen ohne Klammern und sind immer ein eigenes Wort,
 * damit die Klammern (AltGr) nicht getippt werden muessen. "[price=0]" ist
 * daher Text und keine Bedingung (siehe die Faelle unten).
 *
 * Geprueft werden:
 *   - die Normalisierung der Preise aus der Benutzereingabe (normalizePriceInput())
 *   - das Parsen einer Preisbedingung (parsePriceCondition())
 *   - das Parsen eines Keywords mit Bedingungen (parseKeywordConfig())
 *   - der Vergleich der Bedingungen mit den Preisen (matchPriceConditions())
 *   - das Parsen einer Kategoriebedingung (parseCategoryCondition())
 *   - der Vergleich der Kategorie mit dem Namen der Kategorie (matchCategoryConditions())
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Preisbedingungen
 * ein Feature sind und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_keyword_conditions.js
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
    extractBody(mainSrc, 'parseCategoryCondition'),
    extractBody(mainSrc, 'parseKeywordConfig'),
    extractBody(mainSrc, 'matchPriceConditions'),
    extractBody(mainSrc, 'matchCategoryConditions')
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
const parseCategoryCondition = vm.runInContext('parseCategoryCondition', ctx);
const matchCategoryConditions = vm.runInContext('matchCategoryConditions', ctx);

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
 * Die erwarteten Ergebnisse des Parsens einer Kategoriebedingung.
 */
const CATEGORY_CONDITION_CASES = [
    { label: 'Eine Kategorie', input: 'category~getraenke', expected: { text: 'getraenke' } },
    { label: 'Eine Kategorie mit Leerzeichen', input: 'category ~ Lebensmittel', expected: { text: 'lebensmittel' } },
    { label: 'Eine Kategorie ohne Text', input: 'category~', expected: null },
    { label: 'Eine Kategorie ohne Tilde', input: 'category=getraenke', expected: null },
    { label: 'Ein unbekanntes Feld', input: 'kategorie~getraenke', expected: null }
];

/**
 * Die erwarteten Ergebnisse des Vergleichs der Kategorie.
 */
const CATEGORY_MATCH_CASES = [
    {
        label: 'Der Name kommt in der Kategorie vor',
        categories: [{ text: 'getränke' }],
        categoryText: 'Lebensmittel & Getränke',
        expected: true
    },
    {
        label: 'Der Name kommt nicht vor',
        categories: [{ text: 'getränke' }],
        categoryText: 'Garten',
        expected: false
    },
    {
        label: 'Der Name kommt auch in einer Unterkategorie vor',
        categories: [{ text: 'kaffee' }],
        categoryText: 'Lebensmittel & Getränke > Getränke, Kaffee & Tee',
        expected: true
    },
    {
        label: 'Ohne Kategorie passt keine Bedingung',
        categories: [{ text: 'getränke' }],
        categoryText: '',
        expected: false
    },
    {
        label: 'Beide Bedingungen muessen passen',
        categories: [{ text: 'lebensmittel' }, { text: 'tee' }],
        categoryText: 'Lebensmittel & Getränke > Getränke, Kaffee & Tee',
        expected: true
    },
    {
        label: 'Eine von zwei Bedingungen passt nicht',
        categories: [{ text: 'lebensmittel' }, { text: 'blumen' }],
        categoryText: 'Lebensmittel & Getränke > Getränke, Kaffee & Tee',
        expected: false
    }
];

/**
 * Die erwarteten Ergebnisse des Parsens eines Keywords.
 */
const KEYWORD_CASES = [
    {
        label: 'Ein einfaches Keyword bleibt unveraendert',
        input: 'toaster',
        expected: { keyword: 'toaster', conditions: [], categories: [], valid: true }
    },
    {
        label: 'Ein regulaerer Ausdruck bleibt unveraendert',
        input: '/wicht.*produkt/i',
        expected: { keyword: '/wicht.*produkt/i', conditions: [], categories: [], valid: true }
    },
    {
        label: 'Ein Keyword mit einer Preisbedingung',
        input: 'toaster price >= 10',
        expected: { keyword: 'toaster', conditions: [{ op: '>=', price: 10 }], categories: [], valid: true }
    },
    {
        label: 'Eine Preisbedingung ohne Leerzeichen',
        input: 'toaster price>=10',
        expected: { keyword: 'toaster', conditions: [{ op: '>=', price: 10 }], categories: [], valid: true }
    },
    {
        label: 'Ein Komma als Dezimaltrennzeichen',
        input: 'kaffee price>=10,50',
        expected: { keyword: 'kaffee', conditions: [{ op: '>=', price: 10.5 }], categories: [], valid: true }
    },
    {
        label: 'Ein Keyword mit zwei Preisbedingungen',
        input: 'toaster price >= 10 price < 20',
        expected: {
            keyword: 'toaster',
            conditions: [
                { op: '>=', price: 10 },
                { op: '<', price: 20 }
            ],
            categories: [],
            valid: true
        }
    },
    {
        label: 'Eine Preisbedingung ohne Keyword',
        input: 'price >= 10',
        expected: { keyword: '', conditions: [{ op: '>=', price: 10 }], categories: [], valid: true }
    },
    {
        // Die Bedingung steht in der Mitte: die Leerzeichen drumherum muessen
        // mitverschwinden, sonst sucht das Script nach "toaster   white".
        label: 'Eine Bedingung zwischen zwei Woertern',
        input: 'toaster price > 100 white',
        expected: { keyword: 'toaster white', conditions: [{ op: '>', price: 100 }], categories: [], valid: true }
    },
    {
        label: 'Eine Bedingung am Anfang',
        input: 'price > 100 toaster white',
        expected: { keyword: 'toaster white', conditions: [{ op: '>', price: 100 }], categories: [], valid: true }
    },
    {
        label: 'Eine Bedingung am Ende',
        input: 'toaster white price > 100',
        expected: { keyword: 'toaster white', conditions: [{ op: '>', price: 100 }], categories: [], valid: true }
    },
    {
        label: 'Ein Keyword mit einer Kategoriebedingung',
        input: 'kaffee category~getraenke',
        expected: { keyword: 'kaffee', conditions: [], categories: [{ text: 'getraenke' }], valid: true }
    },
    {
        // Der Ausdruck der Anforderung: ein Preis ohne Keyword, nur mit Kategorie.
        label: 'Nur Bedingungen ohne Keyword',
        input: 'price=0 category~getränke',
        expected: { keyword: '', conditions: [{ op: '=', price: 0 }], categories: [{ text: 'getränke' }], valid: true }
    },
    {
        label: 'Zwei Kategoriebedingungen',
        input: 'category~lebensmittel category~tee',
        expected: {
            keyword: '',
            conditions: [],
            categories: [{ text: 'lebensmittel' }, { text: 'tee' }],
            valid: true
        }
    },
    {
        label: 'Eine kaputte Preisbedingung macht das Keyword ungueltig',
        input: 'toaster price > abc',
        expected: { keyword: 'toaster price > abc', conditions: [], categories: [], valid: false }
    },
    {
        label: 'Eine kaputte Kategoriebedingung macht das Keyword ungueltig',
        input: 'kaffee category~',
        expected: { keyword: 'kaffee category~', conditions: [], categories: [], valid: false }
    },
    {
        label: 'Ein Keyword mit dem Wort price, aber ohne Bedingung',
        input: 'special price',
        expected: { keyword: 'special price', conditions: [], categories: [], valid: true }
    },
    {
        label: 'Ein Keyword mit dem Wort category, aber ohne Bedingung',
        input: 'category',
        expected: { keyword: 'category', conditions: [], categories: [], valid: true }
    },
    {
        // Die Klammern sind kein Teil der Syntax mehr: der Text wird gesucht.
        label: 'Klammern sind Text und keine Bedingung',
        input: '[price=0]',
        expected: { keyword: '[price=0]', conditions: [], categories: [], valid: true }
    },
    {
        label: 'Auch eine Kategoriebedingung in Klammern ist Text',
        input: 'kaffee [category~getränke]',
        expected: {
            keyword: 'kaffee [category~getränke]',
            conditions: [],
            categories: [],
            valid: true
        }
    },
    {
        label: 'Nur die englischen Feldnamen sind Bedingungen',
        input: 'kaffee preis>=10',
        expected: { keyword: 'kaffee preis>=10', conditions: [], categories: [], valid: true }
    },
    {
        label: 'Ein anderer Feldname ist keine Bedingung',
        input: 'toaster data_estimated_tax_prices >= 10',
        expected: {
            keyword: 'toaster data_estimated_tax_prices >= 10',
            conditions: [],
            categories: [],
            valid: true
        }
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
    },
    {
        // Ein Produkt ohne Preis hat eine leere Liste, es darf nicht als
        // "Preis 0" gelten.
        label: 'Ohne Preis matcht "= 0" nicht',
        conditions: [{ op: '=', price: 0 }],
        prices: [],
        expected: false
    },
    {
        label: 'Ein echter Preis von 0 matcht "= 0"',
        conditions: [{ op: '=', price: 0 }],
        prices: [0],
        expected: true
    },
    {
        label: 'Ein Preis groesser 0 matcht "= 0" nicht',
        conditions: [{ op: '=', price: 0 }],
        prices: [25],
        expected: false
    },
    {
        label: 'Ohne Preis matcht ">= 0" nicht',
        conditions: [{ op: '>=', price: 0 }],
        prices: [],
        expected: false
    }
];

console.log('Bedingungen der Keywords pruefen (Preis und Kategorie)');
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

for (const _case of CATEGORY_CONDITION_CASES) {
    check(_case.expected, parseCategoryCondition(_case.input), _case.label);
}

for (const _case of CATEGORY_MATCH_CASES) {
    check(_case.expected, matchCategoryConditions(_case.categories, _case.categoryText), _case.label);
}

for (const _case of KEYWORD_CASES) {
    check(_case.expected, parseKeywordConfig(_case.input), _case.label);
}

for (const _case of MATCH_CASES) {
    check(_case.expected, matchPriceConditions(_case.conditions, _case.prices), _case.label);
}

const _total =
    PRICE_CASES.length +
    CONDITION_CASES.length +
    CATEGORY_CONDITION_CASES.length +
    KEYWORD_CASES.length +
    CATEGORY_MATCH_CASES.length +
    MATCH_CASES.length;
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
