#!/usr/bin/env node
/**
 * verify_site_detection.js
 *
 * Prueft die Erkennung der Vine-Seiten gegen eine Tabelle von URLs.
 *
 * Anders als die anderen Skripte in diesem Ordner vergleicht dieses Skript
 * nicht eine alte mit einer neuen Implementierung, sondern prueft das
 * aktuelle Verhalten gegen erwartete Werte. Der Grund ist, dass die Aenderung
 * ein Verhalten ist und kein Refactoring: Amazon kann die Sprache in die URL
 * schreiben ("https://www.amazon.de/-/de/vine/vine-items"), dann muss die
 * Erkennung das Sprachsegment uebergehen.
 *
 * Das Skript prueft die drei Stellen, die an der Erkennung beteiligt sind:
 *   - SITE_IS_VINE und SITE_IS_SHOPPING (globals.js)
 *   - aveGetVineBaseUrl() (VineExplorer.user.js)
 *
 * Usage: node scripts/verify/verify_site_detection.js
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

/**
 * Schneidet eine Deklaration (const, let, var) aus dem Quelltext.
 *
 * Anders als extractConstants() der Hilfsfunktionen kann diese Funktion auch
 * eine Deklaration ueber mehrere Zeilen schneiden. Sie zaehlt die Klammern,
 * damit ein ";" innerhalb eines Ausdrucks nicht das Ende markiert.
 *
 * @param {string} src Der Quelltext
 * @param {string} name Der Name der Konstante
 * @returns {string} Die Deklaration
 */
function extractDeclaration(src, name) {
    const _m = src.match(new RegExp(`(?:const|let|var)\\s+${name}\\s*=`));
    if (!_m) throw new Error(`Declaration not found: ${name}`);
    const _start = _m.index;

    let _depth = 0;
    for (let _i = _start; _i < src.length; _i++) {
        const _char = src[_i];
        if (_char === '(' || _char === '[' || _char === '{') _depth++;
        else if (_char === ')' || _char === ']' || _char === '}') _depth--;
        else if (_char === ';' && _depth === 0) return src.slice(_start, _i + 1);
    }
    throw new Error(`Unbalanced brackets: ${name}`);
}

const globalsSrc = readSource('globals.js');
const mainSrc = readSource('VineExplorer.user.js');

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Konstanten und die
// Funktionen werden aus den echten Dateien geschnitten, damit der Test die
// echte Implementierung prueft und keinen Nachbau.
const CODE = [
    extractBody(globalsSrc, 'aveStripLocalePrefix'),
    extractDeclaration(globalsSrc, 'AVE_AMAZON_DOMAIN_PATTERN'),
    extractDeclaration(globalsSrc, 'SITE_IS_VINE'),
    extractDeclaration(globalsSrc, 'SITE_IS_SHOPPING'),
    extractBody(mainSrc, 'aveGetVineBaseUrl')
].join('\n\n');

/**
 * Die erwarteten Ergebnisse der Erkennung.
 * null bei baseUrl bedeutet, dass keine Basis-URL gefunden wird.
 */
