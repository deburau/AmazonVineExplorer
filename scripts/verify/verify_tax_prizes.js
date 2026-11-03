#!/usr/bin/env node
/**
 * verify_tax_prizes.js
 *
 * Prueft die Preise der Varianten und ihre Anzeige auf den Tiles.
 *
 * Anders als die anderen Skripte in diesem Ordner vergleicht dieses Skript
 * nicht eine alte mit einer neuen Implementierung, sondern prueft das
 * aktuelle Verhalten gegen erwartete Werte. Der Grund ist, dass die Aenderung
 * ein Feature ist und kein Refactoring: die Produkte bekommen eine neue Spalte
 * in der Datenbank und die Tiles zeigen den Bereich der Preise der Varianten.
 *
 * Geprueft werden:
 *   - die Migration der Produkte auf die Version 5 der Datenbank
 *     (migrateProductToVersion5() in class_db_handler.js)
 *   - die Preise, die fuer die Anzeige benutzt werden (getTaxPrices())
 *   - die Formatierung der Preise (formatTaxPrize())
 *
 * Usage: node scripts/verify/verify_tax_prizes.js
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

const dbSrc = readSource('class_db_handler.js');
const mainSrc = readSource('VineExplorer.user.js');

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Funktionen werden
// aus den echten Dateien geschnitten, damit der Test die echte Implementierung
// prueft und keinen Nachbau.
const CODE = [
    extractBody(dbSrc, 'migrateProductToVersion5'),
    extractBody(mainSrc, 'getTaxPrices'),
    extractBody(mainSrc, 'formatTaxPrize')
].join('\n\n');

// Das Zahlenformat wird fest vorgegeben, damit die Pruefung nicht von der
// Sprache des Systems abhaengt.
const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Intl: {
        NumberFormat: () => ({
            format: (value) => value.toFixed(2)
        })
    },
    Number,
    Math,
    Array,
    Object,
    JSON
};
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: 'tax_prizes.js' });

const migrateProductToVersion5 = vm.runInContext('migrateProductToVersion5', ctx);
const getTaxPrices = vm.runInContext('getTaxPrices', ctx);
const formatTaxPrize = vm.runInContext('formatTaxPrize', ctx);

/**
 * Die erwarteten Ergebnisse der Migration der Produkte.
 */
const MIGRATION_CASES = [
    {
        label: 'Produkt ohne Preis bekommt eine leere Liste',
        product: { id: 'p1', data_asin: 'ASIN1' },
        expected: [],
        // Ohne Preis bleibt der Merker falsch, das Produkt wird einmal angefragt.
        expectedRequested: false
    },
    {
        label: 'Der Preis des Produkts wird in die Liste uebernommen',
        product: { id: 'p2', data_asin: 'ASIN2', data_estimated_tax_prize: 12.5 },
        expected: [12.5],
        // Mit Preis gilt der Request als erledigt, er wird nicht wiederholt.
        expectedRequested: true
    },
    {
        label: 'Produkt mit Varianten bekommt die Preise aller Varianten',
        product: {
            id: 'p3',
            data_asin: 'ASIN3',
            data_childs: [
                { asin: 'CHILD1', taxValue: 12.5 },
                { asin: 'CHILD2', taxValue: 25 }
            ]
        },
        expected: [12.5, 25]
    },
    {
        label: 'Der Preis des Produkts und die Preise der Varianten werden uebernommen',
        product: {
            id: 'p4',
            data_asin: 'ASIN4',
            data_estimated_tax_prize: 25,
            data_childs: [
                { asin: 'CHILD1', taxValue: 12.5 },
                { asin: 'CHILD2', taxValue: 25 }
            ]
        },
        expected: [25, 12.5]
    },
    {
        label: 'Varianten ohne Preis werden ignoriert',
        product: {
            id: 'p5',
            data_asin: 'ASIN5',
            data_childs: [{ asin: 'CHILD1' }, { asin: 'CHILD2', taxValue: 25 }]
        },
        expected: [25]
    },
    {
        label: 'Ein bereits migriertes Produkt behaelt seine Liste',
        product: { id: 'p6', data_asin: 'ASIN6', data_estimated_tax_prices: [7.7] },
        expected: [7.7],
        // Der Merker fehlte in dieser Liste, er wird nachgetragen.
        expectedRequested: true
    },
    {
        label: 'Ein Produkt ohne Varianten in der Datenbank bleibt gueltig',
        product: { id: 'p7', data_asin: 'ASIN7', data_childs: [] },
        expected: [],
        expectedRequested: false
    }
];

