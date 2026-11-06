#!/usr/bin/env node
/**
 * verify_keyword_conditions.js
 *
 * Prueft die Bedingungen der Keywords (Preis und Kategorie).
 *
 * Ein Keyword kann Preisbedingungen enthalten, z. B.
 * "toaster price>=10 price<20", Kategoriebedingungen, z. B.
 * "category=getraenke", und die Prioritaet seiner Gotify-Nachricht, z. B.
 * "gotifyPriority=8". Ein Text oder eine Kategorie muss angegeben sein, nur
 * Preisbedingungen koennen nie matchen.
 *
 * NOTE: Die Bedingungen stehen ohne Klammern und sind immer ein eigenes Wort,
 * damit die Klammern (AltGr) nicht getippt werden muessen. "[price=0]" ist
 * daher Text und keine Bedingung (siehe die Faelle unten).
 *
 * Geprueft werden:
 *   - die Normalisierung der Preise aus der Benutzereingabe (normalizePriceInput())
 *   - das Parsen einer Preisbedingung (parsePriceCondition())
 *   - das Parsen eines Keywords mit Bedingungen (parseKeywordConfig())
 *   - der Vergleich der Bedingungen mit den Preisen (matchPriceConditions())
 *   - das Parsen einer Kategoriebedingung (parseCategoryCondition())
 *   - der Vergleich der Kategorie mit dem Namen der Kategorie (matchCategoryConditions())
 *   - das Parsen der Prioritaet einer Gotify-Nachricht (parseGotifyPriorityCondition())
 *   - die Prioritaet der Nachricht (getGotifyPriority(): Keyword schlaegt Einstellung)
 *
 * Das Skript prueft das aktuelle Verhalten gegen erwartete Werte. Es vergleicht
 * nicht eine alte mit einer neuen Implementierung, weil die Preisbedingungen
 * ein Feature sind und kein Refactoring.
 *
 * Usage: node scripts/verify/verify_keyword_conditions.js
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

// Der Quelltext, der in der Sandbox ausgefuehrt wird. Die Funktionen werden
// aus der echten Datei geschnitten, damit der Test die echte Implementierung
// prueft und keinen Nachbau.
const CODE = [
    // Die Grenzen der Prioritaet einer Gotify-Nachricht.
    extractConstants(mainSrc, ['GOTIFY_PRIORITY_MIN', 'GOTIFY_PRIORITY_MAX', 'GOTIFY_PRIORITY_DEFAULT']),
    extractBody(mainSrc, 'normalizePriceInput'),
    extractBody(mainSrc, 'parsePriceCondition'),
    extractBody(mainSrc, 'aveIsConditionWord'),
    extractBody(mainSrc, 'parseCategoryCondition'),
    extractBody(mainSrc, 'parseGotifyPriorityCondition'),
    extractBody(mainSrc, 'parseKeywordConfig'),
    extractBody(mainSrc, 'matchPriceConditions'),
    extractBody(mainSrc, 'matchCategoryConditions'),
    // Die Prioritaet der Nachricht (Keyword schlaegt Einstellung).
    extractBody(mainSrc, 'getGotifyPriority'),
    // Das Zerlegen in Woerter und verbatim-Strings und der Textvergleich.
    extractBody(mainSrc, 'aveSplitQuotedWords'),
    extractBody(mainSrc, 'aveUnquoteKeywordPart'),
    extractBody(mainSrc, 'stringToRegex'),
    extractBody(mainSrc, 'matchesKeyword')
].join('\n\n');

const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    SETTINGS: { DebugLevel: 0, GotifyPriority: 5 },
    Math,
    Number,
    Array,
    Object,
    JSON,
    String
};
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: 'price_conditions.js' });

const normalizePriceInput = vm.runInContext('normalizePriceInput', ctx);
const parsePriceCondition = vm.runInContext('parsePriceCondition', ctx);
const parseKeywordConfig = vm.runInContext('parseKeywordConfig', ctx);
const matchPriceConditions = vm.runInContext('matchPriceConditions', ctx);
const parseCategoryCondition = vm.runInContext('parseCategoryCondition', ctx);
const parseGotifyPriorityCondition = vm.runInContext('parseGotifyPriorityCondition', ctx);
const getGotifyPriority = vm.runInContext('getGotifyPriority', ctx);
const matchesKeyword = vm.runInContext('matchesKeyword', ctx);
const matchCategoryConditions = vm.runInContext('matchCategoryConditions', ctx);

/**
 * Die erwarteten Ergebnisse der Normalisierung der Preise.
 * null bedeutet, dass die Eingabe kein gueltiger Preis ist.
 */
