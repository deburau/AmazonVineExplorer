/**
 * verify_scan.js
 *
 * Vergleicht die alte (versionierte) und die neue Implementierung des
 * Background-Scans. Beide werden in einem vm-Kontext mit gemockten
 * Browser-APIs ausgefuehrt und die Folge der localStorage-Zugriffe und der
 * Aufrufe wird Schritt fuer Schritt verglichen.
 *
 * Usage: node scripts/verify/verify_scan.js [iterationen]
 */

const vm = require('vm');
const { prepare, finish } = require('./lib/verify_helpers');

const ITERATIONS = parseInt(process.argv[2] || '12', 10);
const FIXED_NOW = 1800000000000;

const OLD_NAMES = ['initBackgroundScan'];
const NEW_NAMES = [
    'initBackgroundScan',
    'initBackgroundScanStorage',
    'getBackgroundScanStageZeroSites',
    'backgroundScanLoop',
    'prepareFastScan',
    'prepareScanIteration',
    'scanStageZero',
    'scanStageEncore',
    'scanStageSkip',
    'scanStageCleanup',
    'scanStageIdle',
    'backgroundScanFinished',
    'handleFastScanFinished',
    'shouldStopFastScan',
    'stopFastScan',
    'notifyAboutProductDrop',
    'formatDuration'
];

const { old: oldCode, new: newCode } = prepare('verify_scan.js', OLD_NAMES, NEW_NAMES);

/**
 * Baut eine Sandbox mit gemockten Browser-APIs und startet den Scan.
 * @param {string} code Der Quelltext der Scan-Implementierung
 * @param {boolean} fastScan true, wenn der Fast-Scan aktiv sein soll
 */
function runScenario(code, initial) {
    const log = [];
    const store = new Map();

    const localStorage = {
        getItem(key) {
            log.push(`get ${key}`);
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            log.push(`set ${key}=${value}`);

            store.set(key, String(value));
        },
        removeItem(key) {
            log.push(`del ${key}`);
            store.delete(key);
        }
    };

    const queue = [];
    const pendingScans = [];
    let timerId = 0;

    const SETTINGS = {
        DebugLevel: 0,
        EnableBackgroundScan: true,
        BackGroundScanDelayPerPage: 100,
        BackGroundScannerRandomness: 0, // deterministisch
        IdlePeriodAfterScan: 180,
        NewItemsNotificationThreshold: 5,
        NewItemsNotificationRepititionMinutes: 30,
        UnseenItemsNotificationThreshold: 0,
        EnableDesktopNotifikation: false,
        GotifyUrl: ''
    };

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        localStorage,
        SETTINGS,
        performance: { now: () => 1000 },
        // Feste Uhr, damit beide Laeufe exakt dieselben Werte sehen.
        Date: { now: () => FIXED_NOW },
        Math,
        JSON,
        parseInt,
        String,
        Number,
        AVE_VERSION: 'test',
        AVE_IS_THIS_SESSION_MASTER: true,
        BackGroundScanIsRunning: false,
        backGroundScanTimeout: null,
        lastScanPaginationData: null,
        getCountry: () => 'DE',
        showBackgroundScanScreen: (t) => log.push(`screen: ${t}`),
        updateBackgroundScanScreenText: (t) => log.push(`text: ${t}`),
        cleanUpDatabase: () => log.push('call cleanUpDatabase'),
        gotifyNotification: () => log.push('call gotifyNotification'),
        desktopNotifikation: () => log.push('call desktopNotifikation'),
        backGroundTileScanner: (url, cb) => {
            log.push(`call backGroundTileScanner ${url}`);
            // Der Callback feuert im echten Browser erst, wenn die Seite geladen
            // ist, also nach dem Ende der aktuellen Runde. Deshalb wird er hier
            // gesammelt und erst danach aufgerufen.
            pendingScans.push(cb);
        },
        setTimeout: (cb, ms) => {
            queue.push(cb);
            return ++timerId;
        },
        clearTimeout: () => {},
        setInterval: (cb, ms) => {
            // Der echte Interval feuert erst nach der Zuweisung der Variable,
            // deshalb wird der Callback hier in die Queue gelegt.
            queue.push(cb);
            return ++timerId;
        },
        clearInterval: () => {}
    };
    sandbox.window = sandbox;
    sandbox.location = { href: 'https://www.amazon.de/vine/vine-items' };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx, { filename: 'scan.js' });

    // Startzustand wie nach einem frischen Scan
    store.set('AVE_BACKGROUND_SCAN_IS_RUNNING', 'true');
    store.set('AVE_BACKGROUND_SCAN_PAGE_MAX', '10');
    store.set('AVE_BACKGROUND_SCAN_PAGE_CURRENT', '0');
    store.set('AVE_BACKGROUND_SCAN_STAGE', '0');
    store.set('AVE_BACKGROUND_SCAN_LAST_TIME', String(FIXED_NOW - 3600 * 1000));
    store.set('AVE_FAST_SCAN_IS_RUNNING', 'false');
    store.set('AVE_FAST_SCAN_LAST_TIME', '0');
    store.set('AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS', '-1:-1:-1:-1');
    store.set('AVE_LAST_BACKGROUND_SCAN_STAGE', '0');
    store.set('AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT', '0');
    store.set('AVE_NEW_COUNT', '0');

    for (const [key, value] of Object.entries(initial || {})) {
        store.set(key, String(value));
    }

    log.length = 0;

    vm.runInContext('initBackgroundScan()', ctx, { filename: 'start.js' });

    const steps = [log.splice(0).join(' | ')];
    for (let i = 0; i < ITERATIONS; i++) {
        if (!queue.length) break;
        const cb = queue.shift();
        cb();
        steps.push(log.splice(0).join(' | '));

        // Der Scan der gerade gestarteten Seite meldet sich jetzt zurück.
        if (pendingScans.length) {
            const scanCb = pendingScans.shift();
            scanCb(3);
            steps.push(log.splice(0).join(' | '));
        }
    }
    return steps;
}