/**
 * Die erwarteten Ergebnisse der Anzeige der Preise.
 * expectedPrizes sind die Preise, die fuer die Anzeige benutzt werden.
 */
const DISPLAY_CASES = [
    {
        label: 'Kein Preis bekannt: der Platzhalter wird gezeigt',
        product: {},
        expectedPrizes: [],
        expected: '--.--'
    },
    {
        label: 'Die Liste mit einem Preis: der Preis wird gezeigt',
        product: { data_estimated_tax_prices: [12.5], data_tax_currency: 'EUR' },
        expectedPrizes: [12.5],
        expected: '12.50 €'
    },
    {
        label: 'Die Preise der Varianten sind bekannt: der Bereich wird gezeigt',
        product: {
            data_estimated_tax_prices: [25, 12.5],
            data_tax_currency: 'EUR'
        },
        expectedPrizes: [25, 12.5],
        expected: '12.50 - 25.00 €'
    },
    {
        label: 'Alle Varianten haben den gleichen Preis: der Bereich wird immer gezeigt',
        product: {
            data_estimated_tax_prices: [12.5, 12.5],
            data_tax_currency: 'EUR'
        },
        expectedPrizes: [12.5, 12.5],
        expected: '12.50 - 12.50 €'
    },
    {
        label: 'Eine andere Waehrung: es wird kein Waehrungszeichen gezeigt',
        // NOTE: Der Leerzeichen am Ende ist das bisherige Verhalten, es ist im
        // Text nicht zu sehen.
        product: { data_estimated_tax_prices: [12.5], data_tax_currency: 'USD' },
        expectedPrizes: [12.5],
        expected: '12.50 '
    },
    {
        label: 'Der Preis des Produkts wird nicht mehr benutzt',
        product: { data_estimated_tax_prize: 99, data_tax_currency: 'EUR' },
        expectedPrizes: [],
        expected: '--.--'
    },
    {
        label: 'Eine leere Liste: es wird kein Preis angezeigt',
        product: {
            data_estimated_tax_prize: 12.5,
            data_estimated_tax_prices: [],
            data_tax_currency: 'EUR'
        },
        expectedPrizes: [],
        expected: '--.--'
    }
];

console.log('Migration der Produkte pruefen');
console.log('='.repeat(70));

let _errors = 0;

for (const _case of MIGRATION_CASES) {
    const _result = migrateProductToVersion5(JSON.parse(JSON.stringify(_case.product)));
    const _actual = Array.isArray(_result.data_estimated_tax_prices) ? _result.data_estimated_tax_prices : [];

    const _problems = [];
    if (JSON.stringify(_actual) !== JSON.stringify(_case.expected)) {
        _problems.push(`erwartet: ${JSON.stringify(_case.expected)}  bekommen: ${JSON.stringify(_actual)}`);
    }
    // Der Merker detailsRequested verhindert eine zweite Anfrage der Details.
    if (_case.expectedRequested !== undefined && !!_result.detailsRequested !== _case.expectedRequested) {
        _problems.push(`detailsRequested erwartet: ${_case.expectedRequested}  bekommen: ${!!_result.detailsRequested}`);
    }

    if (_problems.length === 0) {
        console.log(`  OK   ${_case.label}`);
    } else {
        _errors++;
        console.log(`  FAIL ${_case.label}`);
        for (const _problem of _problems) console.log(`         ${_problem}`);
    }
}

console.log('');
console.log('Anzeige der Preise pruefen');
console.log('='.repeat(70));

for (const _case of DISPLAY_CASES) {
    const _actual = formatTaxPrize(_case.product);
    const _actualPrizes = getTaxPrices(_case.product);

    const _problems = [];
    if (_actual !== _case.expected) _problems.push(`erwartet: "${_case.expected}"  bekommen: "${_actual}"`);
    if (JSON.stringify(_actualPrizes) !== JSON.stringify(_case.expectedPrizes))
        _problems.push(`Preise erwartet: ${JSON.stringify(_case.expectedPrizes)}  bekommen: ${JSON.stringify(_actualPrizes)}`);

    if (_problems.length === 0) {
        console.log(`  OK   ${_case.label}`);
    } else {
        _errors++;
        console.log(`  FAIL ${_case.label}`);
        for (const _problem of _problems) console.log(`         ${_problem}`);
    }
}

console.log('');
console.log('='.repeat(70));
const _total = MIGRATION_CASES.length + DISPLAY_CASES.length;
if (_errors === 0) {
    console.log(`>>> RESULT: all ${_total} test cases passed`);
    process.exit(0);
}
console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
process.exit(1);
