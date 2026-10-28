/**
 * verify_settings_ui.js
 *
 * Vergleicht die alte (git HEAD) und die neue Implementierung des
 * Settings-UI. Beide werden in einem vm-Kontext mit einem minimalen DOM- mock
 * ausgefuehrt. Verglichen werden:
 *   1. das erzeugte CSS (normalisiert, ohne Einrueckung)
 *   2. das erzeugte HTML des Settings-Containers
 *   3. das erzeugte DOM fuer jeden Setting-Typ
 *
 * Usage: node scripts/verify/verify_settings_ui.js
 */

const vm = require('vm');
const { prepare, finish } = require('./lib/verify_helpers');

/**
 * Minimales DOM-Mock. Reicht fuer die Erzeugung der Settings-Elemente.
 */
function createDomMock(log) {
    const _mkEl = (tag) => {
        const _el = {
            tagName: tag.toUpperCase(),
            children: [],
            attributes: {},
            style: {},
            classList: {
                _classes: [],
                add(...names) {
                    this._classes.push(...names);
                },
                remove(...names) {
                    this._classes = this._classes.filter((c) => !names.includes(c));
                },
                contains(name) {
                    return this._classes.includes(name);
                }
            },
            _listeners: {},
            setAttribute(name, value) {
                this.attributes[name] = String(value);
            },
            getAttribute(name) {
                return this.attributes[name] !== undefined ? this.attributes[name] : null;
            },
            removeAttribute(name) {
                delete this.attributes[name];
            },
            appendChild(child) {
                this.children.push(child);
                return child;
            },
            remove() {},
            addEventListener(type, cb) {
                this._listeners[type] = cb;
            },
            querySelector() {
                return null;
            },
            querySelectorAll() {
                return [];
            },
            click() {
                if (this._listeners['click']) this._listeners['click']({ target: this });
            }
        };
        Object.defineProperty(_el, 'innerHTML', {
            get() {
                return this._innerHTML || '';
            },
            set(v) {
                this._innerHTML = v;
                log.push(`  innerHTML[${this.tagName}] = ${String(v).substring(0, 120).replace(/\n/g, '\\n')}`);
            }
        });
        Object.defineProperty(_el, 'innerText', {
            get() {
                return this._innerText || '';
            },
            set(v) {
                this._innerText = v;
            }
        });
        Object.defineProperty(_el, 'textContent', {
            get() {
                return this._textContent || '';
            },
            set(v) {
                this._textContent = v;
            }
        });
        Object.defineProperty(_el, 'className', {
            get() {
                return this.classList._classes.join(' ');
            },
            set(v) {
                this.classList._classes = String(v).split(/\s+/).filter(Boolean);
            }
        });
        return _el;
    };

    const document = {
        createElement: (tag) => _mkEl(tag),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        body: _mkEl('body'),
        addEventListener: () => {}
    };
    return document;
}

/** Serialisiert einen DOM-Baum in einen vergleichbaren Text. */
function serialize(el, indent = 0) {
    if (!el) return '(null)';
    const _pad = '  '.repeat(indent);
    const _attrs = Object.keys(el.attributes || {})
        .sort()
        .map((k) => `${k}="${el.attributes[k]}"`)
        .join(' ');
    const _classes = el.classList ? el.classList._classes.join('.') : '';
    let _out = `${_pad}<${el.tagName}${_classes ? ' class="' + _classes + '"' : ''}${_attrs ? ' ' + _attrs : ''}>`;
    if (el._innerHTML) _out += ` innerHTML=${el._innerHTML}`;
    if (el._innerText) _out += ` innerText=${el._innerText}`;
    if (el._textContent) _out += ` textContent=${el._textContent}`;
    if (el.children && el.children.length) {
        _out += '\n';
        for (const _child of el.children) _out += serialize(_child, indent + 1) + '\n';
    }
    return _out;
}

