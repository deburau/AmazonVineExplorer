#!/usr/bin/env node
/**
 * verify_turbo_scan.js
 *
 * Prueft den Turbo-Scan.
 *
 * Der Turbo-Scan laedt in jedem Schritt die erste Seite einer Kategorie aus der
 * Liste der Einstellungen. Eine Runde ist fertig, wenn jede Kategorie einmal
 * geladen wurde; erst dann beginnt die Wartezeit der naechsten Runde.
 *
 * Geprueft werden:
 *   - der Takt (getTurboScanIntervalSeconds())
 *   - die Liste der Kategorien und das Zerlegen ihrer Nummern
 *   - die Faelligkeit (isTurboScanDue()): aus, keine Kategorien, Wartezeit,
 *     laufende Runde
 *   - die Schritte (scanStepTurbo()): die URL, die Reihenfolge der Kategorien und
 *     das Ende einer Runde
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil der Turbo-Scan ein
 * Feature ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_turbo_scan.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { extractBody, extractConstants } = require('./lib/verify_helpers');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const NOW = 1800000000000;

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
    extractConstants(mainSrc, ['TURBO_SCAN_INTERVAL_SECONDS', 'MIN_TURBO_SCAN_INTERVAL_SECONDS']),
    extractBody(mainSrc, 'getTurboScanIntervalSeconds'),
    extractBody(mainSrc, 'getTurboScanCategories'),
    extractBody(mainSrc, 'parseTurboScanCategory'),
    extractBody(mainSrc, 'getTurboScanIndex'),
    extractBody(mainSrc, 'isTurboScanDue'),
    extractBody(mainSrc, 'scanStepTurbo')
].join('\n\n');

/**
 * Baut eine Sandbox mit gemocktem local storage und Netz.
 *
 * @param {object} opts Die Optionen des Tests
 * @returns {object} Die Sandbox
 */
function createSandbox(opts = {}) {
    const _store = new Map(Object.entries(opts.stored || {}));
    const _log = [];

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        localStorage: {
            getItem: (key) => (_store.has(key) ? _store.get(key) : null),
            setItem: (key, value) => {
                _store.set(key, String(value));
                _log.push(`set ${key}=${value}`);
            }
        },
        Date: { now: () => NOW },
        SETTINGS: {
            DebugLevel: 0,
            EnableTurboScan: opts.enabled || false,
            TurboScanCategories: opts.categories || [],
            TurboScanIntervalSeconds: opts.interval
        },
        aveGetVineBaseUrl: () => 'https://www.amazon.de/vine/vine-items',
        updateBackgroundScanScreenText: (text) => _log.push(`text: ${text}`),
        backGroundTileScanner: (url, cb) => {
            _log.push(`scan ${url}`);
            cb(0);
        },
        Promise,
        Number,
        Math,
        parseInt,
        JSON,
        String,
        Array,
        Error
    };
    sandbox.globalThis = sandbox;
    sandbox._store = _store;
    sandbox._log = _log;

    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'turbo_scan.js' });
    sandbox._ctx = _ctx;
    return sandbox;
}

let _errors = 0;

/**
 * Prueft einen Wert und gibt das Ergebnis aus.
 * @param {*} expected Der erwartete Wert
 * @param {*} actual Der erhaltene Wert
 * @param {string} label Die Bezeichnung der Pruefung
 */
function check(expected, actual, label) {
    if (JSON.stringify(expected) === JSON.stringify(actual)) {
        console.log(`  OK   ${label}`);
        return;
    }
    _errors++;
    console.log(`  FAIL ${label}`);
    console.log(`         erwartet: ${JSON.stringify(expected)}  bekommen: ${JSON.stringify(actual)}`);
}

console.log('Turbo-Scan pruefen');
console.log('='.repeat(70));

// --- Der Takt ---
const _intervalCases = [
    { interval: undefined, expected: 30, label: 'Ohne Einstellung: 30 Sekunden' },
    { interval: 60, expected: 60, label: 'Die Einstellung 60 Sekunden gilt' },
    { interval: 10, expected: 10, label: 'Die Einstellung 10 Sekunden ist erlaubt (Minimum)' },
    { interval: 5, expected: 10, label: 'Ein Wert unter dem Minimum wird auf 10 Sekunden angehoben' },
    { interval: 'abc', expected: 30, label: 'Eine ungueltige Einstellung: der Default gilt' }
];
for (const _case of _intervalCases) {
    const _sandbox = createSandbox({ interval: _case.interval });
    check(_case.expected, vm.runInContext('getTurboScanIntervalSeconds()', _sandbox._ctx), _case.label);
}

// --- Die Liste der Kategorien und das Zerlegen ---
const _listSandbox = createSandbox({ categories: ['10925031', '10925031/87837030', 'abc', 42, null] });
check(
    ['10925031', '10925031/87837030'],
    vm.runInContext('getTurboScanCategories()', _listSandbox._ctx),
    'Nur die Nummern der Kategorien werden benutzt'
);
check(
    { pn: '10925031', cn: '' },
    vm.runInContext('parseTurboScanCategory("10925031")', _listSandbox._ctx),
    'Eine Hauptkategorie hat nur eine Nummer'
);
check(
    { pn: '10925031', cn: '87837030' },
    vm.runInContext('parseTurboScanCategory("10925031/87837030")', _listSandbox._ctx),
    'Eine Unterkategorie hat beide Nummern'
);

