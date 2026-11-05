/**
 * Checks the keys of the settings.
 *
 * Every setting of SETTINGS_USERCONFIG_DEFINES needs a label and a description
 * in every language of the I18N. If a key does not match, the label or the
 * description of the setting is not found and the tooltip of the setting shows
 * the name of the setting instead of its description.
 *
 * The script also checks the other way round, so that an entry of the I18N
 * that does not belong to a setting is reported.
 *
 * Usage: node scripts/check_settings_keys.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Reads the definitions of the settings and the translations.
 *
 * @returns {{defines: Array<object>, i18n: object}} The definitions and the translations
 */
function readSettings() {
    const _ctx = vm.createContext({ console, SETTINGS: { UI_LANGUAGE: 'de' } });
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'i18n.js'), 'utf8'), _ctx);

    const _i18n = vm.runInContext('I18N', _ctx);

    // The definitions are read from the source, because globals.js can not be
    // executed outside of a browser.
    const _source = fs.readFileSync(path.join(REPO_ROOT, 'globals.js'), 'utf8');
    const _blocks = _source.split('SETTINGS_USERCONFIG_DEFINES.push(').slice(1);
    const _defines = [];
    for (const _block of _blocks) {
        const _match = _block.match(/key:\s*'([^']+)'/);
        if (_match) _defines.push({ key: _match[1] });
    }

    return { defines: _defines, i18n: _i18n };
}

const { defines, i18n } = readSettings();
const _keys = defines.map((_d) => _d.key);

let _allOk = true;

console.log('\n########## Die Schluessel der Einstellungen ##########');
console.log(`Einstellungen: ${_keys.length}`);

for (const _lang of Object.keys(i18n)) {
    console.log(`\n--- Sprache: ${_lang} ---`);

    for (const _category of ['settingsLabels', 'settingsDescriptions']) {
        const _entries = i18n[_lang][_category] || {};
        const _missing = _keys.filter((_k) => !_entries[_k]);
        const _orphan = Object.keys(_entries).filter((_k) => !_keys.includes(_k));

        if (_missing.length === 0 && _orphan.length === 0) {
            console.log(`  ${_category}: alle ${_keys.length} Eintraege vorhanden`);
            continue;
        }

        _allOk = false;
        console.log(`  ${_category}: FEHLER`);
        for (const _key of _missing) {
            console.log(`    fehlt: ${_key}`);
        }
        for (const _key of _orphan) {
            console.log(`    gehoert zu keiner Einstellung: ${_key}`);
        }
    }
}

// Jede Kategorie der Texte hat in jeder Sprache die gleichen Schluessel. Fehlt
// einer, wird im Skript der Fallback des Aufrufers benutzt und die Konsole
// meldet "No translation for ...".
console.log('\n########## Die Schluessel der Texte ##########');

const _languages = Object.keys(i18n);
const _categories = [...new Set(_languages.flatMap((_lang) => Object.keys(i18n[_lang])))].sort();

for (const _category of _categories) {
    const _keysPerLanguage = _languages.map((_lang) => ({ lang: _lang, keys: Object.keys(i18n[_lang][_category] || {}) }));
    const _allKeys = [...new Set(_keysPerLanguage.flatMap((_entry) => _entry.keys))].sort();
    const _problems = [];

    for (const _entry of _keysPerLanguage) {
        const _missing = _allKeys.filter((_key) => !_entry.keys.includes(_key));
        if (_missing.length > 0) _problems.push(`${_entry.lang}: fehlt ${_missing.join(', ')}`);
    }

    if (_problems.length === 0) {
        console.log(`  ${_category}: ${_allKeys.length} Schluessel in ${_languages.length} Sprachen`);
        continue;
    }

    _allOk = false;
    console.log(`  ${_category}: FEHLER`);
    for (const _problem of _problems) console.log(`    ${_problem}`);
}

console.log('');
if (_allOk) {
    console.log('>>> ERGEBNIS: alle Schluessel passen');
    process.exit(0);
} else {
    console.log('>>> ERGEBNIS: FEHLER gefunden');
    process.exit(1);
}