const PRICE_CASES = [
    { label: 'Eine ganze Zahl', input: '10', expected: 10 },
    { label: 'Ein Preis mit Punkt', input: '10.50', expected: 10.5 },
    { label: 'Ein Preis mit Komma', input: '10,50', expected: 10.5 },
    { label: 'Ein Preis ohne Nachkommastellen', input: '10.', expected: 10 },
    { label: 'Ein Preis ohne Vorkommastellen', input: '.5', expected: 0.5 },
    { label: 'Ein negativer Preis', input: '-5.25', expected: -5.25 },
    { label: 'Tausendertrennzeichen mit Komma am Ende', input: '1.234,56', expected: 1234.56 },
    { label: 'Tausendertrennzeichen mit Punkt am Ende', input: '1,234.56', expected: 1234.56 },
    { label: 'Zwei Punkte sind nicht erlaubt', input: '1.234.567', expected: null },
    { label: 'Zwei Kommas sind nicht erlaubt', input: '1,234,567', expected: null },
    { label: 'Buchstaben sind nicht erlaubt', input: 'abc', expected: null },
    { label: 'Eine Einheit ist nicht erlaubt', input: '10 EUR', expected: null },
    { label: 'Eine leere Eingabe ist nicht erlaubt', input: '', expected: null },
    { label: 'Nur ein Trennzeichen am Ende', input: '10,', expected: 10 }
];

/**
 * Die erwarteten Ergebnisse des Parsens einer Preisbedingung.
 */
const CONDITION_CASES = [
    { label: 'Groesser als', input: 'price > 10', expected: { op: '>', price: 10 } },
    { label: 'Groesser oder gleich', input: 'price >= 10', expected: { op: '>=', price: 10 } },
    { label: 'Kleiner als', input: 'price < 10', expected: { op: '<', price: 10 } },
    { label: 'Kleiner oder gleich', input: 'price <= 10', expected: { op: '<=', price: 10 } },
    { label: 'Gleich', input: 'price = 10', expected: { op: '=', price: 10 } },
    { label: 'Gleich (zwei Zeichen)', input: 'price == 10', expected: { op: '==', price: 10 } },
    { label: 'Ungleich', input: 'price != 10', expected: { op: '!=', price: 10 } },
    { label: 'Ungleich (zwei Zeichen)', input: 'price <> 10', expected: { op: '<>', price: 10 } },
    {
        label: 'Preis mit Komma und Leerzeichen',
        input: 'price >= 10,50',
        expected: { op: '>=', price: 10.5 }
    },
    { label: 'Ein unbekanntes Feld', input: 'data_estimated_tax_prize > 10', expected: null },
    { label: 'Ein unbekannter Operator', input: 'price ~ 10', expected: null },
    { label: 'Ein ungueltiger Preis', input: 'price > abc', expected: null }
];

/**
 * Die erwarteten Ergebnisse des Parsens einer Kategoriebedingung.
 */
const CATEGORY_CONDITION_CASES = [
    { label: 'Eine Kategorie', input: 'category=getraenke', expected: { op: '=', text: 'getraenke' } },
    { label: 'Eine Kategorie mit Leerzeichen', input: 'category = Lebensmittel', expected: { op: '=', text: 'lebensmittel' } },
    { label: 'Die Abkuerzung c', input: 'c=kaffee', expected: { op: '=', text: 'kaffee' } },
    { label: 'Ungleich', input: 'category!=garten', expected: { op: '!=', text: 'garten' } },
    { label: 'Ungleich (zwei Zeichen)', input: 'category<>garten', expected: { op: '<>', text: 'garten' } },
    { label: 'Alphabetisch davor', input: 'category<kaffee', expected: { op: '<', text: 'kaffee' } },
    { label: 'Alphabetisch davor oder gleich', input: 'category<=kaffee', expected: { op: '<=', text: 'kaffee' } },
    { label: 'Alphabetisch danach', input: 'category>kaffee', expected: { op: '>', text: 'kaffee' } },
    { label: 'Alphabetisch danach oder gleich', input: 'category>=kaffee', expected: { op: '>=', text: 'kaffee' } },
    { label: 'Eine Kategorie in Anfuehrungszeichen', input: 'category="kaffee tee"', expected: { op: '=', text: 'kaffee tee' } },
    {
        label: 'Eine Kategorie in Anfuehrungszeichen mit Leerzeichen',
        input: 'c = "kaffee & tee"',
        expected: { op: '=', text: 'kaffee & tee' }
    },
    { label: 'Eine Kategorie ohne Text', input: 'category=', expected: null },
    { label: 'Leere Anfuehrungszeichen', input: 'category=""', expected: null },
    { label: 'Eine Kategorie ohne Operator', input: 'category getraenke', expected: null },
    { label: 'Die Tilde ist kein Operator mehr', input: 'category~getraenke', expected: null },
    { label: 'Ein unbekanntes Feld', input: 'kategorie=getraenke', expected: null }
];

