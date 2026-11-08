#!/usr/bin/env node
/**
 * verify_gotify_priority.js
 *
 * Prueft die Prioritaet der Gotify-Nachrichten.
 *
 * Ohne Angabe in einem Keyword wird jede Nachricht mit der Prioritaet der
 * Einstellung verschickt (GotifyPriority, Standard 5). Ein Keyword kann mit
 * "gotifyPriority=<n>" eine andere Prioritaet fuer seine Treffer angeben, diese
 * schlaegt die Einstellung. Der Button unter der Einstellung schickt eine
 * Testnachricht mit der Prioritaet der Einstellung.
 *
 * Geprueft werden:
 *   - die Anfrage an den Server: Adresse, Methode, Typ und Inhalt
 *   - die Prioritaet der Nachricht (getGotifyPriority()): das Keyword schlaegt die
 *     Einstellung, ein Wert ausserhalb der Skala (0 bis 10) ergibt den Standard
 *   - die Zusatzangaben: die Nachricht wird als Markdown gezeigt, ein Produkt
 *     haengt Ziel und Bild an
 *   - die Testnachricht (sendGotifyTestMessage()): sie wird mit der Prioritaet der
 *     Einstellung geschickt, mit dem neuesten Produkt der Datenbank (Bild, Ziel und
 *     Beschreibung) und ohne Adresse oder Token gar nicht
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
const AVE_VERSION = '1.0';
const GOTIFY_URL = 'https://gotify.example.com/';
const GOTIFY_TOKEN = 'tok';
const ORIGIN = 'https://www.amazon.de';

/**
 * Die Adresse, die ein Klick oeffnet (dieselbe wie bei den Desktop-Nachrichten).
 * @param {object} prod Das Produkt
 * @returns {string} Die Adresse mit den Daten des Produkts
 */
function targetUrl(prod) {
    return `${ORIGIN}/vine/vine-items?vine-data=${encodeURIComponent(
        JSON.stringify({
            asin: prod.data_asin,
            isParentAsin: prod.data_asin_is_parent,
            recommendationId: prod.data_recommendation_id,
            tax: prod.data_estimated_tax
        })
    )}`;
}

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
    extractBody(mainSrc, 'getProductTargetUrl'),
    extractBody(mainSrc, 'gotifyNotification'),
    extractBody(mainSrc, 'getNewestProductOfDatabase'),
    extractBody(mainSrc, 'sendGotifyTestMessage')
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
 * Baut die Sandbox mit den angegebenen Werten.
 *
 * @param {object} options Die Werte der Einstellungen
 * @returns {{ctx: object, requests: object[]}} Der Kontext und die Anfragen
 */
function createSandbox(options) {
    const _requests = [];

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
        SETTINGS: {
            GotifyUrl: options.url,
            GotifyToken: options.token,
            GotifyPriority: options.setting,
            DebugLevel: 0
        },
        GM: {
            xmlHttpRequest: (request) => _requests.push(request)
        },
        AVE_VERSION,
        window: { location: { origin: ORIGIN } },
        // Die Datenbank liefert die Produkte, die das Szenario vorgibt.
        database: {
            getAll: () => Promise.resolve((options.products || []).map((_prod) => Object.assign({}, _prod)))
        },
        fixProductImageUrl: (url) => url,
        // Der Test benutzt den uebergebenen Text, wenn keine Uebersetzung da ist.
        translate: (category, key, fallback) => fallback,
        JSON,
        Number,
        String,
        parseInt
    };
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, ctx, { filename: 'gotify.js' });
    return { ctx, requests: _requests };
}

/**
 * Liest die abgeschickte Anfrage aus.
 *
 * @param {object[]} requests Die Anfragen der Sandbox
 * @returns {{count: number, url: string, method: string, headers: object, body: object}} Die Anfrage
 */
function readRequest(requests) {
    const _request = requests[0] || {};
    return {
        count: requests.length,
        url: _request.url,
        method: _request.method,
        headers: _request.headers || {},
        body: _request.data ? JSON.parse(_request.data) : {}
    };
}