/** Normalisiert die Namen der umbenannten Funktionen und die Zeitstempel. */
function norm(s) {
    return (
        s
            .replace(/initBackgroundScanSubFunctionScannerLoop/g, 'backgroundScanLoop')
            .replace(/_scanFinished/g, 'backgroundScanFinished')
            .replace(/_timeConversion/g, 'formatDuration')
            .replace(/initBackgroundScanStorage/g, 'INIT')
            .replace(/getBackgroundScanStageZeroSites/g, 'INIT')
            .replace(/prepareFastScan/g, 'PREP')
            .replace(/prepareScanIteration/g, 'PREP')
            .replace(/scanStageZero|scanStageEncore|scanStageSkip|scanStageCleanup|scanStageIdle/g, 'STAGE')
            // Zeitstempel (Date.now()) sind zwischen den Laeufen um Millisekunden verschieden
            .replace(/\d{13}/g, '<TIMESTAMP>')
    );
}

let failures = 0;

const SCENARIOS = [
    {
        label: 'Normaler Scan (Fast-Scan inaktiv)',
        initial: {}
    },
    {
        label: 'Fast-Scan wird gestartet',
        initial: {
            AVE_BACKGROUND_SCAN_STAGE: 1,
            AVE_BACKGROUND_SCAN_PAGE_CURRENT: 5,
            AVE_BACKGROUND_SCAN_PAGE_MAX: 10,
            AVE_FAST_SCAN_LAST_TIME: 1,
            AVE_LAST_BACKGROUND_SCAN_STAGE: 1,
            AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT: 5
        }
    },
    {
        label: 'Scan wurde vor 11 Stunden beendet (Neustart)',
        initial: {
            AVE_BACKGROUND_SCAN_LAST_TIME: FIXED_NOW - 11 * 3600 * 1000
        }
    },
    {
        label: 'Produkt wurde aus dem Enrollment entfernt (Fast Scan stoppt)',
        initial: {
            AVE_BACKGROUND_SCAN_STAGE: 1,
            AVE_BACKGROUND_SCAN_PAGE_CURRENT: 5,
            AVE_BACKGROUND_SCAN_PAGE_MAX: 10,
            AVE_FAST_SCAN_IS_RUNNING: 'true',
            AVE_FAST_SCAN_LAST_TIME: 1,
            AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS: '0:0:0:0',
            AVE_LAST_BACKGROUND_SCAN_STAGE: 1,
            AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT: 5
        }
    },
    {
        label: 'Fast-Scan laeuft, Stage 2 erreicht (Stopp wegen Stage)',
        initial: {
            AVE_BACKGROUND_SCAN_STAGE: 2,
            AVE_BACKGROUND_SCAN_PAGE_CURRENT: 0,
            AVE_BACKGROUND_SCAN_PAGE_MAX: 10,
            AVE_FAST_SCAN_IS_RUNNING: 'true',
            AVE_FAST_SCAN_LAST_TIME: 1,
            AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS: '1:2:3:4',
            AVE_LAST_BACKGROUND_SCAN_STAGE: 1,
            AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT: 0
        }
    },
    {
        label: 'Fast-Scan laeuft, kein Fortschritt (Stopp wegen Seitenzahl)',
        initial: {
            AVE_BACKGROUND_SCAN_STAGE: 1,
            AVE_BACKGROUND_SCAN_PAGE_CURRENT: 5,
            AVE_BACKGROUND_SCAN_PAGE_MAX: 10,
            AVE_FAST_SCAN_IS_RUNNING: 'true',
            AVE_FAST_SCAN_LAST_TIME: 1,
            AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS: '1:2:3:4',
            AVE_LAST_BACKGROUND_SCAN_STAGE: 1,
            AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT: 5
        }
    },
    {
        label: 'Fast-Scan laeuft, neue Produkte gefunden (kein Stopp)',
        initial: {
            AVE_BACKGROUND_SCAN_STAGE: 1,
            AVE_BACKGROUND_SCAN_PAGE_CURRENT: 6,
            AVE_BACKGROUND_SCAN_PAGE_MAX: 10,
            AVE_FAST_SCAN_IS_RUNNING: 'true',
            AVE_FAST_SCAN_LAST_TIME: 1,
            AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS: '1:2:3:4',
            AVE_LAST_BACKGROUND_SCAN_STAGE: 1,
            AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT: 5,
            AVE_NEW_COUNT: 3
        }
    }
];