const SETTINGS_DEFS = [
    { type: 'bool', key: 'EnableFullWidth', name: 'Enable Full Width', description: 'desc bool' },
    { type: 'password', key: 'GotifyToken', name: 'Token', description: 'desc password' },
    { type: 'url', key: 'GotifyUrl', name: 'URL', description: 'desc url' },
    {
        type: 'number',
        key: 'BackGroundScanDelayPerPage',
        name: 'Delay',
        description: 'desc number',
        min: 2000,
        max: 20000
    },
    { type: 'button', key: 'BUTTON_RESET', name: 'Reset', description: 'desc button', bgColor: 'red' },
    { type: 'color', key: 'BtnColorAllProducts', name: 'Color', description: 'desc color' },
    { type: 'select', key: 'UI_LANGUAGE', name: 'Language', description: 'desc select', options: ['de', 'en'] },
    { type: 'title', key: 'TITLE_X', name: 'A Title', description: 'desc title' },
    { type: 'keywords', key: 'DesktopNotifikationKeywords', name: 'Keywords', description: 'desc keywords', inputPlaceholder: 'ph' }
];

/** Fuehrt die Implementierung aus und liefert das erzeugte DOM + Log. */
function run(code, names) {
    const log = [];
    const _document = createDomMock(log);
    const _settings = {
        EnableFullWidth: true,
        GotifyToken: 'tok',
        GotifyUrl: 'https://gotify.example.com',
        BackGroundScanDelayPerPage: 6000,
        BtnColorAllProducts: '#ffffff',
        UI_LANGUAGE: 'de',
        DesktopNotifikationKeywords: ['alpha', 'beta'],
        save: () => log.push('SETTINGS.save()'),
        reset: () => {}
    };

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        document: _document,
        window: { location: { href: '', reload: () => log.push('reload') } },
        localStorage: {
            _store: {},
            getItem(k) {
                return this._store[k] !== undefined ? this._store[k] : null;
            },
            setItem(k, v) {
                this._store[k] = String(v);
                log.push(`localStorage.set ${k}`);
            },
            removeItem(k) {
                delete this._store[k];
            }
        },
        SETTINGS: _settings,
        translate: (cat, key, fallback) => fallback,
        colorToHex: (c) => c,
        isNaN: isNaN,
        parseInt: parseInt,
        parseFloat: parseFloat,
        Array,
        Math,
        JSON,
        String,
        Number,
        Object,
        Promise,
        setTimeout: (cb) => {
            log.push('setTimeout');
            return 1;
        },
        clearTimeout: () => {},
        AVE_TITLE: 'AVE',
        AVE_VERSION: '1.0'
    };
    sandbox.window.document = _document;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx, { filename: 'settings.js' });

    const _results = [];
    for (const _def of SETTINGS_DEFS) {
        const _before = log.length;
        const _el = sandbox.createSettingsMenuElement(_def);
        _results.push({ type: _def.type, dom: serialize(_el), log: log.slice(_before) });
    }
    return { results: _results, log };
}

const OLD_NAMES = ['createSettingsMenuElement', 'createSettingsKeywordsTableElement'];
const NEW_NAMES = [
    'createSettingsMenuElement',
    'createSettingsKeywordsTableElement',
    'createSettingsBoolElement',
    'createSettingsPasswordElement',
    'createSettingsUrlElement',
    'createSettingsNumberElement',
    'createSettingsButtonElement',
    'createSettingsColorElement',
    'createSettingsSelectElement',
    'createSettingsTitleElement',
    'createSettingsKeywordsElement',
    'createSettingsKeywordsList',
    'updateSettingsKeywordsList',
    'createSettingsItemRight',
    'createSettingsItemLeft'
];

const { old: oldCode, new: newCode } = prepare('verify_settings_ui.js', OLD_NAMES, NEW_NAMES);

console.log('Fuehre die alte Implementierung aus ...');
const oldRun = run(oldCode);
console.log('Fuehre die neue Implementierung aus ...');
const newRun = run(newCode);

let _diffs = 0;
for (let i = 0; i < SETTINGS_DEFS.length; i++) {
    const _type = SETTINGS_DEFS[i].type;
    const _o = oldRun.results[i];
    const _n = newRun.results[i];
    console.log(`\n===== Typ: ${_type} =====`);
    if (_o.dom !== _n.dom) {
        _diffs++;
        console.log('--- DOM ALT ---');
        console.log(_o.dom);
        console.log('--- DOM NEU ---');
        console.log(_n.dom);
    } else {
        console.log('DOM identisch');
    }
    if (JSON.stringify(_o.log) !== JSON.stringify(_n.log)) {
        _diffs++;
        console.log(`LOG alt: ${JSON.stringify(_o.log)}`);
        console.log(`LOG neu: ${JSON.stringify(_n.log)}`);
    }
}

finish(_diffs === 0, _diffs);