/**
 * Fuehrt gotifyNotification() mit den angegebenen Werten aus.
 *
 * @param {string} message Der Text der Nachricht
 * @param {object|null} [prod] Das Produkt der Nachricht
 * @param {number|null} [priority] Die Prioritaet, die das Keyword genannt hat
 * @param {number|string|null} [setting] Der Wert der Einstellung GotifyPriority
 * @returns {object} Die abgeschickte Anfrage
 */
function run(message, prod = null, priority = null, setting = 5) {
    const { ctx, requests } = createSandbox({ setting, url: GOTIFY_URL, token: GOTIFY_TOKEN });
    vm.runInContext('gotifyNotification', ctx)(message, prod, priority);
    return readRequest(requests);
}

/**
 * Fuehrt sendGotifyTestMessage() mit den angegebenen Werten aus.
 *
 * @param {number|string|null} [setting] Der Wert der Einstellung GotifyPriority
 * @param {string} [url] Die Adresse des Servers
 * @param {string} [token] Der Token der Anwendung
 * @param {object[]} [products] Die Produkte der Datenbank
 * @returns {Promise<object>} Die Anfrage und das Ergebnis
 */
async function runTest(setting = 5, url = GOTIFY_URL, token = GOTIFY_TOKEN, products = []) {
    const { ctx, requests } = createSandbox({ setting, url, token, products });
    const _sent = await vm.runInContext('sendGotifyTestMessage', ctx)();
    return Object.assign({ sent: _sent }, readRequest(requests));
}

/**
 * Prueft die Testnachricht des Buttons: die Prioritaet, den Text, das neueste
 * Produkt der Datenbank, das Bild, das Ziel und die Faelle ohne Produkt, ohne
 * Adresse und ohne Token.
 */
async function checkTestMessage() {
    // 5. Die Testnachricht des Buttons.
    const _testLine = `Test message of Amazon Vine Explorer ${AVE_VERSION} - this is not a real match`;
    const _test = await runTest(7);
    check(true, _test.sent, 'Mit Adresse und Token wird die Testnachricht geschickt');
    check(1, _test.count, 'Die Testnachricht ist genau eine Anfrage');
    check(_testLine, _test.body.message, 'Der Text der Testnachricht nennt das Script, die Version und dass es ein Test ist');
    check(7, _test.body.priority, 'Die Testnachricht benutzt die Prioritaet der Einstellung');
    check(10, (await runTest(10)).body.priority, 'Die Testnachricht benutzt auch die Prioritaet 10');
    check(0, (await runTest(0)).body.priority, 'Die Testnachricht benutzt auch die Prioritaet 0');
    check(5, (await runTest(99)).body.priority, 'Eine Einstellung ausserhalb der Skala ergibt den Standard');
    check(
        undefined,
        _test.body.extras['client::notification'],
        'Ohne Produkt in der Datenbank hat die Testnachricht kein Ziel und kein Bild'
    );
    check('text/markdown', _test.body.extras['client::display'].contentType, 'Die Testnachricht wird als Markdown gezeigt');

    // 6. Die Testnachricht mit dem neuesten Produkt der Datenbank.
    const _older = {
        data_asin: 'B01ALT',
        data_asin_is_parent: false,
        data_recommendation_id: 'rec-alt',
        data_estimated_tax: 3,
        link: '/dp/B01ALT',
        data_img_url: 'https://example.com/alt.jpg',
        description_full: 'Altes Produkt',
        ts_lastSeen: 1700000000
    };
    const _newer = {
        data_asin: 'B02NEU',
        data_asin_is_parent: true,
        data_recommendation_id: 'rec-neu',
        data_estimated_tax: 7.5,
        link: '/dp/B02NEU',
        data_img_url: 'https://example.com/neu.jpg',
        description_full: 'Neues Produkt',
        ts_lastSeen: 1800000000
    };
    const _withProduct = await runTest(5, GOTIFY_URL, GOTIFY_TOKEN, [_older, _newer]);
    check(true, _withProduct.sent, 'Mit einem Produkt wird die Testnachricht geschickt');
    check(
        `[![](${_newer.data_img_url})](${targetUrl(_newer)})  \n${_testLine}  \n${_newer.description_full}`,
        _withProduct.body.message,
        'Der Text nennt das Bild als Link auf die Adresse mit den Daten, den Test und die Beschreibung'
    );
    check(
        targetUrl(_newer),
        _withProduct.body.extras['client::notification'].click.url,
        'Das Ziel der Testnachricht ist die Adresse der Desktop-Nachricht (vine-data)'
    );
    check(
        _newer.data_img_url,
        _withProduct.body.extras['client::notification'].bigImageUrl,
        'Das Bild der Testnachricht ist das Bild des neuesten Produkts'
    );
    check(5, _withProduct.body.priority, 'Ein Produkt aendert die Prioritaet der Testnachricht nicht');
    check(`Amazon Vine Explorer - ${AVE_VERSION}`, _withProduct.body.title, 'Der Titel der Testnachricht bleibt der Titel des Scripts');

    const _withoutImage = await runTest(5, GOTIFY_URL, GOTIFY_TOKEN, [
        { data_asin: 'B03OHNE', description_full: 'Ohne Bild', ts_lastSeen: 1800000000 }
    ]);
    check(
        `${_testLine}  \nOhne Bild`,
        _withoutImage.body.message,
        'Ohne Bild des Produkts steht die Beschreibung ohne Bild in der Nachricht'
    );
    check(undefined, _withoutImage.body.extras['client::notification'], 'Ohne Bild des Produkts hat die Testnachricht kein Ziel');

    const _withoutUrl = await runTest(5, '', GOTIFY_TOKEN);
    check(false, _withoutUrl.sent, 'Ohne Adresse wird nichts geschickt');
    check(0, _withoutUrl.count, 'Ohne Adresse gibt es keine Anfrage');

    const _withoutToken = await runTest(5, GOTIFY_URL, '');
    check(false, _withoutToken.sent, 'Ohne Token wird nichts geschickt');
    check(0, _withoutToken.count, 'Ohne Token gibt es keine Anfrage');
}