/**
 * Die erwarteten Ergebnisse des Parsens der Prioritaet einer Gotify-Nachricht.
 * null bedeutet, dass der Text keine gueltige Bedingung ist.
 */
const PRIORITY_CONDITION_CASES = [
    { label: 'Eine Prioritaet', input: 'gotifyPriority=8', expected: { priority: 8 } },
    { label: 'Eine Prioritaet mit Leerzeichen', input: 'gotifyPriority = 8', expected: { priority: 8 } },
    { label: 'Zwei Gleichheitszeichen sind keine Zuweisung', input: 'gotifyPriority==8', expected: null },
    { label: 'Die kleinste Prioritaet', input: 'gotifyPriority=0', expected: { priority: 0 } },
    { label: 'Die groesste Prioritaet', input: 'gotifyPriority=10', expected: { priority: 10 } },
    { label: 'Eine Abkuerzung mit einem Buchstaben', input: 'g=8', expected: { priority: 8 } },
    { label: 'Eine Abkuerzung mit zwei Buchstaben', input: 'go=8', expected: { priority: 8 } },
    { label: 'Eine Abkuerzung mit drei Buchstaben', input: 'got=8', expected: { priority: 8 } },
    { label: 'Eine Abkuerzung mit sechs Buchstaben', input: 'gotify=8', expected: { priority: 8 } },
    { label: 'Eine Abkuerzung mit acht Buchstaben', input: 'gotifypr=8', expected: { priority: 8 } },
    { label: 'Alles klein geschrieben', input: 'gotifypriority=8', expected: { priority: 8 } },
    { label: 'Alles gross geschrieben', input: 'GOTIFYPRIORITY=8', expected: { priority: 8 } },
    { label: 'Eine fuehrende Null', input: 'gotifyPriority=08', expected: { priority: 8 } },
    { label: 'Ueber der groessten Prioritaet', input: 'gotifyPriority=11', expected: null },
    { label: 'Unter der kleinsten Prioritaet', input: 'gotifyPriority=-1', expected: null },
    { label: 'Eine Kommazahl', input: 'gotifyPriority=8.5', expected: null },
    { label: 'Ein Text als Wert', input: 'gotifyPriority=hoch', expected: null },
    { label: 'Ein fehlender Wert', input: 'gotifyPriority=', expected: null },
    { label: 'Ein ungueltiger Operator', input: 'gotifyPriority!=8', expected: null },
    { label: 'Ein Vergleich als Operator', input: 'gotifyPriority>8', expected: null },
    { label: 'Das Feld fuer den Preis', input: 'price=8', expected: null },
    { label: 'Das Feld fuer die Kategorie', input: 'category=8', expected: null },
    { label: 'Ein unbekanntes Feld', input: 'prioritaet=8', expected: null }
];

/**
 * Die erwarteten Ergebnisse der Prioritaet der Nachricht.
 * priority ist der Wert des Keywords (null, wenn es keinen nennt), setting ist
 * der Wert der Einstellung.
 */
const PRIORITY_RESOLVE_CASES = [
    { label: 'Das Keyword schlaegt die Einstellung', priority: 8, setting: 5, expected: 8 },
    { label: 'Ohne Priority im Keyword gilt die Einstellung', priority: null, setting: 3, expected: 3 },
    { label: 'Das Keyword darf die kleinste Prioritaet setzen', priority: 0, setting: 5, expected: 0 },
    { label: 'Das Keyword darf die groesste Prioritaet setzen', priority: 10, setting: 5, expected: 10 },
    { label: 'Ein Text als Einstellung ergibt den Standard', priority: null, setting: 'abc', expected: 5 },
    { label: 'Eine Einstellung ueber der Skala ergibt den Standard', priority: null, setting: 11, expected: 5 },
    { label: 'Eine Einstellung unter der Skala ergibt den Standard', priority: null, setting: -1, expected: 5 },
    { label: 'Eine fehlende Einstellung ergibt den Standard', priority: null, setting: undefined, expected: 5 },
    { label: 'Eine leere Einstellung ergibt den Standard', priority: null, setting: '', expected: 5 },
    { label: 'Eine Einstellung als Text', priority: null, setting: '7', expected: 7 },
    { label: 'Der Standard ist 5', priority: null, setting: null, expected: 5 }
];

/**
 * Die erwarteten Ergebnisse des Vergleichs der Kategorie.
 */
