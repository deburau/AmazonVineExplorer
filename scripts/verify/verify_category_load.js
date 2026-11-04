#!/usr/bin/env node
/**
 * verify_category_load.js
 *
 * Prueft das Laden der Kategorien im Hintergrund.
 *
 * Die Liste der Kategorien wird nach dem Start (und danach alle 30 Minuten)
 * geladen, wenn sie fehlt oder aelter als ein Tag ist. Die Seiten werden
 * nacheinander und mit einer Pause geladen, jedes Ergebnis wird sofort gespeichert.
 * Waehrend des Ladens warten die Schritte des Scans (siehe scanLoop()), damit nicht
 * zwei Seiten gleichzeitig geladen werden.
 *
 * Geprueft werden:
 *   - eine vollstaendige, frische Liste: es passiert nichts (kein Request)
 *   - eine fehlende Liste: Hauptkategorien, dann jede Unterkategorie, mit Pause
 *   - Unterkategorien, die frisch sind, werden uebersprungen
 *   - die Meldung unten links erscheint und verschwindet wieder
 *   - ein vorhandener Bildschirm des Scans wird benutzt und nicht entfernt
 *   - ein laufendes Laden in einem anderen Tab (Merker im local storage) blockt
 *   - ein alter Merker blockt nicht
 *   - ein Fehler bei einer Kategorie haelt das Laden nicht auf
 *   - der Merker des Scans (isCategoryListLoadRunning())
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil das Hintergrundladen ein
 * Feature ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_category_load.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { extractBody, extractConstants } = require('./lib/verify_helpers');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOUR = 60 * 60 * 1000;

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
    extractConstants(mainSrc, ['CATEGORY_CACHE_MAX_AGE_SECONDS', 'CATEGORY_REQUEST_DELAY', 'CATEGORY_LOAD_MAX_AGE_SECONDS']),
    extractBody(mainSrc, 'isCategoryCacheFresh'),
    extractBody(mainSrc, 'isCategoryCacheComplete'),
    extractBody(mainSrc, 'isCategoryListLoadRunning'),
    extractBody(mainSrc, 'showCategoryLoadScreen'),
    extractBody(mainSrc, 'loadCategoryListInBackground')
].join('\n\n');

/**
 * Baut eine Sandbox mit gemockter Umgebung.
 * @param {object} opts Die Vorgaben (parents, children, cache, Merker, Fehler)
 * @returns {object} Die Sandbox
 */
function createSandbox(opts = {}) {
    const _log = [];
    const _store = {};
    const _state = {
        parentsCalls: 0,
        childrenCalls: [],
        screenExists: opts.screenExists === true,
        screenTexts: [],
        screenCreated: 0,
        screenRemoved: 0
    };

    if (opts.runningFlag !== undefined) _store['AVE_CATEGORY_LOAD_IS_RUNNING'] = String(opts.runningFlag);

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
        SETTINGS: { DebugLevel: 0 },
        localStorage: {
            getItem: (key) => (key in _store ? _store[key] : null),
            setItem: (key, value) => {
                _store[key] = String(value);
            },
            removeItem: (key) => {
                delete _store[key];
            }
        },
        document: {
            getElementById: (id) => (id === 'ave-backgroundscan-text' && _state.screenExists ? { id } : null)
        },
        // Die Meldung wird wie im Script in der Ecke der Seite angezeigt.
        showBackgroundScanScreen: (text) => {
            _state.screenExists = true;
            _state.screenCreated++;
            _state.screenTexts.push(text);
        },
        updateBackgroundScanScreenText: (text) => _state.screenTexts.push(text),
        removeBackgroundScanScreen: () => {
            _state.screenExists = false;
            _state.screenRemoved++;
        },
        translate: (category, key, fallback) => fallback,
        // Die Pausen werden nur mitgeschrieben, damit der Test schnell bleibt.
        delay: async (ms) => _log.push(`delay ${ms}`),
        getRandomizedDelay: (base) => base,
        readCategoryCache: () => opts.cache || { parents: null, children: {} },
        getVineCategoryParents: async () => {
            _state.parentsCalls++;
            return opts.parents || [];
        },
        getVineCategoryChildren: async (pn) => {
            _state.childrenCalls.push(pn);
            _log.push(`children ${pn}`);
            if (opts.failing === pn) throw new Error('the page could not be loaded');
            return [];
        },
        Math,
        Number,
        Array,
        Object,
        JSON,
        String,
        Date
    };
    sandbox.globalThis = sandbox;

    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'category_load.js' });
    return {
        ctx: _ctx,
        state: _state,
        log: _log,
        store: _store,
        load: () => vm.runInContext('loadCategoryListInBackground()', _ctx),
        isRunning: () => vm.runInContext('isCategoryListLoadRunning()', _ctx)
    };
}

/**
 * Baut eine gespeicherte Liste.
 * @param {number} age Das Alter in Millisekunden
 * @param {object[]} list Die Kategorien
 * @returns {object} Der Eintrag des Caches
 */
function entry(age, list) {
    return { ts: Date.now() - age, list };
}

let _errors = 0;
// NOTE: Die Anzahl der Pruefungen wird gezaehlt, damit sie nicht gepflegt werden muss.
let _checks = 0;

/**
 * Prueft zwei Werte auf Gleichheit.
 * @param {any} expected Der erwartete Wert
 * @param {any} actual Der tatsaechliche Wert
 * @param {string} label Die Bezeichnung der Pruefung
 */
function check(expected, actual, label) {
    _checks++;
    if (JSON.stringify(expected) === JSON.stringify(actual)) {
        console.log(`  OK   ${label}`);
        return;
    }
    _errors++;
    console.log(`  FAIL ${label}`);
    console.log(`         erwartet: ${JSON.stringify(expected)}  bekommen: ${JSON.stringify(actual)}`);
}