// --- Die Faelligkeit ---
const _dueCases = [
    {
        label: 'Der Turbo-Scan ist aus',
        opts: { enabled: false, categories: ['10925031'], interval: 30, stored: {} },
        expected: false
    },
    {
        label: 'Ohne Kategorien passiert nichts',
        opts: { enabled: true, categories: [], interval: 30, stored: {} },
        expected: false
    },
    {
        label: 'Die Wartezeit ist noch nicht vorbei',
        opts: { enabled: true, categories: ['10925031'], interval: 30, stored: { AVE_TURBO_SCAN_LAST_TIME: NOW - 10 * 1000 } },
        expected: false
    },
    {
        label: 'Die Wartezeit ist vorbei',
        opts: { enabled: true, categories: ['10925031'], interval: 30, stored: { AVE_TURBO_SCAN_LAST_TIME: NOW - 31 * 1000 } },
        expected: true
    },
    {
        label: 'Noch nie gelaufen',
        opts: { enabled: true, categories: ['10925031'], interval: 30, stored: {} },
        expected: true
    },
    {
        label: 'Eine Runde laeuft: der naechste Schritt kommt sofort',
        opts: {
            enabled: true,
            categories: ['10925031', '3167641'],
            interval: 30,
            stored: { AVE_TURBO_SCAN_CATEGORY_INDEX: 1, AVE_TURBO_SCAN_LAST_TIME: NOW }
        },
        expected: true
    }
];
for (const _case of _dueCases) {
    const _sandbox = createSandbox(_case.opts);
    check(_case.expected, vm.runInContext('isTurboScanDue()', _sandbox._ctx), _case.label);
}

// --- Ein Index, der nicht mehr passt ---
const _wrongIndex = createSandbox({
    enabled: true,
    categories: ['10925031'],
    interval: 30,
    stored: { AVE_TURBO_SCAN_CATEGORY_INDEX: 99 }
});
check(0, vm.runInContext('getTurboScanIndex()', _wrongIndex._ctx), 'Ein Index ausserhalb der Liste wird auf 0 gesetzt');

// --- Die Schritte ---
(async () => {
    const _one = createSandbox({ enabled: true, categories: ['10925031'], interval: 30 });
    await vm.runInContext('scanStepTurbo()', _one._ctx);
    check(
        ['scan https://www.amazon.de/vine/vine-items?queue=all_items&pn=10925031&cn=&page=1'],
        _one._log.filter((l) => l.startsWith('scan ')),
        'Die erste Seite der Kategorie mit der Nummer der Hauptkategorie'
    );
    check(
        ['set AVE_TURBO_SCAN_CATEGORY_INDEX=0', `set AVE_TURBO_SCAN_LAST_TIME=${NOW}`],
        _one._log.filter((l) => l.startsWith('set ')),
        'Nach dem einzigen Schritt der Liste ist die Runde fertig'
    );

    const _two = createSandbox({ enabled: true, categories: ['10925031', '3167641'], interval: 30 });
    await vm.runInContext('scanStepTurbo()', _two._ctx);
    // NOTE: Der local storage speichert nur Zeichenketten.
    check('1', _two._store.get('AVE_TURBO_SCAN_CATEGORY_INDEX'), 'Nach dem ersten Schritt zeigt der Index auf die zweite Kategorie');
    check(false, _two._store.has('AVE_TURBO_SCAN_LAST_TIME'), 'Die Wartezeit der naechsten Runde beginnt noch nicht');

    await vm.runInContext('scanStepTurbo()', _two._ctx);
    check(
        [
            'scan https://www.amazon.de/vine/vine-items?queue=all_items&pn=10925031&cn=&page=1',
            'scan https://www.amazon.de/vine/vine-items?queue=all_items&pn=3167641&cn=&page=1'
        ],
        _two._log.filter((l) => l.startsWith('scan ')),
        'Jede Kategorie wird einmal geladen'
    );
    check('0', _two._store.get('AVE_TURBO_SCAN_CATEGORY_INDEX'), 'Nach der letzten Kategorie beginnt die Runde von vorne');
    check(String(NOW), _two._store.get('AVE_TURBO_SCAN_LAST_TIME'), 'Mit dem Ende der Runde beginnt die Wartezeit');

    const _sub = createSandbox({ enabled: true, categories: ['10925031/87837030'], interval: 30 });
    await vm.runInContext('scanStepTurbo()', _sub._ctx);
    check(
        ['scan https://www.amazon.de/vine/vine-items?queue=all_items&pn=10925031&cn=87837030&page=1'],
        _sub._log.filter((l) => l.startsWith('scan ')),
        'Eine Unterkategorie wird mit beiden Nummern geladen'
    );
    check(
        ['text: Turbo Scanner: 1 / 1'],
        _sub._log.filter((l) => l.startsWith('text: ')),
        'Der Text der Anzeige nennt die Kategorie und die Anzahl'
    );

    console.log('');
    console.log('='.repeat(70));
    const _total = _intervalCases.length + 3 + _dueCases.length + 1 + 6;
    if (_errors === 0) {
        console.log(`>>> RESULT: all ${_total} test cases passed`);
        process.exit(0);
    }
    console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
    process.exit(1);
})();