const CATEGORY_MATCH_CASES = [
    {
        label: 'Der Name ist genau der gesuchte',
        categories: [{ op: '=', text: 'garten' }],
        categoryText: 'Garten',
        expected: true
    },
    {
        label: 'Der Name ist ein anderer',
        categories: [{ op: '=', text: 'garten' }],
        categoryText: 'Lebensmittel & Getränke',
        expected: false
    },
    {
        label: 'Ein Teil des Namens ist nicht der Name',
        categories: [{ op: '=', text: 'garten' }],
        categoryText: 'Gartendeko',
        expected: false
    },
    {
        label: 'Gross und klein spielt keine Rolle',
        categories: [{ op: '=', text: 'garten' }],
        categoryText: 'GARTEN',
        expected: true
    },
    {
        // Ein Produkt hat eine Kategorie. Der Text der Seite kann ein Pfad sein,
        // die Kategorie des Produkts ist der letzte Name.
        label: 'Ein Pfad: der letzte Name ist die Kategorie',
        categories: [{ op: '=', text: 'unter' }],
        categoryText: 'Haupt > Unter',
        expected: true
    },
    {
        label: 'Ein Pfad: der erste Name ist nicht die Kategorie',
        categories: [{ op: '=', text: 'haupt' }],
        categoryText: 'Haupt > Unter',
        expected: false
    },
    {
        label: 'Ein Name mit Leerzeichen in Anfuehrungszeichen',
        categories: [{ op: '=', text: 'kaffee tee' }],
        categoryText: 'Getränke > Kaffee Tee',
        expected: true
    },
    {
        label: 'Der Name kommt nicht vor (ungleich passt)',
        categories: [{ op: '!=', text: 'garten' }],
        categoryText: 'Lebensmittel & Getränke',
        expected: true
    },
    {
        label: 'Der Name kommt vor (ungleich passt nicht)',
        categories: [{ op: '!=', text: 'garten' }],
        categoryText: 'Garten',
        expected: false
    },
    {
        label: 'Alphabetisch davor',
        categories: [{ op: '<', text: 'kaffee' }],
        categoryText: 'Garten',
        expected: true
    },
    {
        label: 'Alphabetisch davor (passt nicht)',
        categories: [{ op: '<', text: 'a' }],
        categoryText: 'Garten',
        expected: false
    },
    {
        label: 'Alphabetisch danach',
        categories: [{ op: '>', text: 'kaffee' }],
        categoryText: 'Lebensmittel & Getränke',
        expected: true
    },
    {
        label: 'Alphabetisch danach (passt nicht)',
        categories: [{ op: '>', text: 'z' }],
        categoryText: 'Garten',
        expected: false
    },
    {
        label: 'Bei einem Pfad zaehlt der letzte Name (kleiner)',
        categories: [{ op: '<', text: 'm' }],
        categoryText: 'Garten > Zubehör',
        expected: false
    },
    {
        label: 'Bei einem Pfad zaehlt der letzte Name (groesser)',
        categories: [{ op: '>', text: 'm' }],
        categoryText: 'Garten > Zubehör',
        expected: true
    },
    {
        label: 'Ohne Kategorie passt keine Bedingung',
        categories: [{ op: '=', text: 'getränke' }],
        categoryText: '',
        expected: false
    },
    {
        label: 'Beide Bedingungen muessen passen',
        categories: [
            { op: '=', text: 'kaffee' },
            { op: '>', text: 'a' }
        ],
        categoryText: 'Lebensmittel & Getränke > Kaffee',
        expected: true
    },
    {
        label: 'Eine von zwei Bedingungen passt nicht',
        categories: [
            { op: '=', text: 'kaffee' },
            { op: '=', text: 'blumen' }
        ],
        categoryText: 'Lebensmittel & Getränke > Kaffee',
        expected: false
    }
];

/**
 * Die erwarteten Ergebnisse des Parsens eines Keywords.
 */
