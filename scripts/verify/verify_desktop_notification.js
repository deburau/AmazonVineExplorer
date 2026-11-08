#!/usr/bin/env node
/**
 * verify_desktop_notification.js
 *
 * Prueft die Desktop-Benachrichtigungen und die Testnachricht der Einstellungen.
 *
 * Die Desktop-Benachrichtigungen sind der Weg, auf dem AVE bei einem neuen Produkt
 * eine Nachricht des Browsers zeigt. Der Text besteht aus den Zeilen der Treffer
 * (Keyword, Preis, Kategorie) und der Beschreibung des Produkts, das Bild ist das
 * Bild des Produkts und ein Klick oeffnet das Fenster mit den Details.
 *
 * Geprueft werden:
 *   - das Ziel eines Klicks (getProductTargetUrl()): die Produktseite von Vine mit
 *     den Daten des Produkts im Parameter "vine-data"
 *   - das neueste Produkt der Datenbank (getNewestProductOfDatabase()): das Produkt
 *     mit dem hoechsten ts_lastSeen, null bei leerer Datenbank und bei einem Fehler
 *   - die Testnachricht (sendDesktopTestMessage()): der Titel, die Zeile des Tests
 *     an der Stelle der Treffer, die Beschreibung des Produkts, das Bild, das
 *     requireInteraction und das Ziel des Klicks
 *   - die Berechtigung: die Anfrage beim Klick, der Abbruch bei "denied" und der
 *     Fall, dass der Browser keine Benachrichtigungen kennt
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Testnachricht ein
 * Feature ist und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_desktop_notification.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { extractBody } = require('./lib/verify_helpers');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AVE_VERSION = '1.0';

const mainSrc = fs.readFileSync(path.join(REPO_ROOT, 'VineExplorer.user.js'), 'utf8');

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Funktionen werden aus
// der echten Datei geschnitten, damit der Test die echte Implementierung prueft.
const CODE = [
    extractBody(mainSrc, 'getProductTargetUrl'),
    extractBody(mainSrc, 'getNewestProductOfDatabase'),
    extractBody(mainSrc, 'fixProductImageUrl'),
    extractBody(mainSrc, 'desktopNotifikation'),
    extractBody(mainSrc, 'sendDesktopTestMessage')
].join('\n\n');

const ORIGIN = 'https://www.amazon.de';
const IMAGE_BASE = 'https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/';
// Der Text, den der Aufrufer von translate() als Ersatz mitgibt (siehe
// sendDesktopTestMessage()). Die Uebersetzung selbst steht in i18n.js und wird von
// scripts/check_settings_keys.js geprueft.
const TEST_LINE = `Test message of Amazon Vine Explorer ${AVE_VERSION} - this is not a real match`;

const PROD_TOASTER = {
    data_asin: 'B01TOASTER',
    data_asin_is_parent: false,
    data_recommendation_id: 'rec-toaster',
    data_estimated_tax: 3,
    data_img_url: 'https://m.media-amazon.com/images/I/aaa/images/I/bbb.jpg',
    description_full: 'Toaster mit zwei Schlitzen',
    ts_lastSeen: 1700000000
};

const PROD_KAFFEE = {
    data_asin: 'B02KAFFEE',
    data_asin_is_parent: true,
    data_recommendation_id: 'rec-kaffee',
    data_estimated_tax: 7.5,
    data_img_url: 'https://m.media-amazon.com/images/I/ccc/images/I/ddd.jpg',
    description_full: 'Kaffeemaschine mit Mahlwerk',
    ts_lastSeen: 1800000000
};

// Die Adresse, die getProductTargetUrl() fuer das Produkt PROD_KAFFEE bildet. Die
// Reihenfolge der Felder ist die Reihenfolge im Quelltext, weil JSON.stringify()
// sie so schreibt.
const TARGET_KAFFEE = `${ORIGIN}/vine/vine-items?vine-data=${encodeURIComponent(
    JSON.stringify({
        asin: PROD_KAFFEE.data_asin,
        isParentAsin: PROD_KAFFEE.data_asin_is_parent,
        recommendationId: PROD_KAFFEE.data_recommendation_id,
        tax: PROD_KAFFEE.data_estimated_tax
    })
)}`;

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
 * Prueft, ob ein Text ein Stueck enthaelt.
 * @param {string} text Der Text
 * @param {string} part Das gesuchte Stueck
 * @param {string} label Die Bezeichnung der Pruefung
 */