async function main() {
    console.log('Prioritaet der Gotify-Nachrichten pruefen');
    console.log('='.repeat(70));

    // 1. Die Anfrage an den Server (ohne Produkt).
    const _plain = run('Eine Nachricht', null, null, 4);
    check(1, _plain.count, 'Es wird genau eine Anfrage geschickt');
    check(`${GOTIFY_URL}message?token=${GOTIFY_TOKEN}`, _plain.url, 'Die Adresse enthaelt den Token');
    check('POST', _plain.method, 'Die Anfrage wird mit POST geschickt');
    check('application/json', _plain.headers['Content-Type'], 'Der Typ der Anfrage ist JSON');
    check(`Amazon Vine Explorer - ${AVE_VERSION}`, _plain.body.title, 'Der Titel nennt den Namen und die Version');
    check('Eine Nachricht', _plain.body.message, 'Der Text steht in der Nachricht');
    check('text/markdown', _plain.body.extras['client::display'].contentType, 'Die Nachricht wird als Markdown gezeigt');
    check(undefined, _plain.body.extras['client::notification'], 'Ohne Produkt gibt es kein Ziel und kein Bild');
    check(4, _plain.body.priority, 'Ohne Prioritaet im Keyword gilt die Einstellung');

    // 2. Ein Produkt haengt das Ziel und das Bild an.
    const _withTarget = {
        data_asin: 'B01TOASTER',
        data_asin_is_parent: false,
        data_recommendation_id: 'rec-toaster',
        data_estimated_tax: 3,
        link: '/dp/B01',
        data_img_url: 'https://example.com/B01.jpg'
    };
    const _prod = run('Eine Nachricht', _withTarget, null, 5);
    check(
        targetUrl(_withTarget),
        _prod.body.extras['client::notification'].click.url,
        'Das Ziel ist die Adresse der Desktop-Nachricht (vine-data)'
    );
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

    // 5. und 6. Die Testnachricht des Buttons (eigene Funktion, damit main()
    // nicht zu viele Anweisungen hat).
    await checkTestMessage();

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
}

main();
