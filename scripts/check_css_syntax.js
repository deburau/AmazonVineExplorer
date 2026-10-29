/**
 * Checks the CSS of the userscript for syntax errors.
 *
 * The CSS of the settings menu is a template literal. A comment with "//" is
 * not valid in CSS. The browser discards the whole rule of such a line, so the
 * styles of the element are lost without any error message. The comments in a
 * CSS block have to use the CSS syntax "/* ... *\/".
 *
 * The script finds all template literals that contain CSS and reports the
 * lines that use a "//" comment.
 *
 * @returns {boolean} true if no error was found
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Collects the template literals of a file that contain CSS.
 *
 * A template literal is treated as CSS if it contains a rule with a block,
 * like "selector {".
 *
 * @param {string} file The path of the file
 * @returns {Array<{line: number, css: string}>} The found CSS blocks
 */
function findCssBlocks(file) {
    const _source = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    const _blocks = [];

    // The template literals are found with a simple state machine, because a
    // regular expression cannot handle the escaped backticks.
    let _index = 0;
    while (_index < _source.length) {
        const _start = _source.indexOf('`', _index);
        if (_start === -1) break;
        const _end = _source.indexOf('`', _start + 1);
        if (_end === -1) break;
        const _content = _source.slice(_start + 1, _end);
        if (/[\w\]#.:]\s*\{/.test(_content)) {
            _blocks.push({
                line: _source.slice(0, _start).split('\n').length,
                css: _content
            });
        }
        _index = _end + 1;
    }

    return _blocks;
}

/**
 * Collects the lines of a CSS block that use a "//" comment.
 *
 * @param {string} css The content of the CSS block
 * @returns {Array<{line: number, text: string}>} The found lines
 */
function findLineComments(css) {
    const _found = [];
    const _lines = css.split('\n');
    for (let i = 0; i < _lines.length; i++) {
        const _text = _lines[i].trim();
        if (_text.startsWith('//')) {
            _found.push({ line: i + 1, text: _text });
        }
    }
    return _found;
}

const FILES = ['VineExplorer.user.js', 'globals.js', 'i18n.js', 'vine_fetch.js', 'class_db_handler.js', 'class_product.js'];

let _allOk = true;

console.log('\n########## Die Kommentare in den CSS-Bloecken ##########');

for (const _file of FILES) {
    const _blocks = findCssBlocks(_file);
    for (const _block of _blocks) {
        const _comments = findLineComments(_block.css);
        if (_comments.length === 0) continue;

        console.log(`\nFEHLER in ${_file}, CSS ab Zeile ${_block.line}:`);
        for (const _comment of _comments) {
            console.log(`  Zeile ${_block.line + _comment.line}: ${_comment.text}`);
        }
        console.log('  In CSS ist "//" kein Kommentar. Der Browser verwirft die ganze Regel.');
        console.log('  Bitte "/* ... */" verwenden.');
        _allOk = false;
    }
}

if (_allOk) {
    console.log('\n>>> ERGEBNIS: alle Kommentare in den CSS-Bloecken sind gueltig');
} else {
    console.log('\n>>> ERGEBNIS: FEHLER gefunden');
}

process.exit(_allOk ? 0 : 1);
