#!/usr/bin/env node
/**
 * verify_gotify_priority.js
 *
 * Prueft die Prioritaet der Gotify-Nachrichten.
 *
 * Ohne Angabe in einem Keyword wird jede Nachricht mit der Prioritaet der
 * Einstellung verschickt (GotifyPriority, Standard 5). Ein Keyword kann mit
 * "gotifyPriority=<n>" eine andere Prioritaet fuer seine Treffer angeben, diese
 * schlaegt die Einstellung.
 *
 * Geprueft werden:
 *   - die Anfrage an den Server: Adresse, Methode, Typ und Inhalt
 *   - die Prioritaet der Nachricht (getGotifyPriority()): das Keyword schlaegt die
 *     Einstellung, ein Wert ausserhalb der Skala (0 bis 10) ergibt den Standard
 *   - die Zusatzangaben: die Nachricht wird als Markdown gezeigt, ein Produkt
 *     haengt Ziel und Bild an
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Prioritaet ein
 * Feature ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_gotify_priority.js
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

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Funktionen werden aus
// der echten Datei geschnitten, damit der Test die echte Implementierung prueft.
const CODE = [
    extractConstants(mainSrc, ['GOTIFY_PRIORITY_MIN', 'GOTIFY_PRIORITY_MAX', 'GOTIFY_PRIORITY_DEFAULT']),
    extractBody(mainSrc, 'getGotifyPriority'),
    extractBody(mainSrc, 'gotifyNotification')
].join('\n\n');

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
 * Fuehrt die Implementierung mit den angegebenen Werten aus und liefert die
 * abgeschickte Anfrage.
 *
 * @param {string} message Der Text der Nachricht
 * @param {object|null} [prod] Das Produkt der Nachricht
 * @param {number|null} [priority] Die Prioritaet, die das Keyword genannt hat
 * @param {number|string|null} [setting] Der Wert der Einstellung GotifyPriority
 * @returns {{count: number, url: string, method: string, headers: object, body: object}} Die Anfrage
 */
function run(message, prod = null, priority = null, setting = 5) {
    const _requests = [];

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
        SETTINGS: { GotifyUrl: 'https://gotify.example.com/', GotifyToken: 'tok', GotifyPriority: setting, DebugLevel: 0 },
        GM: {
            xmlHttpRequest: (options) => _requests.push(options)
        },
        AVE_VERSION: '1.0',
        window: { location: { origin: 'https://www.amazon.de' } },
        fixProductImageUrl: (url) => url,
        JSON,
        Number,
        String,
        parseInt
    };
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, ctx, { filename: 'gotify.js' });

    const gotifyNotification = vm.runInContext('gotifyNotification', ctx);
    gotifyNotification(message, prod, priority);

    const _request = _requests[0] || {};
    return {
        count: _requests.length,
        url: _request.url,
        method: _request.method,
        headers: _request.headers || {},
        body: _request.data ? JSON.parse(_request.data) : {}
    };
}

console.log('Prioritaet der Gotify-Nachrichten pruefen');
console.log('='.repeat(70));

// 1. Die Anfrage an den Server (ohne Produkt).
const _plain = run('Eine Nachricht', null, null, 4);
check(1, _plain.count, 'Es wird genau eine Anfrage geschickt');
check('https://gotify.example.com/message?token=tok', _plain.url, 'Die Adresse enthaelt den Token');
check('POST', _plain.method, 'Die Anfrage wird mit POST geschickt');
check('application/json', _plain.headers['Content-Type'], 'Der Typ der Anfrage ist JSON');
check('Amazon Vine Explorer - 1.0', _plain.body.title, 'Der Titel nennt den Namen und die Version');
check('Eine Nachricht', _plain.body.message, 'Der Text steht in der Nachricht');
check('text/markdown', _plain.body.extras['client::display'].contentType, 'Die Nachricht wird als Markdown gezeigt');
check(undefined, _plain.body.extras['client::notification'], 'Ohne Produkt gibt es kein Ziel und kein Bild');
check(4, _plain.body.priority, 'Ohne Prioritaet im Keyword gilt die Einstellung');

// 2. Ein Produkt haengt das Ziel und das Bild an.
const _prod = run('Eine Nachricht', { link: '/dp/B01', data_img_url: 'https://example.com/B01.jpg' }, null, 5);
check('https://www.amazon.de/dp/B01', _prod.body.extras['client::notification'].click.url, 'Das Ziel ist der Link des Produkts');
check('https://example.com/B01.jpg', _prod.body.extras['client::notification'].bigImageUrl, 'Das Bild ist das Produktbild');
check(5, _prod.body.priority, 'Mit einem Produkt gilt die Einstellung');

// 3. Die Prioritaet des Keywords schlaegt die Einstellung.
check(8, run('Eine Nachricht', null, 8, 5).body.priority, 'Die Prioritaet 8 aus dem Keyword schlaegt die Einstellung');
check(0, run('Eine Nachricht', null, 0, 5).body.priority, 'Die Prioritaet 0 aus dem Keyword gilt');
check(10, run('Eine Nachricht', null, 10, 5).body.priority, 'Die Prioritaet 10 aus dem Keyword gilt');
check(8, run('Eine Nachricht', { link: '/dp/B01', data_img_url: 'i' }, 8, 5).body.priority, 'Ein Produkt aendert die Prioritaet nicht');

// 4. Die Einstellung selbst.
check(0, run('Eine Nachricht', null, null, 0).body.priority, 'Die Einstellung 0 gilt');
check(10, run('Eine Nachricht', null, null, 10).body.priority, 'Die Einstellung 10 gilt');
check(7, run('Eine Nachricht', null, null, '7').body.priority, 'Eine Einstellung als Text gilt');
check(5, run('Eine Nachricht', null, null, 11).body.priority, 'Eine Einstellung ueber der Skala ergibt den Standard');
check(5, run('Eine Nachricht', null, null, -1).body.priority, 'Eine Einstellung unter der Skala ergibt den Standard');
check(5, run('Eine Nachricht', null, null, 'hoch').body.priority, 'Ein Text als Einstellung ergibt den Standard');
check(5, run('Eine Nachricht', null, null, null).body.priority, 'Eine leere Einstellung ergibt den Standard');

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
