#!/usr/bin/env node
/**
 * verify_keyword_order.js
 *
 * Prueft die Reihenfolge in der Liste der Keywords der Einstellungen.
 *
 * Ein neues Keyword steht **oben** in der Liste, damit der Benutzer es direkt
 * unter dem Eingabefeld sieht und bei vielen Keywords nicht bis ans Ende scrollen
 * muss. Beim Aufbau der Einstellungen wird die Liste weiterhin alphabetisch
 * sortiert (createSettingsKeywordsElement()), die Reihenfolge auf dem Bildschirm
 * ist nach dem Neuladen also wieder die sortierte.
 *
 * Geprueft werden:
 *   - die Liste wird beim Aufbau alphabetisch sortiert (wie bisher)
 *   - ein neues Keyword steht an erster Stelle der Liste und wird gespeichert
 *   - mehrere neue Keywords auf einmal behalten ihre Reihenfolge oben
 *   - ein Keyword, das es schon gibt, wird nicht doppelt aufgenommen
 *   - Leerzeichen und leere Zeilen werden ignoriert
 *   - die Reihenfolge der angezeigten Zeilen passt zum Feld index der Loeschen-Knoepfe
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Reihenfolge ein
 * Feature ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_keyword_order.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { extractBody } = require('./lib/verify_helpers');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const KEY = 'DesktopNotifikationKeywords';

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
    extractBody(mainSrc, 'createSettingsKeywordsElement'),
    extractBody(mainSrc, 'createSettingsKeywordsList'),
    extractBody(mainSrc, 'createSettingsKeywordsTableElement'),
    extractBody(mainSrc, 'updateSettingsKeywordsList')
].join('\n\n');

/**
 * Ein sehr kleines DOM, damit die Funktionen in Node laufen.
 * @returns {object} document, Merker und ein Baum fuer die Suche
 */
function createFakeDom() {
    const _byId = {};

    const _mk = (tag) => {
        const element = {
            tagName: String(tag).toUpperCase(),
            children: [],
            handlers: {},
            attrs: {},
            innerText: '',
            value: '',
            _classes: []
        };
        let _innerHTML = '';
        Object.defineProperty(element, 'innerHTML', {
            get: () => _innerHTML,
            set: (value) => {
                _innerHTML = String(value);
                // Wie im Browser: der neue Inhalt ersetzt die Kinder.
                element.children = [];
            }
        });
        element.classList = {
            add: (name) => {
                if (!element._classes.includes(name)) element._classes.push(name);
            },
            remove: (name) => {
                element._classes = element._classes.filter((c) => c !== name);
            },
            contains: (name) => element._classes.includes(name)
        };
        element.setAttribute = (name, value) => {
            element.attrs[name] = String(value);
            if (name === 'id') _byId[String(value)] = element;
        };
        element.getAttribute = (name) => (name in element.attrs ? element.attrs[name] : null);
        element.appendChild = (child) => {
            element.children.push(child);
            return child;
        };
        element.addEventListener = (type, cb) => {
            element.handlers[type] = cb;
        };
        return element;
    };

    return { document: { createElement: _mk, getElementById: (id) => _byId[id] || null }, _mk };
}

/**
 * Sucht das erste Element mit einem Tag-Namen im Baum.
 * @param {object} element Der Wurzelknoten
 * @param {string} tag Der Tag-Name (gross geschrieben)
 * @returns {object|null} Das Element
 */
function findElement(element, tag) {
    if (element.tagName === tag) return element;
    for (const _child of element.children) {
        const _found = findElement(_child, tag);
        if (_found) return _found;
    }
    return null;
}

/**
 * Sammelt alle Elemente mit einem Tag-Namen im Baum.
 * @param {object} element Der Wurzelknoten
 * @param {string} tag Der Tag-Name (gross geschrieben)
 * @param {object[]} out Die Sammelliste
 * @returns {object[]} Die Elemente
 */
function findElements(element, tag, out = []) {
    if (element.tagName === tag) out.push(element);
    for (const _child of element.children) findElements(_child, tag, out);
    return out;
}

/**
 * Baut die Einstellung in einer Sandbox auf und liefert die Zugriffe.
 * @param {string[]} keywords Die Keywords vor dem Aufbau
 * @returns {object} Die Sandbox mit den Merkern
 */
