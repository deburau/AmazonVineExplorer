#!/usr/bin/env node
/**
 * verify_left_side_buttons.js
 *
 * Prueft die Buttons auf der linken Seite der Seite.
 *
 * Die Buttons ("Seite als gesehen markieren", "Alle als gesehen markieren" und
 * "Zum Seitenanfang") stehen in der Seitenleiste von Amazon. Ist die Einstellung
 * "Kategorien deaktivieren" an, wird die Seitenleiste zu einer schmalen Spalte und
 * die Kategorien darin verschwinden - die Buttons bleiben und werden um 90 Grad
 * gedreht (siehe Issue #32).
 *
 * Geprueft werden:
 *   - der Stil eines Buttons (getLeftSideButtonStyle()): breit in der normalen
 *     Seitenleiste, schmal und gedreht in der schmalen Spalte
 *   - das CSS der schmalen Spalte (getVerticalButtonsCss()): die Kategorien werden
 *     ausgeblendet, der Container der Buttons bleibt, die Spalte ist schmal und die
 *     Buttons stehen senkrecht
 *   - dass die Buttons der schmalen Spalte ohne das Markup von Amazon gebaut werden
 *     (createVerticalButton() erzeugt ein div mit eigener Klasse, nicht die Klasse
 *     "a-button", deren Regeln die Buttons breit machten)
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die schmale Spalte ein
 * Feature ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_left_side_buttons.js
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

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Funktionen werden aus
// der echten Datei geschnitten, damit der Test die echte Implementierung prueft.
const CODE = [
    extractBody(mainSrc, 'getLeftSideButtonStyle'),
    extractBody(mainSrc, 'getVerticalButtonsCss'),
    extractBody(mainSrc, 'createVerticalButton')
].join('\n\n');

// Die Quelltexte der beiden Funktionen, die die Buttons bauen, um zu pruefen, dass
// das CSS zu den Elementen passt, die sie wirklich erzeugen.
const BUTTON_SOURCE = extractBody(mainSrc, 'createButton');
const SIDE_BUTTONS_SOURCE = extractBody(mainSrc, 'addLeftSideButtons');
// Der Scroll-Handler der Seite (er steht nicht in einer Funktion).
const SCROLL_SOURCE = mainSrc.slice(mainSrc.indexOf('window.onscroll'), mainSrc.indexOf('window.onscroll') + 1200);

const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    String,
    Object
};
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: 'left_side_buttons.js' });

const getLeftSideButtonStyle = vm.runInContext('getLeftSideButtonStyle', ctx);
const getVerticalButtonsCss = vm.runInContext('getVerticalButtonsCss', ctx);

let _errors = 0;
let _checks = 0;

/**
 * Vergleicht zwei Werte und gibt eine Fehlermeldung aus, wenn sie sich unterscheiden.
 * @param {*} expected Der erwartete Wert
 * @param {*} actual Der erhaltene Wert
 * @param {string} label Die Bezeichnung der Pruefung
 */
function check(expected, actual, label) {
    _checks++;
    if (JSON.stringify(expected) === JSON.stringify(actual)) return;
    _errors++;
    console.log(`  FAIL ${label}`);
    console.log(`         erwartet: ${JSON.stringify(expected)}  bekommen: ${JSON.stringify(actual)}`);
}

/**
 * Prueft, ob ein Text einen anderen Text enthaelt.
 * @param {string} text Der Text
 * @param {string} part Der gesuchte Teil
 * @param {string} label Die Bezeichnung der Pruefung
 */
function contains(text, part, label) {
    check(true, String(text).includes(part), label);
}

/**
 * Prueft, ob ein Text einen anderen Text nicht enthaelt.
 * @param {string} text Der Text
 * @param {string} part Der Teil, der nicht vorkommen darf
 * @param {string} label Die Bezeichnung der Pruefung
 */
function notContains(text, part, label) {
    check(false, String(text).includes(part), label);
}

console.log('Buttons der linken Seite pruefen');
console.log('='.repeat(70));

// 1. Der Stil eines Buttons in der normalen Seitenleiste.
const _normal = getLeftSideButtonStyle('rgb(255, 0, 0)', false);
contains(_normal, 'width: 240px', 'Der normale Button ist breit');
contains(_normal, 'background-color: rgb(255, 0, 0)', 'Der normale Button traegt seine Farbe');
notContains(_normal, 'writing-mode', 'Der normale Button ist nicht gedreht');
notContains(_normal, 'rotate', 'Der normale Button ist nicht gedreht (Drehung)');

