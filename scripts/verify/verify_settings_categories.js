#!/usr/bin/env node
/**
 * verify_settings_categories.js
 *
 * Prueft die Auswahl der Kategorien in den Einstellungen (der Turbo-Scan).
 *
 * Die Kategorien werden als Checkboxen angezeigt. Die Unterkategorien einer
 * Hauptkategorie werden erst geladen und angezeigt, wenn sie geoeffnet wird -
 * ausser es ist schon eine Unterkategorie ausgewaehlt, dann wird die
 * Hauptkategorie beim Aufbau der Liste gleich geoeffnet.
 *
 * Geprueft werden:
 *   - die Liste der Hauptkategorien mit Anzahl und Nummer
 *   - das Aufklappen und das Laden der Unterkategorien (nur einmal)
 *   - das gleichzeitige Oeffnen einer Hauptkategorie mit ausgewaehlter Unterkategorie
 *   - das Setzen und Entfernen einer Auswahl (gespeichert wird nur die Nummer)
 *   - der Hinweis, wenn die Kategorien nicht geladen werden koennen
 *
 * Es gibt keinen Vergleich mit einer alten Implementierung: der Typ der
 * Einstellung ist neu (der Vergleich von verify_settings_ui.js deckt weiterhin
 * die alten Typen ab).
 *
 * Usage: node scripts/verify/verify_settings_categories.js
 */

const vm = require('vm');
const { extractBody, currentSource, finish } = require('./lib/verify_helpers');

/**
 * Minimales DOM-Mock. Es merkt sich die Zuhoerer, damit der Test klicken kann.
 *
 * @param {object[]} log Das Protokoll des Tests
 * @returns {object} Das Dokument
 */
function createDomMock(log) {
    const _createElement = (tag) => {
        const _el = {
            tagName: tag.toUpperCase(),
            children: [],
            attributes: {},
            style: {},
            _listeners: {},
            _innerText: '',
            classList: {
                add: (...names) => log.push(`classList.add ${names.join(' ')}`),
                remove: () => {},
                contains: () => false
            },
            set innerText(value) {
                this._innerText = String(value);
            },
            get innerText() {
                return this._innerText;
            },
            set innerHTML(value) {
                this._innerHTML = String(value);
                // Wie im Browser: innerHTML = '' entfernt alle Kinder.
                if (value === '') this.children = [];
            },
            get innerHTML() {
                return this._innerHTML || '';
            },
            setAttribute(name, value) {
                this.attributes[name] = String(value);
            },
            getAttribute(name) {
                return this.attributes[name] !== undefined ? this.attributes[name] : null;
            },
            appendChild(child) {
                this.children.push(child);
                return child;
            },
            addEventListener(type, cb) {
                this._listeners[type] = cb;
            },
            /**
             * Loest einen Zuhoerer aus (fuer den Test).
             */
            trigger(type) {
                if (this._listeners[type]) this._listeners[type]();
            }
        };
        return _el;
    };

    return { createElement: _createElement, body: _createElement('body') };
}

/**
 * Sammelt alle Elemente eines Baums, die die Bedingung erfuellen.
 *
 * @param {object} root Das Wurzelelement
 * @param {function} predicate Die Bedingung
 * @returns {object[]} Die gefundenen Elemente
 */
function findAll(root, predicate) {
    const _result = predicate(root) ? [root] : [];
    for (const _child of root.children || []) _result.push(...findAll(_child, predicate));
    return _result;
}

/**
 * Baut eine Sandbox und fuehrt createSettingsCategoriesElement() aus.
 *
 * @param {object} opts Die Optionen des Tests
 * @returns {Promise<object>} Die Elemente und das Protokoll nach dem Aufbau
 */
async function run(opts = {}) {
    const log = [];
    const _document = createDomMock(log);

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        document: _document,
        SETTINGS: {
            TurboScanCategories: opts.selected || [],
            save: () => log.push('SETTINGS.save()'),
            DebugLevel: 0
        },
        translate: (category, key, fallback) => fallback,
        Array,
        Math,
        JSON,
        String,
        Number,
        Object,
        Promise,
        Error,
        setTimeout: (cb) => {
            cb();
            return 1;
        },
        getVineCategoryParents: async () => {
            log.push('getVineCategoryParents');
            if (opts.failParents) throw new Error('the page could not be loaded');
            return [
                { name: 'Küche, Haushalt & Wohnen', count: 13602, pn: '3167641', cn: '' },
                { name: 'Garten', count: 1249, pn: '10925031', cn: '' }
            ];
        },
        getVineCategoryChildren: async (pn) => {
            log.push(`getVineCategoryChildren ${pn}`);
            return [
                { name: 'Gartendeko', count: 238, pn: '10925031', cn: '87837030' },
                { name: 'Gartenarbeit', count: 226, pn: '10925031', cn: '5211155030' }
            ];
        }
    };
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(opts.code, ctx, { filename: 'settings_categories.js' });

    const _def = { type: 'categories', key: 'TurboScanCategories', name: 'Categories', description: 'desc' };
    const _elem = _document.createElement('div');
    sandbox.createSettingsCategoriesElement(_def, _elem, 'Categories', 'desc');

    // Auf die asynchrone Liste warten.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    return { element: _elem, log, settings: sandbox.SETTINGS };
}

const NEW_NAMES = [
    'createSettingsCategoriesElement',
    'renderSettingsCategories',
    'createSettingsCategoryRow',
    'toggleSettingsCategoryChildren',
    'getCategoryId',
    'isCategorySelected',
    'hasSelectedSubCategory',
    'setCategorySelected',
    'createSettingsItemLeft',
    'createSettingsItemRight'
];

