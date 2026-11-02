#!/usr/bin/env node
/**
 * verify_request_delay.js
 *
 * Prueft die Verzoegerung zwischen den Requests der Preisdetails.
 *
 * Es gibt zwei Verzoegerungen:
 *   - zwischen den Produkten der Queue (PRODUCT_DETAILS_REQUEST_DELAY), sie
 *     bleibt unveraendert bei 1500 ms, weil Amazon den Account temporaer
 *     sperrt, wenn zu viele Requests in kurzer Zeit kommen
 *   - zwischen den Requests fuer die Varianten eines Produkts, sie ist die
 *     Einstellung "VariationRequestDelay" und wird um +/- 50 Prozent
 *     randomisiert, damit die Requests nicht in einem festen Rhythmus kommen
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Verzoegerung ein
 * Feature ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_request_delay.js
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

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Funktionen werden
// aus den echten Dateien geschnitten, damit der Test die echte Implementierung
// prueft und keinen Nachbau.
const CODE = [
    extractConstants(mainSrc, ['PRODUCT_DETAILS_REQUEST_DELAY', 'VARIATION_REQUEST_DELAY']),
    extractBody(mainSrc, 'getVariationRequestDelay')
].join('\n\n');

// Der Zufallswert und die Einstellung werden fest vorgegeben, damit die
// Pruefung deterministisch ist.
const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math: {
        round: (value) => Math.round(value),
        random: () => sandbox.__random
    },
    Number
};
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: 'request_delay.js' });

/**
 * Berechnet die Verzoegerung mit einem festen Zufallswert.
 * @param {number|string|undefined} setting Der Wert der Einstellung
 * @param {number} random Der Wert von Math.random()
 * @returns {number} Die Verzoegerung in Millisekunden
 */
function delayWith(setting, random) {
    sandbox.__random = random;
    sandbox.SETTINGS = setting === undefined ? {} : { VariationRequestDelay: setting };
    return vm.runInContext('getVariationRequestDelay()', ctx);
}

/**
 * Die erwarteten Verzoegerungen der Varianten-Requests.
 */
const CASES = [
    {
        label: 'Ohne Einstellung: der Default von 550 ms',
        setting: undefined,
        random: 0.5,
        expected: 550
    },
    {
        label: 'Ohne Einstellung: der untere Rand des Defaults',
        setting: undefined,
        random: 0,
        expected: 275
    },
    {
        label: 'Ohne Einstellung: der obere Rand des Defaults',
        setting: undefined,
        random: 1,
        expected: 825
    },
    {
        label: 'Einstellung 100 ms: der untere Rand (die Einstellung gilt, nicht der Default)',
        setting: 100,
        random: 0,
        expected: 50
    },
    {
        label: 'Einstellung 100 ms: der obere Rand (die Einstellung gilt, nicht der Default)',
        setting: 100,
        random: 1,
        expected: 150
    },
    {
        label: 'Einstellung 0 ms: es wird nicht gewartet',
        setting: 0,
        random: 0.5,
        expected: 0
    },
    {
        label: 'Einstellung 500 ms: der untere Rand',
        setting: 500,
        random: 0,
        expected: 250
    },
    {
        label: 'Einstellung 500 ms: der obere Rand',
        setting: 500,
        random: 1,
        expected: 750
    },
    {
        label: 'Ungueltige Einstellung: der Default wird verwendet',
        setting: 'abc',
        random: 0.5,
        expected: 550
    },
    {
        label: 'Negative Einstellung: der Default wird verwendet',
        setting: -5,
        random: 0.5,
        expected: 550
    }
];

console.log('Verzoegerung zwischen den Requests pruefen');
console.log('='.repeat(70));

let _errors = 0;

// Der Abstand zwischen den Produkten der Queue bleibt unveraendert.
const _queueDelay = vm.runInContext('PRODUCT_DETAILS_REQUEST_DELAY', ctx);
if (_queueDelay === 1500) {
    console.log('  OK   Der Abstand zwischen den Produkten der Queue ist weiterhin 1500 ms');
} else {
    _errors++;
    console.log('  FAIL Der Abstand zwischen den Produkten der Queue ist weiterhin 1500 ms');
    console.log(`         erwartet: 1500  bekommen: ${_queueDelay}`);
}

for (const _case of CASES) {
    const _actual = delayWith(_case.setting, _case.random);

    if (_actual === _case.expected) {
        console.log(`  OK   ${_case.label}`);
    } else {
        _errors++;
        console.log(`  FAIL ${_case.label}`);
        console.log(`         erwartet: ${_case.expected}  bekommen: ${_actual}`);
    }
}

console.log('');
console.log('='.repeat(70));
const _total = CASES.length + 1;
if (_errors === 0) {
    console.log(`>>> RESULT: all ${_total} test cases passed`);
    process.exit(0);
}
console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
process.exit(1);