(async () => {
    console.log('Laden der Kategorien im Hintergrund pruefen');
    console.log('='.repeat(70));

    const PARENTS = [
        { name: 'Garten', pn: '10925031' },
        { name: 'Lebensmittel & Getränke', pn: '340846031' }
    ];

    // 1. Eine vollstaendige und frische Liste: es passiert nichts.
    const _complete = createSandbox({
        parents: PARENTS,
        cache: { parents: entry(0, PARENTS), children: { 10925031: entry(0, []), 340846031: entry(0, []) } }
    });
    await _complete.load();
    check(0, _complete.state.parentsCalls, 'Eine frische Liste: keine Hauptkategorien geladen');
    check([], _complete.state.childrenCalls, 'Eine frische Liste: keine Unterkategorien geladen');
    check([], _complete.state.screenTexts, 'Eine frische Liste: keine Meldung');
    check('undefined', typeof _complete.store['AVE_CATEGORY_LOAD_IS_RUNNING'], 'Eine frische Liste: kein Merker gesetzt');

    // 2. Eine fehlende Liste: alles wird nacheinander mit Pause geladen.
    const _missing = createSandbox({ parents: PARENTS, cache: { parents: null, children: {} } });
    await _missing.load();
    check(1, _missing.state.parentsCalls, 'Eine fehlende Liste: die Hauptkategorien werden geladen');
    check(['10925031', '340846031'], _missing.state.childrenCalls, 'Jede Hauptkategorie wird geladen');
    check(['delay 1500', 'children 10925031', 'delay 1500', 'children 340846031'], _missing.log, 'Zwischen den Seiten wird gewartet');
    check(
        ['Kategorien werden geladen: 0 / 2', 'Kategorien werden geladen: 1 / 2', 'Kategorien werden geladen: 2 / 2'],
        _missing.state.screenTexts,
        'Die Meldung zeigt den Fortschritt'
    );
    check(1, _missing.state.screenCreated, 'Die Meldung wurde angelegt');
    check(1, _missing.state.screenRemoved, 'Die Meldung wurde wieder entfernt');
    check('undefined', typeof _missing.store['AVE_CATEGORY_LOAD_IS_RUNNING'], 'Der Merker wird wieder entfernt');
    // Der Merker im Speicher haelt die Schritte des Scans auf, er darf nicht
    // haengen bleiben.
    check(false, vm.runInContext('CategoryListIsLoading', _missing.ctx), 'Der Merker im Speicher ist wieder aus');

    // 3. Frische Unterkategorien werden uebersprungen.
    const _partial = createSandbox({
        parents: PARENTS,
        cache: { parents: entry(HOUR, PARENTS), children: { 10925031: entry(0, []), 340846031: entry(25 * HOUR, []) } }
    });
    await _partial.load();
    check(['340846031'], _partial.state.childrenCalls, 'Nur die veraltete Unterkategorie wird geladen');
    check(['delay 1500', 'children 340846031'], _partial.log, 'Nur vor der einen Seite wird gewartet');

    // 4. Ein vorhandener Bildschirm des Scans wird benutzt und nicht entfernt.
    const _scanScreen = createSandbox({ parents: PARENTS, cache: { parents: null, children: {} }, screenExists: true });
    await _scanScreen.load();
    check(0, _scanScreen.state.screenCreated, 'Der Bildschirm des Scans wird nicht neu angelegt');
    check(0, _scanScreen.state.screenRemoved, 'Der Bildschirm des Scans wird nicht entfernt');
    check('', _scanScreen.state.screenTexts[_scanScreen.state.screenTexts.length - 1], 'Der Bildschirm wird leer hinterlassen');

    // 5. Ein laufendes Laden in einem anderen Tab blockt.
    const _otherTab = createSandbox({ parents: PARENTS, cache: { parents: null, children: {} }, runningFlag: Date.now() });
    await _otherTab.load();
    check(0, _otherTab.state.parentsCalls, 'Ein anderer Tab laedt: nichts passiert');
    check([], _otherTab.state.childrenCalls, 'Ein anderer Tab laedt: keine Unterkategorien');

    // 6. Ein alter Merker blockt nicht.
    const _stale = createSandbox({
        parents: PARENTS,
        cache: { parents: null, children: {} },
        runningFlag: Date.now() - 10 * 60 * 1000
    });
    await _stale.load();
    check(1, _stale.state.parentsCalls, 'Ein alter Merker blockt nicht');

    // 7. Ein Fehler bei einer Kategorie haelt das Laden nicht auf.
    const _failing = createSandbox({ parents: PARENTS, cache: { parents: null, children: {} }, failing: '10925031' });
    await _failing.load();
    check(['10925031', '340846031'], _failing.state.childrenCalls, 'Nach einem Fehler wird weitergeladen');
    check('undefined', typeof _failing.store['AVE_CATEGORY_LOAD_IS_RUNNING'], 'Der Merker wird auch nach einem Fehler entfernt');
    check(1, _failing.state.screenRemoved, 'Die Meldung wird auch nach einem Fehler entfernt');

    // 8. Der Merker, den die Schritte des Scans pruefen.
    check(false, _missing.isRunning(), 'Ohne Merker laeuft kein Laden');
    const _running = createSandbox({ runningFlag: Date.now() });
    check(true, _running.isRunning(), 'Ein frischer Merker meldet ein laufendes Laden');
    const _old = createSandbox({ runningFlag: Date.now() - 10 * 60 * 1000 });
    check(false, _old.isRunning(), 'Ein alter Merker meldet kein laufendes Laden');

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