function checkIncludes(text, part, label) {
    check(true, String(text).includes(part), label);
}

/**
 * Baut die Sandbox mit dem nachgebauten Notification-Objekt.
 *
 * Das Objekt zaehlt die Anfragen der Berechtigung und sammelt die erzeugten
 * Nachrichten, damit der Test Text, Bild und Ziel pruefen kann.
 *
 * @param {object} opts Die Optionen des Szenarios
 * @returns {object} Die Sandbox und die Protokolle des Szenarios
 */
function createSandbox(opts = {}) {
    const log = [];
    const notifications = [];
    const opened = [];
    const warnings = [];
    const errors = [];

    class MockNotification {
        static permission = opts.permission || 'granted';

        static requestPermission() {
            log.push('Notification.requestPermission');
            const _next = opts.permissionAfterRequest !== undefined ? opts.permissionAfterRequest : MockNotification.permission;
            MockNotification.permission = _next;
            return Promise.resolve(_next);
        }

        constructor(title, options) {
            this.title = title;
            this.options = options;
            this.onclick = null;
            notifications.push(this);
            log.push(`new Notification ${title}`);
        }
    }

    const database = {
        getAll() {
            log.push('db.getAll');
            if (opts.dbError) return Promise.reject('the database is broken');
            return Promise.resolve((opts.products || []).map((_prod) => Object.assign({}, _prod)));
        }
    };

    const sandbox = {
        console: {
            log: () => {},
            warn: (msg) => warnings.push(String(msg)),
            error: (msg) => errors.push(String(msg)),
            info: () => {}
        },
        window: {
            location: { origin: ORIGIN, href: `${ORIGIN}/vine/vine-items` },
            open: (url, target) => {
                opened.push({ url, target });
                log.push(`window.open ${url}`);
            }
        },
        database,
        translate: (cat, key, fallback, ...args) => (typeof fallback === 'function' ? fallback(...args) : fallback),
        AVE_VERSION,
        Notification: opts.withoutNotification ? undefined : MockNotification
    };

    const _ctx = vm.createContext(sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'desktop_notification.js' });

    return { sandbox, notifications, opened, warnings, errors, log };
}

/**
 * Klickt auf eine Benachrichtigung und meldet, ob preventDefault() gerufen wurde.
 * @param {object} notification Die Benachrichtigung
 * @returns {boolean} true, wenn preventDefault() gerufen wurde
 */
function clickNotification(notification) {
    let _prevented = false;
    notification.onclick({ preventDefault: () => (_prevented = true) });
    return _prevented;
}

/**
 * Prueft die Adresse, die ein Klick auf eine Benachrichtigung oeffnet.
 */
function checkTarget() {
    const _target = createSandbox();
    check(TARGET_KAFFEE, _target.sandbox.getProductTargetUrl(PROD_KAFFEE), 'Das Ziel nennt das Produkt im Parameter vine-data');
    checkIncludes(
        _target.sandbox.getProductTargetUrl(PROD_KAFFEE),
        `${ORIGIN}/vine/vine-items?vine-data=`,
        'Das Ziel ist die Seite der Produkte von Vine'
    );
    checkIncludes(
        _target.sandbox.getProductTargetUrl(PROD_KAFFEE),
        encodeURIComponent('"tax":7.5'),
        'Das Ziel nennt den Preis des Produkts'
    );
    checkIncludes(
        _target.sandbox.getProductTargetUrl(PROD_TOASTER),
        encodeURIComponent('"isParentAsin":false'),
        'Das Ziel nennt auch ein Produkt ohne Varianten'
    );
}

/**
 * Prueft das neueste Produkt der Datenbank: das Produkt mit dem hoechsten
 * ts_lastSeen, die Reihenfolge, eine leere Datenbank und ein Fehler.
 */
