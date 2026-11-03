#!/usr/bin/env node
/**
 * check_state_keys.js
 *
 * Prueft, dass jeder Schluessel, den AVE im localStorage ablegt, auch in
 * AVE_LOCAL_STORAGE_KEYS steht.
 *
 * Der Grund: clearAVEState() raeumt genau diese Liste auf. Sie wird beim
 * Zuruecksetzen der Einstellungen benutzt und beim Loeschen der Datenbank. Ein
 * neuer Schluessel, der in der Liste fehlt, bleibt also stehen - dann meint der
 * Scan nach dem Loeschen der Datenbank, er sei noch auf Seite 67.
 *
 * Usage: node scripts/check_state_keys.js
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const FILES = ['globals.js', 'VineExplorer.user.js'];
const GLOBALS_FILE = 'globals.js';

/**
 * Sammelt die Schluessel, die im Quelltext in den localStorage geschrieben werden.
 *
 * @param {string[]} files Die Dateien, die geprueft werden
 * @returns {Set<string>} Die Namen der Schluessel
 */
function findWrittenKeys(files) {
    const _keys = new Set();
    for (const _file of files) {
        const _source = fs.readFileSync(path.join(REPO_ROOT, _file), 'utf8');
        const _matches = _source.matchAll(/localStorage\.setItem\(\s*'([^']+)'/g);
        for (const _match of _matches) _keys.add(_match[1]);
    }
    return _keys;
}

/**
 * Liest die Liste der Schluessel, die clearAVEState() aufraeumt.
 *
 * @returns {Set<string>} Die Namen der Schluessel
 */
function findResetKeys() {
    const _source = fs.readFileSync(path.join(REPO_ROOT, GLOBALS_FILE), 'utf8');
    const _match = _source.match(/const AVE_LOCAL_STORAGE_KEYS = \[([\s\S]*?)\];/);
    if (!_match) {
        console.error(`Could not find AVE_LOCAL_STORAGE_KEYS in ${GLOBALS_FILE}`);
        process.exit(1);
    }
    const _keys = new Set();
    for (const _key of _match[1].matchAll(/'([^']+)'/g)) _keys.add(_key[1]);
    return _keys;
}

console.log('\n########## Die Schluessel im localStorage ##########');

const _written = findWrittenKeys(FILES);
const _reset = findResetKeys();

const _missing = [..._written].filter((_key) => !_reset.has(_key)).sort();
const _unused = [..._reset].filter((_key) => !_written.has(_key)).sort();

console.log(`  geschriebene Schluessel: ${_written.size}`);
console.log(`  aufgeraeumte Schluessel: ${_reset.size}`);

if (_unused.length > 0) {
    // Nur ein Hinweis: die Liste darf Schluessel enthalten, die an anderer
    // Stelle geschrieben werden (oder einmal geschrieben wurden).
    console.log(`  Hinweis: in der Liste, aber nirgends geschrieben: ${_unused.join(', ')}`);
}

if (_missing.length === 0) {
    console.log('\n>>> ERGEBNIS: jeder geschriebene Schluessel wird auch aufgeraeumt');
    process.exit(0);
}

console.log(`\n  FEHLER: diese Schluessel werden geschrieben, aber nicht aufgeraeumt:`);
for (const _key of _missing) console.log(`    ${_key}`);
console.log(`\n  Sie gehoeren in AVE_LOCAL_STORAGE_KEYS in ${GLOBALS_FILE}.`);
console.log('\n>>> ERGEBNIS: fehlende Schluessel in AVE_LOCAL_STORAGE_KEYS');
process.exit(1);
