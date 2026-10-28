#!/usr/bin/env node
/**
 * set_baseline.js
 *
 * Setzt die Baselines der Verifikationsskripte auf den aktuellen Git-Stand.
 *
 * Das sollte unmittelbar vor einem Refactoring geschehen. Die Skripte
 * vergleichen danach den Stand der Baseline mit dem aktuellen Arbeitsstand
 * und weisen Abweichungen aus.
 *
 * Usage: node scripts/verify/set_baseline.js
 */

const { readBaselines, writeBaselines, currentHead, REPO_ROOT } = require('./lib/verify_helpers');

const _head = currentHead();
const _baselines = readBaselines();

// Die Baseline wird nur gesetzt, wenn sie noch auf "HEAD" steht oder der
// Nutzer es ausdruecklich fordert. Sonst wuerde ein zweiter Lauf die Baseline
// des laufenden Refactorings unbrauchbar machen.
const _force = process.argv.includes('--force');
const _changed = [];

for (const _script of Object.keys(_baselines)) {
    if (_baselines[_script] === 'HEAD' || _force) {
        _baselines[_script] = _head;
        _changed.push(_script);
    }
}

writeBaselines(_baselines);

console.log(`Baseline gesetzt auf ${_head}`);
if (_changed.length) {
    console.log('  aktualisiert: ' + _changed.join(', '));
} else {
    console.log('  (unveraendert, mit --force wird sie ueberschrieben)');
}
console.log(`Datei: ${REPO_ROOT}/scripts/verify/baselines.json`);