for (const scenario of SCENARIOS) {
    const label = scenario.label;
    const oldSteps = runScenario(oldCode, scenario.initial);
    const newSteps = runScenario(newCode, scenario.initial);

    console.log('\n=== ' + label + ' ===');
    console.log('Schritte alt: ' + oldSteps.length + ', neu: ' + newSteps.length);

    const max = Math.max(oldSteps.length, newSteps.length);
    for (let i = 0; i < max; i++) {
        const o = oldSteps[i] || '(keine)';
        const n = newSteps[i] || '(keine)';
        if (norm(o) === norm(n)) {
            console.log('  Schritt ' + i + ': identisch');
        } else {
            failures++;
            console.log('  Schritt ' + i + ': ABWEICHUNG');
            console.log('    alt: ' + o);
            console.log('    neu: ' + n);
        }
    }
}

console.log('\nAbgedeckte Scan-Aufrufe (Szenario 1, neue Version):');
const _cover = runScenario(newCode, SCENARIOS[0].initial).join('\n');
const _urls = [...new Set(_cover.match(/backGroundTileScanner \S+/g) || [])];
_urls.forEach((_u) => console.log('  ' + _u));
console.log('  -> gesetzte Stages: ' + [...new Set(_cover.match(/set AVE_BACKGROUND_SCAN_STAGE=\d/g) || [])].join(', '));
console.log('  -> cleanUpDatabase aufgerufen: ' + _cover.includes('cleanUpDatabase'));

finish(failures === 0, failures);