async function checkNewestProduct() {
    const _newest = createSandbox({ products: [PROD_TOASTER, PROD_KAFFEE] });
    const _two = await _newest.sandbox.getNewestProductOfDatabase();
    check(PROD_KAFFEE.data_asin, _two?.data_asin, 'Das Produkt mit dem hoechsten ts_lastSeen gewinnt');
    check(1, _newest.log.filter((_l) => _l === 'db.getAll').length, 'Die Produkte werden einmal gelesen');

    const _worstOrder = createSandbox({ products: [PROD_KAFFEE, PROD_TOASTER] });
    const _twoReversed = await _worstOrder.sandbox.getNewestProductOfDatabase();
    check(PROD_KAFFEE.data_asin, _twoReversed?.data_asin, 'Die Reihenfolge in der Datenbank spielt keine Rolle');

    const _empty = createSandbox();
    check(null, await _empty.sandbox.getNewestProductOfDatabase(), 'Eine leere Datenbank ergibt null');

    const _broken = createSandbox({ dbError: true });
    check(null, await _broken.sandbox.getNewestProductOfDatabase(), 'Ein Fehler der Datenbank ergibt null');
    checkIncludes(_broken.errors.join(' '), 'could not read the products', 'Der Fehler der Datenbank wird gemeldet');

    const _withoutTs = createSandbox({ products: [PROD_TOASTER, { data_asin: 'B03OHNETS', description_full: 'ohne Zeitstempel' }] });
    const _first = await _withoutTs.sandbox.getNewestProductOfDatabase();
    check(PROD_TOASTER.data_asin, _first?.data_asin, 'Ohne ts_lastSeen gewinnt das Produkt mit einem Zeitstempel');
}

/**
 * Prueft die Testnachricht mit dem neuesten Produkt: Text, Bild, Klick und die
 * Berechtigung, die schon erteilt ist.
 */
async function checkTestMessageWithProduct() {
    const _granted = createSandbox({ products: [PROD_TOASTER, PROD_KAFFEE] });
    const _sentGranted = await _granted.sandbox.sendDesktopTestMessage();
    check(true, _sentGranted, 'Mit der Berechtigung wird die Testnachricht geschickt');
    check(1, _granted.notifications.length, 'Es wird genau eine Nachricht erzeugt');
    check(0, _granted.log.filter((_l) => _l === 'Notification.requestPermission').length, 'Mit der Berechtigung wird nicht gefragt');

    const _notification = _granted.notifications[0];
    check(`Amazon Vine Explorer - ${AVE_VERSION}`, _notification.title, 'Der Titel ist der Titel der echten Nachricht');
    check(
        `${TEST_LINE}\n${PROD_KAFFEE.description_full}`,
        _notification.options.body,
        'Der Test steht vor der Beschreibung des neuesten Produkts'
    );
    check(
        'https://m.media-amazon.com/images/I/ddd.jpg',
        _notification.options.image,
        'Das Bild ist das Bild des Produkts (korrigierte Adresse)'
    );
    check(`${IMAGE_BASE}vine_logo_important.png`, _notification.options.icon, 'Das Symbol ist das wichtige Logo');
    check(true, _notification.options.requireInteraction, 'Die Nachricht bleibt bis zum Klick stehen');
    check(true, String(_notification.options.tag).startsWith('ave-notify-'), 'Die Nachricht bekommt einen eigenen Tag');

    const _prevented = clickNotification(_notification);
    check(true, _prevented, 'Der Klick verhindert das Standardverhalten');
    check(1, _granted.opened.length, 'Der Klick oeffnet ein Fenster');
    check(TARGET_KAFFEE, _granted.opened[0].url, 'Der Klick oeffnet das Fenster mit den Details');
    check('_blank', _granted.opened[0].target, 'Das Fenster wird in einem neuen Tab geoeffnet');
}

/**
 * Prueft die Berechtigung: die Frage beim Klick, die Ablehnung und die schon
 * vorhandene Ablehnung.
 */