// 2. Der Stil eines Buttons in der schmalen Spalte.
const _vertical = getLeftSideButtonStyle('rgb(0, 255, 0)', true);
contains(_vertical, 'width: auto', 'Der gedrehte Button ist so breit wie sein Text');
contains(_vertical, 'padding: 8px 4px', 'Der gedrehte Button hat einen Abstand neben dem Text');
notContains(_vertical, 'width: 240px', 'Der gedrehte Button ist nicht mehr breit');
contains(_vertical, 'background-color: rgb(0, 255, 0)', 'Der gedrehte Button traegt seine Farbe');
contains(_vertical, 'padding', 'Der gedrehte Button hat einen Abstand zum Rand');
// 3. Das CSS der schmalen Spalte.
const _css = getVerticalButtonsCss();
contains(_css, '#vvp-browse-nodes-container', 'Das CSS nennt die Seitenleiste von Amazon');
contains(_css, 'width: 24px', 'Die Spalte ist schmal');
contains(_css, 'max-width: 24px', 'Die Spalte wird nicht breiter');
contains(_css, 'padding: 0 !important', 'Die Seitenleiste hat kein eigenes Padding');
contains(_css, 'margin-left: 0 !important', 'Die Seitenleiste hat keinen Abstand nach links');
contains(_css, 'box-sizing: border-box', 'Die Breite schliesst den Rand ein');
contains(_css, '> *:not(#ave-left-buttons)', 'Alles ausser den Buttons wird ausgeblendet');
contains(_css, 'display: none', 'Die Kategorien werden ausgeblendet');
contains(_css, '#ave-left-buttons', 'Das CSS nennt den Container der Buttons');
contains(_css, 'width: 100% !important', 'Der Container ist so breit wie die Spalte (parent-node von Amazon ist 240px breit)');
contains(_css, 'max-width: 100% !important', 'Der Container wird nicht breiter als die Spalte');
contains(_css, 'display: flex', 'Die Buttons stehen untereinander');
contains(_css, 'flex-direction: column', 'Die Buttons stehen in einer Spalte');
// 5. Der Wrapper der Seitenleiste (Amazon) wird ebenfalls schmal.
const _filterRule = _css.slice(_css.indexOf('#vvp-filter-container'));
contains(_filterRule, 'width: 24px', 'Der Wrapper der Seitenleiste ist schmal');
contains(_filterRule, 'max-width: 24px', 'Der Wrapper wird nicht breiter');
contains(_filterRule, 'padding: 0 !important', 'Der Wrapper hat kein eigenes Padding');
contains(_css, 'writing-mode: vertical-rl', 'Die Buttons werden um 90 Grad gedreht');
contains(_css, 'transform: rotate(180deg)', 'Die Schrift steht aufrecht');
contains(_css, 'white-space: nowrap', 'Der Text der Buttons bricht nicht um');
contains(_css, 'line-height: 1.1', 'Die Zeilenhoehe bestimmt die Breite des Buttons');
contains(_css, 'font-size: 12px', 'Die Schrift ist kleiner');
notContains(_css, '//', 'Das CSS hat keine ungueltigen Kommentare');

// 4. Das CSS muss zu den Elementen passen, die die Buttons wirklich erzeugt.
//    NOTE: Die schmalen Buttons sind divs mit eigener Klasse. Das Markup von Amazon
//    ("a-button") wird dort bewusst nicht benutzt, weil seine Regeln die Buttons
//    breiter als die Spalte machten.
contains(BUTTON_SOURCE, 'a-button a-button-normal a-button-toggle', 'createButton() setzt die Klasse a-button');
contains(_css, '.ave-vertical-button', 'Das CSS nennt die Klasse der schmalen Buttons');
notContains(_css, '.a-button', 'Das CSS kaempft nicht mehr mit den Regeln von Amazon');
notContains(_css, '#ave-left-buttons button', 'Das CSS sucht keinen <button>');
contains(SIDE_BUTTONS_SOURCE, 'createVerticalButton', 'Die schmalen Buttons werden ohne das Markup von Amazon gebaut');
contains(SIDE_BUTTONS_SOURCE, 'getLeftSideButtonStyle(bgColor, false)', 'Die normalen Buttons behalten ihr Markup');
contains(SCROLL_SOURCE, "stickElementToTopScrollEVhandler('ave-btn-allseen'", 'Der Scroll-Handler haengt den Button oben fest');
notContains(SCROLL_SOURCE, 'if (!SETTINGS.DisableCategories)', 'Der Button bleibt auch in der schmalen Spalte sichtbar');

if (_errors === 0) {
    console.log(`  alle ${_checks} Faelle sind ok`);
} else {
    console.log(`  ${_errors} von ${_checks} Faellen sind fehlgeschlagen`);
}

console.log('');
console.log('='.repeat(70));
if (_errors === 0) {
    console.log(`>>> RESULT: all ${_checks} test cases passed`);
    process.exit(0);
}
console.log(`>>> RESULT: ${_errors} of ${_checks} test cases failed`);
process.exit(1);