// Es gibt keine alte Version dieser Funktionen, sie werden aus der aktuellen
// Datei gezogen.
const newCode = NEW_NAMES.map((name) => {
    try {
        return extractBody(currentSource(), name);
    } catch {
        return `/* ${name} not present */`;
    }
}).join('\n\n');

let _errors = 0;

/**
 * Prueft eine Bedingung und gibt das Ergebnis aus.
 * @param {boolean} ok true, wenn die Pruefung erfuellt ist
 * @param {string} label Die Bezeichnung der Pruefung
 */
function check(ok, label) {
    if (ok) {
        console.log(`  OK   ${label}`);
        return;
    }
    _errors++;
    console.log(`  FAIL ${label}`);
}

(async () => {
    console.log('Auswahl der Kategorien in den Einstellungen');
    console.log('='.repeat(70));

    // 1. Die Liste der Hauptkategorien
    const _plain = await run({ code: newCode });
    const _checkboxes = findAll(_plain.element, (el) => el.tagName === 'INPUT');
    const _texts = findAll(_plain.element, (el) => el._innerText && el._innerText.includes('(')).map((el) => el._innerText);

    check(_plain.log.includes('getVineCategoryParents'), 'Die Hauptkategorien werden geladen');
    check(_checkboxes.length === 2, 'Es gibt eine Checkbox je Hauptkategorie');
    check(
        JSON.stringify(_checkboxes.map((c) => c.value)) === JSON.stringify(['3167641', '10925031']),
        'Die Checkbox traegt die Nummer der Kategorie als Wert'
    );
    check(
        JSON.stringify(_texts) === JSON.stringify(['Küche, Haushalt & Wohnen (13602)', 'Garten (1249)']),
        'Name und Anzahl stehen an der Checkbox'
    );
    check(!_plain.log.some((l) => l.startsWith('getVineCategoryChildren')), 'Ohne Auswahl wird keine Unterkategorie geladen');
    check(
        _checkboxes.every((c) => c.checked === false),
        'Ohne Auswahl ist keine Checkbox angehakt'
    );

    // 2. Eine Hauptkategorie aufklappen
    const _toggle = findAll(_plain.element, (el) => el._innerText === '▸')[1];
    _toggle.trigger('click');
    await new Promise((resolve) => setImmediate(resolve));

    const _openCheckboxes = findAll(_plain.element, (el) => el.tagName === 'INPUT');
    check(_plain.log.includes('getVineCategoryChildren 10925031'), 'Beim Aufklappen werden die Unterkategorien geladen');
    check(_openCheckboxes.length === 4, 'Die Unterkategorien werden angezeigt');
    check(
        _openCheckboxes.some((c) => c.value === '10925031/87837030'),
        'Eine Unterkategorie wird mit der Nummer der Haupt- und der Unterkategorie gespeichert'
    );

    // Ein zweites Aufklappen darf nicht erneut laden.
    _toggle.trigger('click');
    _toggle.trigger('click');
    await new Promise((resolve) => setImmediate(resolve));
    check(
        _plain.log.filter((l) => l.startsWith('getVineCategoryChildren')).length === 1,
        'Ein zweites Aufklappen laedt die Unterkategorien nicht erneut'
    );

    // 3. Eine Auswahl setzen und wieder entfernen
    const _childCheckbox = _openCheckboxes.find((c) => c.value === '10925031/87837030');
    _childCheckbox.checked = true;
    _childCheckbox.trigger('change');
    check(
        JSON.stringify(_plain.settings.TurboScanCategories) === JSON.stringify(['10925031/87837030']),
        'Eine Auswahl wird als Nummer gespeichert'
    );
    check(_plain.log.includes('SETTINGS.save()'), 'Die Einstellungen werden gespeichert');

    _childCheckbox.checked = false;
    _childCheckbox.trigger('change');
    check(JSON.stringify(_plain.settings.TurboScanCategories) === JSON.stringify([]), 'Eine abgewaehlte Kategorie wird entfernt');

    // 4. Eine ausgewaehlte Unterkategorie oeffnet die Hauptkategorie von selbst
    const _selected = await run({ code: newCode, selected: ['10925031/87837030'] });
    const _selectedCheckboxes = findAll(_selected.element, (el) => el.tagName === 'INPUT');
    check(
        _selected.log.includes('getVineCategoryChildren 10925031'),
        'Mit einer ausgewaehlten Unterkategorie wird die Hauptkategorie geladen'
    );
    check(_selectedCheckboxes.length === 4, 'Die Unterkategorien sind gleich sichtbar');
    check(
        _selectedCheckboxes.find((c) => c.value === '10925031/87837030').checked === true,
        'Die ausgewaehlte Unterkategorie ist angehakt'
    );
    check(_selectedCheckboxes.find((c) => c.value === '3167641').checked === false, 'Die anderen Kategorien sind nicht angehakt');

    // 5. Die Kategorien sind nicht lesbar
    const _failing = await run({ code: newCode, failParents: true });
    const _error = findAll(_failing.element, (el) => el._innerText === 'Die Kategorien konnten nicht geladen werden.');
    check(_error.length === 1, 'Ein Fehler beim Laden wird angezeigt');
    check(_error[0].style.display === 'block', 'Der Hinweis ist sichtbar');
    check(findAll(_failing.element, (el) => el.tagName === 'INPUT').length === 0, 'Es werden keine Checkboxen angezeigt');

    console.log('');
    finish(_errors === 0, _errors);
})();