const KEYWORD_CASES = [
    {
        label: 'Ein einfaches Keyword bleibt unveraendert',
        input: 'toaster',
        expected: { keyword: 'toaster', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein regulaerer Ausdruck bleibt unveraendert',
        input: '/wicht.*produkt/i',
        expected: { keyword: '/wicht.*produkt/i', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein Keyword mit einer Preisbedingung',
        input: 'toaster price >= 10',
        expected: { keyword: 'toaster', conditions: [{ op: '>=', price: 10 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Eine Preisbedingung ohne Leerzeichen',
        input: 'toaster price>=10',
        expected: { keyword: 'toaster', conditions: [{ op: '>=', price: 10 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Die Abkuerzung p fuer price',
        input: 'toaster p>=10',
        expected: { keyword: 'toaster', conditions: [{ op: '>=', price: 10 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Die Abkuerzung pr fuer price',
        input: 'toaster pr < 20',
        expected: { keyword: 'toaster', conditions: [{ op: '<', price: 20 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Die Abkuerzung c fuer category',
        input: 'kaffee c=getraenke',
        expected: { keyword: 'kaffee', conditions: [], categories: [{ op: '=', text: 'getraenke' }], gotifyPriority: null, valid: true }
    },
    {
        label: 'Die Abkuerzung cat fuer category',
        input: 'kaffee cat = getraenke',
        expected: { keyword: 'kaffee', conditions: [], categories: [{ op: '=', text: 'getraenke' }], gotifyPriority: null, valid: true }
    },
    {
        label: 'Beide Abkuerzungen zusammen',
        input: 'p=0 c=getränke',
        expected: {
            keyword: '',
            conditions: [{ op: '=', price: 0 }],
            categories: [{ op: '=', text: 'getränke' }],
            gotifyPriority: null,
            valid: true
        }
    },
    {
        label: 'Jede Verkuerzung von price: pri',
        input: 'toaster pri>=10',
        expected: { keyword: 'toaster', conditions: [{ op: '>=', price: 10 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Jede Verkuerzung von price: pric',
        input: 'toaster pric < 20',
        expected: { keyword: 'toaster', conditions: [{ op: '<', price: 20 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Jede Verkuerzung von category: ca',
        input: 'kaffee ca=getraenke',
        expected: { keyword: 'kaffee', conditions: [], categories: [{ op: '=', text: 'getraenke' }], gotifyPriority: null, valid: true }
    },
    {
        label: 'Jede Verkuerzung von category: cate',
        input: 'kaffee cate=getraenke',
        expected: { keyword: 'kaffee', conditions: [], categories: [{ op: '=', text: 'getraenke' }], gotifyPriority: null, valid: true }
    },
    {
        label: 'Jede Verkuerzung von category: categ',
        input: 'kaffee categ = tee',
        expected: { keyword: 'kaffee', conditions: [], categories: [{ op: '=', text: 'tee' }], gotifyPriority: null, valid: true }
    },
    {
        // "ca" verkuerzt "category", der Operator ist der eines Preises: der Name
        // der Kategorie wird alphabetisch mit "10" verglichen.
        label: 'Eine Verkuerzung von category mit einem Ordnungs-Operator',
        input: 'ca>=10',
        expected: { keyword: '', conditions: [], categories: [{ op: '>=', text: '10' }], gotifyPriority: null, valid: true }
    },
    {
        // Die Tilde ist kein Operator mehr, der Text bleibt also ein Keyword.
        label: 'Die Tilde macht keine Bedingung mehr',
        input: 'toaster pri~ x',
        expected: { keyword: 'toaster pri~ x', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        // "preis" beginnt mit "pr" und "p", ist aber ein Text.
        label: 'Ein Wort, das nur mit der Abkuerzung beginnt, bleibt Text',
        input: 'preis>=10',
        expected: { keyword: 'preis>=10', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein einzelnes p bleibt Text',
        input: 'p',
        expected: { keyword: 'p', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein einzelnes c bleibt Text',
        input: 'c',
        expected: { keyword: 'c', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein Komma als Dezimaltrennzeichen',
        input: 'kaffee price>=10,50',
        expected: { keyword: 'kaffee', conditions: [{ op: '>=', price: 10.5 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein Keyword mit zwei Preisbedingungen',
        input: 'toaster price >= 10 price < 20',
        expected: {
            keyword: 'toaster',
            conditions: [
                { op: '>=', price: 10 },
                { op: '<', price: 20 }
            ],
            categories: [],
            gotifyPriority: null,
            valid: true
        }
    },
    {
        label: 'Eine Preisbedingung ohne Keyword',
        input: 'price >= 10',
        expected: { keyword: '', conditions: [{ op: '>=', price: 10 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        // Die Bedingung steht in der Mitte: die Leerzeichen drumherum muessen
        // mitverschwinden, sonst sucht das Script nach "toaster   white".
        label: 'Eine Bedingung zwischen zwei Woertern',
        input: 'toaster price > 100 white',
        expected: { keyword: 'toaster white', conditions: [{ op: '>', price: 100 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Eine Bedingung am Anfang',
        input: 'price > 100 toaster white',
        expected: { keyword: 'toaster white', conditions: [{ op: '>', price: 100 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Eine Bedingung am Ende',
        input: 'toaster white price > 100',
        expected: { keyword: 'toaster white', conditions: [{ op: '>', price: 100 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein Keyword mit einer Kategoriebedingung',
        input: 'kaffee category=getraenke',
        expected: { keyword: 'kaffee', conditions: [], categories: [{ op: '=', text: 'getraenke' }], gotifyPriority: null, valid: true }
    },
    {
        // Der Ausdruck der Anforderung: ein Preis ohne Keyword, nur mit Kategorie.
        label: 'Nur Bedingungen ohne Keyword',
        input: 'price=0 category=getränke',
        expected: {
            keyword: '',
            conditions: [{ op: '=', price: 0 }],
            categories: [{ op: '=', text: 'getränke' }],
            gotifyPriority: null,
            valid: true
        }
    },
    {
        label: 'Zwei Kategoriebedingungen',
        input: 'category=lebensmittel category=tee',
        expected: {
            keyword: '',
            conditions: [],
            categories: [
                { op: '=', text: 'lebensmittel' },
                { op: '=', text: 'tee' }
            ],
            gotifyPriority: null,
            valid: true
        }
    },
    {
        label: 'Ein verbatim-String bleibt im Keyword erhalten',
        input: 'kaffee "bohnen extra"',
        expected: { keyword: 'kaffee "bohnen extra"', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein verbatim-String als Kategoriename',
        input: 'category="kaffee tee" kaffee',
        expected: { keyword: 'kaffee', conditions: [], categories: [{ op: '=', text: 'kaffee tee' }], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein verbatim-String neben einer Preisbedingung',
        input: '"kaffee bohnen" p>=10',
        expected: { keyword: '"kaffee bohnen"', conditions: [{ op: '>=', price: 10 }], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Eine kaputte Preisbedingung macht das Keyword ungueltig',
        input: 'toaster price > abc',
        expected: { keyword: 'toaster price > abc', conditions: [], categories: [], gotifyPriority: null, valid: false }
    },
    {
        label: 'Eine kaputte Kategoriebedingung macht das Keyword ungueltig',
        input: 'kaffee category=',
        expected: { keyword: 'kaffee category=', conditions: [], categories: [], gotifyPriority: null, valid: false }
    },
    {
        label: 'Ein Keyword mit dem Wort price, aber ohne Bedingung',
        input: 'special price',
        expected: { keyword: 'special price', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein Keyword mit dem Wort category, aber ohne Bedingung',
        input: 'category',
        expected: { keyword: 'category', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        // Die Klammern sind kein Teil der Syntax mehr: der Text wird gesucht.
        label: 'Klammern sind Text und keine Bedingung',
        input: '[price=0]',
        expected: { keyword: '[price=0]', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Auch eine Kategoriebedingung in Klammern ist Text',
        input: 'kaffee [category~getränke]',
        expected: {
            keyword: 'kaffee [category~getränke]',
            conditions: [],
            categories: [],
            gotifyPriority: null,
            valid: true
        }
    },
    {
        label: 'Nur die englischen Feldnamen sind Bedingungen',
        input: 'kaffee preis>=10',
        expected: { keyword: 'kaffee preis>=10', conditions: [], categories: [], gotifyPriority: null, valid: true }
    },
    {
        label: 'Ein anderer Feldname ist keine Bedingung',
        input: 'toaster data_estimated_tax_prices >= 10',
        expected: {
            keyword: 'toaster data_estimated_tax_prices >= 10',
            conditions: [],
            categories: [],
            gotifyPriority: null,
            valid: true
        }
    },
    {
        label: 'Ein Keyword mit einer Prioritaet',
        input: 'toaster gotifyPriority=8',
        expected: { keyword: 'toaster', conditions: [], categories: [], gotifyPriority: 8, valid: true }
    },
    {
        label: 'Eine abgekuerzte Prioritaet',
        input: 'toaster g=8',
        expected: { keyword: 'toaster', conditions: [], categories: [], gotifyPriority: 8, valid: true }
    },
    {
        label: 'Eine Prioritaet mit Leerzeichen um den Operator',
        input: 'toaster gotifyPriority = 8',
        expected: { keyword: 'toaster', conditions: [], categories: [], gotifyPriority: 8, valid: true }
    },
    {
        label: 'Eine Prioritaet vor dem Keyword',
        input: 'gotifyPriority=8 toaster',
        expected: { keyword: 'toaster', conditions: [], categories: [], gotifyPriority: 8, valid: true }
    },
    {
        label: 'Eine Prioritaet zwischen zwei Woertern',
        input: 'toaster gotifyPriority=8 white',
        expected: { keyword: 'toaster white', conditions: [], categories: [], gotifyPriority: 8, valid: true }
    },
    {
        label: 'Eine Prioritaet zusammen mit Preis und Kategorie',
        input: 'toaster price>=10 category=kaffee gotifyPriority=9',
        expected: {
            keyword: 'toaster',
            conditions: [{ op: '>=', price: 10 }],
            categories: [{ op: '=', text: 'kaffee' }],
            gotifyPriority: 9,
            valid: true
        }
    },
    {
        label: 'Zwei Prioritaeten: die zweite gilt',
        input: 'toaster gotifyPriority=3 gotifyPriority=8',
        expected: { keyword: 'toaster', conditions: [], categories: [], gotifyPriority: 8, valid: true }
    },
    {
        label: 'Eine Prioritaet ohne Keyword ist kein Treffer',
        input: 'gotifyPriority=8',
        expected: { keyword: '', conditions: [], categories: [], gotifyPriority: 8, valid: true }
    },
    {
        label: 'Eine Prioritaet ueber der Skala macht das Keyword ungueltig',
        input: 'toaster gotifyPriority=11',
        expected: { keyword: 'toaster gotifyPriority=11', conditions: [], categories: [], gotifyPriority: null, valid: false }
    },
    {
        label: 'Eine Prioritaet mit Text als Wert macht das Keyword ungueltig',
        input: 'toaster gotifyPriority=hoch',
        expected: {
            keyword: 'toaster gotifyPriority=hoch',
            conditions: [],
            categories: [],
            gotifyPriority: null,
            valid: false
        }
    },
    {
        label: 'Zwei Gleichheitszeichen machen das Keyword ungueltig',
        input: 'toaster gotifyPriority==8',
        expected: {
            keyword: 'toaster gotifyPriority==8',
            conditions: [],
            categories: [],
            gotifyPriority: null,
            valid: false
        }
    },
    {
        label: 'Ein Vergleich macht das Keyword ungueltig',
        input: 'toaster gotifyPriority!=8',
        expected: {
            keyword: 'toaster gotifyPriority!=8',
            conditions: [],
            categories: [],
            gotifyPriority: null,
            valid: false
        }
    }
];

/**
 * Die erwarteten Ergebnisse des Vergleichs der Bedingungen mit den Preisen.
 */
const MATCH_CASES = [
    {
        label: 'Ein Preis ist gleich',
        conditions: [{ op: '=', price: 12.5 }],
        prices: [12.5],
        expected: true
    },
    {
        label: 'Kein Preis ist gleich',
        conditions: [{ op: '=', price: 12.5 }],
        prices: [10, 25],
        expected: false
    },
    {
        label: 'Kein Preis ist gleich (ungleich)',
        conditions: [{ op: '!=', price: 12.5 }],
        prices: [10, 25],
        expected: true
    },
    {
        label: 'Ein Preis ist gleich (ungleich)',
        conditions: [{ op: '!=', price: 12.5 }],
        prices: [12.5, 25],
        expected: false
    },
    {
        label: 'Der kleinste Preis ist kleiner',
        conditions: [{ op: '<', price: 20 }],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Der kleinste Preis ist nicht kleiner',
        conditions: [{ op: '<', price: 12.5 }],
        prices: [12.5, 25],
        expected: false
    },
    {
        label: 'Der kleinste Preis ist kleiner oder gleich',
        conditions: [{ op: '<=', price: 12.5 }],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Der groesste Preis ist groesser',
        conditions: [{ op: '>', price: 20 }],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Der groesste Preis ist nicht groesser',
        conditions: [{ op: '>', price: 25 }],
        prices: [12.5, 25],
        expected: false
    },
    {
        label: 'Der groesste Preis ist groesser oder gleich',
        conditions: [{ op: '>=', price: 25 }],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Zwei Bedingungen passen',
        conditions: [
            { op: '>=', price: 10 },
            { op: '<', price: 20 }
        ],
        prices: [12.5, 25],
        expected: true
    },
    {
        label: 'Eine von zwei Bedingungen passt nicht',
        conditions: [
            { op: '>=', price: 10 },
            { op: '<', price: 12.5 }
        ],
        prices: [12.5, 25],
        expected: false
    },
    {
        label: 'Ohne Preise passt keine Bedingung',
        conditions: [{ op: '!=', price: 12.5 }],
        prices: [],
        expected: false
    },
    {
        // Ein Produkt ohne Preis hat eine leere Liste, es darf nicht als
        // "Preis 0" gelten.
        label: 'Ohne Preis matcht "= 0" nicht',
        conditions: [{ op: '=', price: 0 }],
        prices: [],
        expected: false
    },
    {
        label: 'Ein echter Preis von 0 matcht "= 0"',
        conditions: [{ op: '=', price: 0 }],
        prices: [0],
        expected: true
    },
    {
        label: 'Ein Preis groesser 0 matcht "= 0" nicht',
        conditions: [{ op: '=', price: 0 }],
        prices: [25],
        expected: false
    },
    {
        label: 'Ohne Preis matcht ">= 0" nicht',
        conditions: [{ op: '>=', price: 0 }],
        prices: [],
        expected: false
    }
];

/**
 * Die erwarteten Ergebnisse des Textvergleichs (matchesKeyword()).
 *
 * Ein Wort muss irgendwo im Text vorkommen, ein Teil in doppelten Anfuehrungszeichen
 * dagegen genau so (mit seinen Leerzeichen).
 */
const KEYWORD_MATCH_CASES = [
    { label: 'Zwei Woerter in beliebiger Reihenfolge', keyword: 'a b', descFull: 'a x b', expected: true },
    { label: 'Ein verbatim-String passt nicht auf getrennte Woerter', keyword: '"a b"', descFull: 'a x b', expected: false },
    { label: 'Ein verbatim-String passt, wenn er genau so vorkommt', keyword: '"a b"', descFull: 'a b c', expected: true },
    { label: 'Ein verbatim-String mit doppeltem Leerzeichen passt nicht', keyword: '"a b"', descFull: 'a  b', expected: false },
    { label: 'Ein verbatim-String mit mehreren Woertern', keyword: '"kaffee bohnen"', descFull: 'kaffee bohnen 1 kg', expected: true },
    { label: 'Wort und verbatim-String zusammen', keyword: 'kaffee "bohnen extra"', descFull: 'kaffee bohnen extra stark', expected: true },
    { label: 'Wort und verbatim-String: das Wort fehlt', keyword: 'tee "bohnen extra"', descFull: 'kaffee bohnen extra', expected: false },
    { label: 'Ein verbatim-String ist kein regulaerer Ausdruck', keyword: '"a.b"', descFull: 'a.b c', expected: true },
    { label: 'Ein Punkt im verbatim-String passt auf kein anderes Zeichen', keyword: '"a.b"', descFull: 'axb', expected: false },
    { label: 'Ein regulaerer Ausdruck im Keyword', keyword: '/a.c/', descFull: 'abc', expected: true },
    { label: 'Ein leerer Text passt nicht', keyword: 'kaffee', descFull: '', expected: false }
];

console.log('Bedingungen der Keywords pruefen (Preis und Kategorie)');
console.log('='.repeat(70));

let _errors = 0;

/**
 * Vergleicht zwei Werte und gibt eine Fehlermeldung aus, wenn sie sich unterscheiden.
 * @param {*} expected Der erwartete Wert
 * @param {*} actual Der erhaltene Wert
 * @param {string} label Die Bezeichnung der Pruefung
 */
function check(expected, actual, label) {
    if (JSON.stringify(expected) === JSON.stringify(actual)) return;
    _errors++;
    console.log(`  FAIL ${label}`);
    console.log(`         erwartet: ${JSON.stringify(expected)}  bekommen: ${JSON.stringify(actual)}`);
}

for (const _case of PRICE_CASES) {
    check(_case.expected, normalizePriceInput(_case.input), _case.label);
}

for (const _case of CONDITION_CASES) {
    check(_case.expected, parsePriceCondition(_case.input), _case.label);
}

for (const _case of CATEGORY_CONDITION_CASES) {
    check(_case.expected, parseCategoryCondition(_case.input), _case.label);
}

for (const _case of PRIORITY_CONDITION_CASES) {
    check(_case.expected, parseGotifyPriorityCondition(_case.input), _case.label);
}

for (const _case of PRIORITY_RESOLVE_CASES) {
    sandbox.SETTINGS.GotifyPriority = _case.setting;
    check(_case.expected, getGotifyPriority(_case.priority), _case.label);
}
sandbox.SETTINGS.GotifyPriority = 5;

for (const _case of CATEGORY_MATCH_CASES) {
    check(_case.expected, matchCategoryConditions(_case.categories, _case.categoryText), _case.label);
}

for (const _case of KEYWORD_CASES) {
    check(_case.expected, parseKeywordConfig(_case.input), _case.label);
}

for (const _case of MATCH_CASES) {
    check(_case.expected, matchPriceConditions(_case.conditions, _case.prices), _case.label);
}

for (const _case of KEYWORD_MATCH_CASES) {
    check(_case.expected, matchesKeyword(_case.descFull, _case.keyword), _case.label);
}

const _total =
    PRICE_CASES.length +
    CONDITION_CASES.length +
    CATEGORY_CONDITION_CASES.length +
    PRIORITY_CONDITION_CASES.length +
    PRIORITY_RESOLVE_CASES.length +
    KEYWORD_CASES.length +
    CATEGORY_MATCH_CASES.length +
    MATCH_CASES.length +
    KEYWORD_MATCH_CASES.length;
if (_errors === 0) {
    console.log(`  alle ${_total} Faelle sind ok`);
} else {
    console.log(`  ${_errors} von ${_total} Faellen sind fehlgeschlagen`);
}

console.log('');
console.log('='.repeat(70));
if (_errors === 0) {
    console.log(`>>> RESULT: all ${_total} test cases passed`);
    process.exit(0);
}
console.log(`>>> RESULT: ${_errors} of ${_total} test cases failed`);
process.exit(1);