async function checkPermission() {
    const _asked = createSandbox({ permission: 'default', permissionAfterRequest: 'granted', products: [PROD_KAFFEE] });
    const _sentAsked = await _asked.sandbox.sendDesktopTestMessage();
    check(1, _asked.log.filter((_l) => _l === 'Notification.requestPermission').length, 'Ohne Berechtigung wird gefragt');
    check(true, _sentAsked, 'Nach der Erlaubnis wird die Testnachricht geschickt');
    check(1, _asked.notifications.length, 'Nach der Erlaubnis wird die Nachricht erzeugt');
    check(
        `${TEST_LINE}\n${PROD_KAFFEE.description_full}`,
        _asked.notifications[0].options.body,
        'Die Nachricht nach der Erlaubnis hat den vollen Text'
    );

    const _deniedRequest = createSandbox({ permission: 'default', permissionAfterRequest: 'denied', products: [PROD_KAFFEE] });
    const _sentDeniedRequest = await _deniedRequest.sandbox.sendDesktopTestMessage();
    check(false, _sentDeniedRequest, 'Nach einer Ablehnung wird nichts geschickt');
    check(0, _deniedRequest.notifications.length, 'Nach einer Ablehnung gibt es keine Nachricht');
    checkIncludes(_deniedRequest.warnings.join(' '), 'the permission is "denied"', 'Die Ablehnung wird gemeldet');

    const _denied = createSandbox({ permission: 'denied', products: [PROD_KAFFEE] });
    const _sentDenied = await _denied.sandbox.sendDesktopTestMessage();
    check(false, _sentDenied, 'Mit einer Ablehnung wird nichts geschickt');
    check(1, _denied.log.filter((_l) => _l === 'Notification.requestPermission').length, 'Auch mit einer Ablehnung wird gefragt');
    check(0, _denied.notifications.length, 'Mit einer Ablehnung gibt es keine Nachricht');
}

/**
 * Prueft die Testnachricht ohne Produkt, mit einem Fehler der Datenbank, mit
 * einem Produkt ohne Bild und ohne Notification-Objekt.
 */
async function checkWithoutProduct() {
    const _noProduct = createSandbox({ products: [] });
    const _sentNoProduct = await _noProduct.sandbox.sendDesktopTestMessage();
    check(true, _sentNoProduct, 'Ohne Produkt wird die Testnachricht trotzdem geschickt');
    check(1, _noProduct.notifications.length, 'Ohne Produkt gibt es genau eine Nachricht');
    check(TEST_LINE, _noProduct.notifications[0].options.body, 'Ohne Produkt steht nur die Zeile des Tests in der Nachricht');
    check(
        `${IMAGE_BASE}vine_logo_notification_image.png`,
        _noProduct.notifications[0].options.image,
        'Ohne Produkt wird das Standardbild gezeigt'
    );
    clickNotification(_noProduct.notifications[0]);
    check(0, _noProduct.opened.length, 'Ohne Produkt hat der Klick kein Ziel');

    const _dbError = createSandbox({ dbError: true });
    const _sentDbError = await _dbError.sandbox.sendDesktopTestMessage();
    check(true, _sentDbError, 'Bei einem Fehler der Datenbank wird die Testnachricht trotzdem geschickt');
    check(
        TEST_LINE,
        _dbError.notifications[0].options.body,
        'Bei einem Fehler der Datenbank steht nur die Zeile des Tests in der Nachricht'
    );

    const _withoutImage = createSandbox({
        products: [{ data_asin: 'B04OHNE', description_full: 'ohne Bild', ts_lastSeen: 1800000000 }]
    });
    const _sentWithoutImage = await _withoutImage.sandbox.sendDesktopTestMessage();
    check(true, _sentWithoutImage, 'Ein Produkt ohne Bild aendert nichts am Versand');
    check(
        `${IMAGE_BASE}vine_logo_notification_image.png`,
        _withoutImage.notifications[0].options.image,
        'Ohne Bild des Produkts wird das Standardbild gezeigt'
    );
    clickNotification(_withoutImage.notifications[0]);
    check(1, _withoutImage.opened.length, 'Auch ohne Bild des Produkts hat der Klick ein Ziel');

    // -------------------------------------- der Browser kennt keine Nachrichten
    const _withoutNotification = createSandbox({ withoutNotification: true });
    const _sentWithoutNotification = await _withoutNotification.sandbox.sendDesktopTestMessage();
    check(false, _sentWithoutNotification, 'Ohne Notification-Objekt wird nichts geschickt');
    check(
        0,
        _withoutNotification.log.filter((_l) => _l === 'Notification.requestPermission').length,
        'Ohne Notification-Objekt wird nicht gefragt'
    );
    checkIncludes(_withoutNotification.warnings.join(' '), 'does not support notifications', 'Der fehlende Support wird gemeldet');
}

/** Fuehrt alle Pruefungen aus und fasst das Ergebnis zusammen. */
async function main() {
    console.log('Desktop-Benachrichtigungen und die Testnachricht');
    console.log('-'.repeat(70));

    checkTarget();
    await checkNewestProduct();
    await checkTestMessageWithProduct();
    await checkPermission();
    await checkWithoutProduct();

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
