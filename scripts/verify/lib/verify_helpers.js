/**
 * verify_helpers.js
 *
 * Gemeinsame Hilfsfunktionen fuer die Verifikationsskripte unter scripts/verify/.
 *
 * Die Skripte vergleichen die alte (versionierte) und die neue (aktuelle)
 * Implementierung einer Funktion. Die alte Version wird aus der Git-Historie
 * gelesen, damit sie nicht doppelt im Repository liegen muss.
 *
 * Die Baseline (der Git-Stand, gegen den verglichen wird) steht in
 * scripts/verify/baselines.json und wird mit
 *
 *     npm run verify:baseline
 *
 * auf den aktuellen HEAD gesetzt. Das sollte immer unmittelbar vor einem
 * Refactoring geschehen, damit der Vergleich die Aenderung prueft.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BASELINE_FILE = path.join(REPO_ROOT, 'scripts', 'verify', 'baselines.json');
const MAIN_FILE = 'VineExplorer.user.js';

/** Liest die Baseline-Dateien. */
function readBaselines() {
    try {
        return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    } catch (_error) {
        console.error(`Could not read ${BASELINE_FILE}: ${_error.message}`);
        return {};
    }
}

/** Schreibt die Baseline-Dateien. */
function writeBaselines(baselines) {
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 2) + '\n');
}

/** Liefert den aktuellen Git-Stand (SHA). */
function currentHead() {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

/**
 * Liefert den Quelltext der Main-Datei aus einem Git-Stand.
 * @param {string} ref Der Git-Stand (SHA, Tag oder Branch)
 * @returns {string} Der Quelltext
 */
function sourceAt(ref) {
    return execFileSync('git', ['show', `${ref}:${MAIN_FILE}`], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/**
 * Liefert den Quelltext der Main-Datei aus der Baseline eines Skripts.
 * @param {string} scriptName Der Name des Skripts
 * @returns {string} Der Quelltext
 */
function baselineSource(scriptName) {
    const _baselines = readBaselines();
    const _ref = _baselines[scriptName];
    if (!_ref) {
        throw new Error(
            `No baseline for ${scriptName} in scripts/verify/baselines.json.\n` + `Run "npm run verify:baseline" before a refactoring.`
        );
    }
    return sourceAt(_ref);
}

/** Liefert den Quelltext der aktuellen Main-Datei. */
function currentSource() {
    return fs.readFileSync(path.join(REPO_ROOT, MAIN_FILE), 'utf8');
}

/**
 * Zieht den Quelltext einer Funktion aus dem Quellcode. Die Parameterliste
 * kann verschachtelte Klammern enthalten, deshalb wird sie ausgezaehlt.
 *
 * @param {string} src Der Quellcode
 * @param {string} name Der Name der Funktion
 * @returns {string} Der Quelltext der Funktion
 */
function extractBody(src, name) {
    const _m = src.match(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
    if (!_m) throw new Error(`Function not found: ${name}`);
    const _start = _m.index;

    let _i = _start + _m[0].length - 1;
    let _parenDepth = 0;
    for (; _i < src.length; _i++) {
        if (src[_i] === '(') _parenDepth++;
        else if (src[_i] === ')') {
            _parenDepth--;
            if (_parenDepth === 0) break;
        }
    }

    const _bodyStart = src.indexOf('{', _i);
    if (_bodyStart < 0) throw new Error(`No body found: ${name}`);

    let _depth = 0;
    for (let _j = _bodyStart; _j < src.length; _j++) {
        if (src[_j] === '{') _depth++;
        else if (src[_j] === '}') {
            _depth--;
            if (_depth === 0) return src.slice(_start, _j + 1);
        }
    }
    throw new Error(`Unbalanced brackets: ${name}`);
}

/**
 * Haelt die Namen der Funktionen, die aus dem alten und dem neuen Quellcode
 * gezogen werden sollen. Funktionen, die es nur in einer Version gibt, werden
 * uebersprungen.
 *
 * @param {string[]} oldNames Die Namen in der alten Version
 * @param {string[]} newNames Die Namen in der neuen Version
 * @returns {{old: string, new: string}} Die beiden Quelltexte
 */
function buildCode(oldNames, newNames) {
    const _old = oldNames.map((_n) => extractBody(baselineSource_cached.old, _n)).join('\n\n');
    const _new = newNames
        .map((_n) => {
            try {
                return extractBody(baselineSource_cached.new, _n);
            } catch (_error) {
                return `/* ${_n} not present */`;
            }
        })
        .join('\n\n');
    return { old: _old, new: _new };
}

// Die Quelltexte werden einmal geladen und dann wiederverwendet.
const baselineSource_cached = { old: '', new: '' };

/**
 * Laedt die Quelltexte und baut die beiden Code-Fragmente.
 *
 * @param {string} scriptName Der Name des Skripts (fuer die Baseline)
 * @param {string[]} oldNames Die Namen in der alten Version
 * @param {string[]} newNames Die Namen in der neuen Version
 * @returns {{old: string, new: string}} Die beiden Quelltexte
 */
function prepare(scriptName, oldNames, newNames) {
    baselineSource_cached.old = baselineSource(scriptName);
    baselineSource_cached.new = currentSource();
    return buildCode(oldNames, newNames);
}

/**
 * Vergleicht zwei Protokolle und gibt die Abweichungen aus.
 *
 * @param {string[]} oldLog Das alte Protokoll
 * @param {string[]} newLog Das neue Protokoll
 * @param {string} label Die Bezeichnung fuer die Ausgabe
 * @returns {number} Die Anzahl der Abweichungen
 */
function compare(oldLog, newLog, label) {
    const _max = Math.max(oldLog.length, newLog.length);
    let _diffs = 0;
    for (let _i = 0; _i < _max; _i++) {
        const _o = oldLog[_i] === undefined ? '(missing)' : oldLog[_i];
        const _n = newLog[_i] === undefined ? '(missing)' : newLog[_i];
        if (_o !== _n) {
            _diffs++;
            console.log(`  step ${_i}: old "${_o}"  new "${_n}"`);
        }
    }
    if (_diffs === 0) {
        console.log(`  ${label}: identical (${oldLog.length} steps)`);
    }
    return _diffs;
}

/** Gibt das Ergebnis aus und beendet das Skript mit dem passenden Code. */
function finish(allOk, totalDiffs) {
    console.log('');
    if (allOk) {
        console.log(`>>> RESULT: all scenarios are identical`);
        process.exit(0);
    }
    console.log(`>>> RESULT: ${totalDiffs} difference(s)`);
    process.exit(1);
}

module.exports = {
    REPO_ROOT,
    readBaselines,
    writeBaselines,
    currentHead,
    sourceAt,
    baselineSource,
    currentSource,
    extractBody,
    prepare,
    compare,
    finish
};