const CASES = [
    {
        label: 'Vine-Seite ohne Sprachsegment',
        url: 'https://www.amazon.de/vine/vine-items',
        vine: true,
        shopping: false,
        baseUrl: 'https://www.amazon.de/vine/vine-items'
    },
    {
        label: 'Vine-Seite mit deutschem Sprachsegment (Firefox)',
        url: 'https://www.amazon.de/-/de/vine/vine-items',
        vine: true,
        shopping: false,
        baseUrl: 'https://www.amazon.de/-/de/vine/vine-items'
    },
    {
        label: 'Vine-Seite mit englischem Sprachsegment (Firefox)',
        url: 'https://www.amazon.de/-/en/vine/vine-items',
        vine: true,
        shopping: false,
        baseUrl: 'https://www.amazon.de/-/en/vine/vine-items'
    },
    {
        label: 'Vine-Seite mit Sprachsegment und Query-String',
        url: 'https://www.amazon.de/-/de/vine/vine-items?queue=potluck',
        vine: true,
        shopping: false,
        baseUrl: 'https://www.amazon.de/-/de/vine/vine-items'
    },
    {
        label: 'Vine-Seite mit Sprachsegment und Trailing Slash',
        url: 'https://www.amazon.de/-/de/vine/vine-items/',
        vine: true,
        shopping: false,
        baseUrl: 'https://www.amazon.de/-/de/vine/vine-items'
    },
    {
        label: 'Vine-Seite mit Sprachsegment auf amazon.co.uk',
        url: 'https://www.amazon.co.uk/-/en/vine/vine-items',
        vine: true,
        shopping: false,
        baseUrl: 'https://www.amazon.co.uk/-/en/vine/vine-items'
    },
    {
        label: 'Vine-Seite mit Sprachsegment auf amazon.co.jp',
        url: 'https://www.amazon.co.jp/-/ja/vine/vine-items',
        vine: true,
        shopping: false,
        baseUrl: 'https://www.amazon.co.jp/-/ja/vine/vine-items'
    },
    {
        label: 'Vine-Seite ohne Sprachsegment auf amazon.com',
        url: 'https://www.amazon.com/vine/vine-items',
        vine: true,
        shopping: false,
        baseUrl: 'https://www.amazon.com/vine/vine-items'
    },
    {
        label: 'Unterordner der Vine-Seite',
        url: 'https://www.amazon.de/vine/',
        vine: true,
        shopping: false,
        baseUrl: null
    },
    {
        label: 'Shopping-Seite ohne Sprachsegment',
        url: 'https://www.amazon.de/some-product/dp/B000123',
        vine: false,
        shopping: true,
        baseUrl: null
    },
    {
        label: 'Shopping-Seite mit Sprachsegment',
        url: 'https://www.amazon.de/-/de/some-product/dp/B000123',
        vine: false,
        shopping: true,
        baseUrl: null
    },
    {
        label: 'Startseite von Amazon',
        url: 'https://www.amazon.de/',
        vine: false,
        shopping: true,
        baseUrl: null
    },
    {
        label: 'Startseite von Amazon mit Sprachsegment',
        url: 'https://www.amazon.de/-/de/',
        vine: false,
        shopping: true,
        baseUrl: null
    },
    {
        label: 'Video-Seite von Amazon',
        url: 'https://www.amazon.de/gp/video',
        vine: false,
        shopping: false,
        baseUrl: null
    },
    {
        label: 'Musik-Seite von Amazon',
        url: 'https://www.amazon.de/music',
        vine: false,
        shopping: false,
        baseUrl: null
    },
    {
        label: 'Vine-URL auf einer fremden Domain',
        url: 'https://www.example.com/vine/vine-items',
        vine: false,
        shopping: false,
        baseUrl: null
    }
];

/**
 * Fuehrt die Erkennung fuer eine URL in einer Sandbox aus.
 * @param {string} url Die URL der Seite
 * @returns {{vine: boolean, shopping: boolean, baseUrl: string|null}} Das Ergebnis
 */
function detect(url) {
    const _parsed = new URL(url);
    const _location = {
        href: _parsed.href,
        origin: _parsed.origin,
        hostname: _parsed.hostname,
        pathname: _parsed.pathname,
        search: _parsed.search,
        hash: _parsed.hash
    };
    const _sandbox = { window: { location: _location } };
    const _ctx = vm.createContext(_sandbox);
    vm.runInContext(CODE, _ctx, { filename: 'site_detection.js' });
    return vm.runInContext('({ vine: SITE_IS_VINE, shopping: SITE_IS_SHOPPING, baseUrl: aveGetVineBaseUrl() })', _ctx);
}

console.log('Erkennung der Vine-Seiten pruefen');
console.log('='.repeat(70));

let _errors = 0;

for (const _case of CASES) {
    const _result = detect(_case.url);
    const _problems = [];
    if (_result.vine !== _case.vine) _problems.push(`vine ist ${_result.vine}, erwartet ${_case.vine}`);
    if (_result.shopping !== _case.shopping) _problems.push(`shopping ist ${_result.shopping}, erwartet ${_case.shopping}`);
    if (_result.baseUrl !== _case.baseUrl) _problems.push(`baseUrl ist "${_result.baseUrl}", erwartet "${_case.baseUrl}"`);

    if (_problems.length === 0) {
        console.log(`  OK   ${_case.label}`);
    } else {
        _errors++;
        console.log(`  FAIL ${_case.label} (${_case.url})`);
        for (const _problem of _problems) console.log(`         ${_problem}`);
    }
}

console.log('');
console.log('='.repeat(70));
if (_errors === 0) {
    console.log(`>>> RESULT: all ${CASES.length} test cases passed`);
    process.exit(0);
}
console.log(`>>> RESULT: ${_errors} of ${CASES.length} test cases failed`);
process.exit(1);
