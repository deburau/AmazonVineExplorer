#!/usr/bin/env node
/**
 * verify_fast_scan_interval.js
 *
 * Prueft den Takt des Fast-Scans.
 *
 * Der Takt war aus der Wartezeit pro Seite des Background-Scans berechnet
 * (15 Seitentakte). Wer den Background-Scan schneller stellte, hat damit
 * unbeabsichtigt auch den Fast-Scan viel oefter laufen lassen. Der Takt ist
 * jetzt die Einstellung "FastScanIntervalSeconds".
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil der Takt eine
 * Einstellung ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_fast_scan_interval.js
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

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Funktion wird aus der
// echten Datei geschnitten, damit der Test die echte Implementierung prueft.
const CODE = [
    extractConstants(mainSrc, ['FAST_SCAN_INTERVAL_SECONDS', 'MIN_FAST_SCAN_INTERVAL_SECONDS']),
    extractBody(mainSrc, 'getFastScanIntervalSeconds')
].join('\n\n');

const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Number,
    Math
};
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: 'fast_scan_interval.js' });

/**
 * Berechnet den Takt mit einer festen Einstellung.
 * @param {number|string|undefined} setting Der Wert der Einstellung
 * @returns {number} Der Takt in Sekunden
 */
function intervalWith(setting) {
    sandbox.SETTINGS = setting === undefined ? {} : { FastScanIntervalSeconds: setting };
    return vm.runInContext('getFastScanIntervalSeconds()', ctx);
}

/**
 * Die erwarteten Takte.
 */
const CASES = [
    {
        label: 'Ohne Einstellung: der Default von 300 Sekunden (5 Minuten)',
        setting: undefined,
        expected: 300
    },
    {
        label: 'Die Einstellung 600 Sekunden gilt',
        setting: 600,
        expected: 600
    },
    {
        label: 'Die Einstellung 30 Sekunden ist erlaubt (Minimum)',
        setting: 30,
        expected: 30
    },
    {
        label: 'Ein Wert unter dem Minimum wird auf 30 Sekunden angehoben',
        setting: 5,
        expected: 30
    },
    {
        label: 'Der Wert 0 wird auf 30 Sekunden angehoben',
        setting: 0,
        expected: 30
    },
    {
        label: 'Ein negativer Wert wird auf 30 Sekunden angehoben',
        setting: -60,
        expected: 30
    },
    {
        label: 'Eine ungueltige Einstellung: der Default wird verwendet',
        setting: 'abc',
        expected: 300
    }
];

console.log('Takt des Fast-Scans pruefen');
console.log('='.repeat(70));

let _errors = 0;

// Der Takt darf nicht mehr von der Wartezeit pro Seite abhaengen.
const _usesScanDelay = /BackGroundScanDelayPerPage|BackGroundScannerRandomness/.test(extractBody(mainSrc, 'getFastScanIntervalSeconds'));
if (_usesScanDelay) {
    _errors++;
    console.log('  FAIL Der Takt haengt noch an der Wartezeit pro Seite des Background-Scans');
} else {
    console.log('  OK   Der Takt haengt nicht an der Wartezeit pro Seite des Background-Scans');
}

for (const _case of CASES) {
    const _actual = intervalWith(_case.setting);

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