function build(keywords) {
    const _dom = createFakeDom();
    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
        document: _dom.document,
        SETTINGS: {
            DebugLevel: 0,
            [KEY]: keywords.slice(),
            saves: 0,
            save() {
                this.saves++;
            }
        },
        Array,
        Object,
        JSON,
        String
    };
    sandbox.globalThis = sandbox;

    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'keyword_order.js' });

    const _element = _dom._mk('div');
    sandbox.__element = _element;
    vm.runInContext(
        `createSettingsKeywordsElement(${JSON.stringify({
            key: KEY,
            inputPlaceholder: 'x'
        })}, globalThis.__element, 'Name', 'Beschreibung', 'Platzhalter')`,
        _ctx,
        { filename: 'keyword_order.js' }
    );
    return {
        ctx: _ctx,
        element: _element,
        settings: sandbox.SETTINGS,
        keywords: () => sandbox.SETTINGS[KEY],
        rows: () => {
            const _tbody = _dom.document.getElementById(KEY);
            return findElements(_tbody, 'TR').map((row) => ({
                text: row.children[1].innerText,
                // Der Loeschen-Knopf arbeitet mit dem Feld index der Zeile.
                index: row.getAttribute('index'),
                button: row.children[0].children[0].getAttribute('ave-data-keyword')
            }));
        },
        // Der Handler des Eingabefeldes wird mit einem Ereignis aufgerufen.
        enter(value) {
            const _input = findElement(_element, 'TEXTAREA');
            _input.handlers.change({ target: { value } });
        },
        inputElement: () => findElement(_element, 'TEXTAREA')
    };
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

console.log('Reihenfolge der Keywords pruefen');
console.log('='.repeat(70));

// 1. Beim Aufbau wird alphabetisch sortiert (wie bisher).
const _sorted = build(['zebra', 'apfel', 'Mitte']);
check(['apfel', 'Mitte', 'zebra'], _sorted.keywords(), 'Die Liste wird beim Aufbau alphabetisch sortiert');

// 2. Ein neues Keyword steht oben und wird gespeichert.
const _one = build(['apfel', 'zebra']);
_one.enter('neu');
check(['neu', 'apfel', 'zebra'], _one.keywords(), 'Ein neues Keyword steht an erster Stelle');
check(1, _one.settings.saves, 'Die Einstellungen werden gespeichert');
check('', _one.inputElement().value, 'Das Eingabefeld wird geleert');
check(
    [
        { text: 'neu', index: '0', button: 'neu' },
        { text: 'apfel', index: '1', button: 'apfel' },
        { text: 'zebra', index: '2', button: 'zebra' }
    ],
    _one.rows(),
    'Die angezeigten Zeilen passen zur Reihenfolge und zum Feld index'
);

// 3. Mehrere neue Keywords behalten ihre Reihenfolge oben.
const _many = build(['apfel', 'zebra']);
_many.enter('x\ny');
check(['x', 'y', 'apfel', 'zebra'], _many.keywords(), 'Zwei neue Keywords stehen in der eingegebenen Reihenfolge oben');

// 4. Ein Keyword, das es schon gibt, wird nicht noch einmal aufgenommen.
const _existing = build(['apfel', 'zebra']);
_existing.enter('zebra');
check(['apfel', 'zebra'], _existing.keywords(), 'Ein vorhandenes Keyword wird nicht doppelt aufgenommen');

// 5. Ein Keyword, das zweimal in der Eingabe steht, wird einmal aufgenommen.
const _double = build(['apfel']);
_double.enter('doppelt\ndoppelt');
check(['doppelt', 'apfel'], _double.keywords(), 'Ein zweimal eingegebenes Keyword wird einmal aufgenommen');

// 6. Leerzeichen und leere Zeilen werden ignoriert.
const _spaces = build(['apfel']);
_spaces.enter('  \n  neu  \n   \n');
check(['neu', 'apfel'], _spaces.keywords(), 'Leerzeichen und leere Zeilen werden ignoriert');

// 7. Eine leere Eingabe aendert nichts.
const _empty = build(['apfel']);
_empty.enter('   ');
check(['apfel'], _empty.keywords(), 'Eine leere Eingabe aendert die Liste nicht');

console.log('');
console.log('='.repeat(70));
const _total = _checks;
if (_errors === 0) {
    console.log(`>>> RESULT: all ${_total} test cases passed`);
    process.exit(0);
}
console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
process.exit(1);
