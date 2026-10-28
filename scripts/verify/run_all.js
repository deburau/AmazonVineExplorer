#!/usr/bin/env node
/**
 * run_all.js
 *
 * Fuehrt alle Verifikationsskripte aus und fasst das Ergebnis zusammen.
 *
 * Usage: node scripts/verify/run_all.js
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VERIFY_DIR = __dirname;
const SKIP = ['run_all.js', 'set_baseline.js', 'lib'];

const _scripts = fs
    .readdirSync(VERIFY_DIR)
    .filter((_f) => _f.endsWith('.js') && !SKIP.includes(_f))
    .sort();

console.log('Verifikationen ausfuehren');
console.log('='.repeat(70));

const _failed = [];

for (const _script of _scripts) {
    console.log(`\n>>> ${_script}`);
    console.log('-'.repeat(70));
    try {
        const _output = execFileSync('node', [path.join(VERIFY_DIR, _script)], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 32 * 1024 * 1024
        });
        console.log(_output.trim());
    } catch (error) {
        // Bei einem Fehler wird die Ausgabe trotzdem gezeigt.
        if (error.stdout) console.log(String(error.stdout).trim());
        if (error.stderr) console.log(String(error.stderr).trim());
        _failed.push(_script);
    }
}

console.log('');
console.log('='.repeat(70));
if (_failed.length === 0) {
    console.log(`>>> ERGEBNIS: alle ${_scripts.length} Verifikationen sind erfolgreich`);
    process.exit(0);
} else {
    console.log(`>>> ERGEBNIS: ${_failed.length} von ${_scripts.length} Verifikationen fehlgeschlagen: ${_failed.join(', ')}`);
    process.exit(1);
}
