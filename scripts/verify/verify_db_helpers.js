/**
 * verify_db_helpers.js
 *
 * Vergleicht die alte (git HEAD) und die neue Implementierung der
 * Datenbank-Helfer. Beide werden in einem vm-Kontext mit einer gemockten
 * Datenbank ausgefuehrt und die Folge der Datenbank- und localStorage-
 * Zugriffe wird Schritt fuer Schritt verglichen.
 *
 * Verglichen werden:
 *   markAllCurrentSiteProductsAsSeen()
 *   markAllCurrentDatabaseProductsAsSeen()
 *   cleanUpDatabase()
 *
 * Usage: node scripts/verify/verify_db_helpers.js
 */

const vm = require('vm');
const { prepare, finish } = require('./lib/verify_helpers');

const FIXED_NOW = 1800000000000;

const OLD_NAMES = ['markAllCurrentSiteProductsAsSeen', 'markAllCurrentDatabaseProductsAsSeen', 'cleanUpDatabase'];
// Die neue Implementierung hat die Logik fuer einen einzelnen Eintrag in eine
// eigene Funktion ausgelagert.
const NEW_NAMES = ['markAllCurrentSiteProductsAsSeen', 'markAllCurrentDatabaseProductsAsSeen', 'cleanUpDatabaseEntry', 'cleanUpDatabase'];

const { old: oldCode, new: newCode } = prepare('verify_db_helpers.js', OLD_NAMES, NEW_NAMES);

/**
 * Baut eine Sandbox mit einer gemockten Datenbank und fuehrt die Helfer aus.
 * @param {string} code Der Quelltext der Implementierung
 * @param {boolean} isNew true fuer die neue (Promise-basierte) Implementierung
 * @param {object} opts Szenario-Optionen
 * @param {boolean} opts.failWrite true, wenn das Schreiben fehlschlaegt
 * @param {boolean} opts.failRead true, wenn das Lesen fehlschlaegt
 */
async function runScenario(code, isNew, opts = {}) {
    const log = [];
    const store = new Map();

    const localStorage = {
        getItem(key) {
            log.push(`get ${key}`);
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            log.push(`set ${key}=${value}`);
            store.set(key, String(value));
        },
        removeItem(key) {
            log.push(`del ${key}`);
            store.delete(key);
        }
    };

    // Gemockte Datenbank. Die Eintraege werden als Kopien zurueckgegeben,
    // damit alte und neue Implementierung denselben Ausgangszustand sehen.
    const _entries = [
        {
            id: 'p1',
            data_recommendation_type: 'VENDOR_TARGETED',
            ts_firstSeen: FIXED_NOW / 1000 - 3600,
            ts_lastSeen: FIXED_NOW / 1000 - 3600,
            notSeenCounter: 0,
            isNew: 1,
            isFav: 0
        },
        {
            id: 'p2',
            data_recommendation_type: 'ORGANIC',
            ts_firstSeen: FIXED_NOW / 1000 - 3600,
            ts_lastSeen: FIXED_NOW / 1000 - 3600,
            notSeenCounter: 0,
            isNew: 1,
            isFav: 0
        },
        {
            id: 'p3',
            data_recommendation_type: 'ORGANIC',
            ts_firstSeen: FIXED_NOW / 1000 - 3600,
            ts_lastSeen: FIXED_NOW / 1000 - 3600,
            notSeenCounter: 0,
            isNew: 1,
            isFav: 0
        }
    ];

    const _clone = (e) => (e ? Object.assign({}, e) : e);

    const database = {
        getAll() {
            log.push('db.getAll');
            if (opts.failRead) return Promise.reject(new Error('read failed'));
            return Promise.resolve(_entries.map(_clone));
        },
        getById(id) {
            log.push(`db.getById ${id}`);
            const _found = _entries.find((e) => e.id === id);
            return Promise.resolve(_found ? _clone(_found) : undefined);
        },
        getNewEntries() {
            log.push('db.getNewEntries');
            return Promise.resolve(_entries.filter((e) => e.isNew).map(_clone));
        },
        update(entry) {
            log.push(`db.update ${entry.id}`);
            if (opts.failWrite) return Promise.reject(new Error('write failed'));
            const _idx = _entries.findIndex((e) => e.id === entry.id);
            if (_idx >= 0) _entries[_idx] = Object.assign({}, entry);
            return Promise.resolve(true);
        },
        removeID(id) {
            log.push(`db.removeID ${id}`);
            if (opts.failWrite) return Promise.reject(new Error('write failed'));
            const _idx = _entries.findIndex((e) => e.id === id);
            if (_idx >= 0) _entries.splice(_idx, 1);
            return Promise.resolve(true);
        }
    };

    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        localStorage,
        SETTINGS: {
            DebugLevel: 0,
            HoursBeforeCleanup: 24,
            EnableCleanupFavorites: false
        },
        Date: { now: () => FIXED_NOW },
        Math,
        JSON,
        parseInt,
        String,
        Number,
        Promise,
        SECONDS_PER_DAY: 86400,
        SECONDS_PER_WEEK: 604800,
        unixTimeStamp: () => Math.floor(FIXED_NOW / 1000),
        toUnixTimestamp: (ms) => Math.floor(ms / 1000),
        database,
        updateTileStyle: (prod) => log.push(`updateTileStyle ${prod.id}`),
        addDBCleaningSymbol: () => ({ remove: () => log.push('remove clean icon') })
    };
    sandbox.window = sandbox;
    sandbox.document = {
        getElementsByClassName: () => [
            { getAttribute: (name) => (name === 'data-recommendation-id' ? 'p1' : null) },
            { getAttribute: (name) => (name === 'data-recommendation-id' ? 'p2' : null) }
        ]
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx, { filename: 'helpers.js' });

    // Aufruf: Die alte Implementierung nutzt Callbacks, die neue Promises.
    if (isNew) {
        await sandbox.markAllCurrentSiteProductsAsSeen();
        await sandbox.markAllCurrentDatabaseProductsAsSeen();
        await sandbox.cleanUpDatabase();
    } else {
        await new Promise((resolve) => {
            sandbox.markAllCurrentSiteProductsAsSeen(() => {
                sandbox.markAllCurrentDatabaseProductsAsSeen(() => {
                    sandbox.cleanUpDatabase(() => resolve());
                });
            });
        });
    }

    // Die localStorage-Zugriffe des Cleanups bekommen einen festen Zeitstempel,
    // damit die Logs vergleichbar sind.
    return log.map((l) => l.replace(/=\d{10,}/g, '=TS'));
}

(async () => {
    const _scenarios = [
        { name: 'Normalfall', opts: {} },
        { name: 'Fehler beim Schreiben', opts: { failWrite: true } },
        { name: 'Fehler beim Lesen (Cleanup)', opts: { failRead: true } }
    ];

    let _allOk = true;
    let _totalDiffs = 0;

    for (const _scenario of _scenarios) {
        console.log(`\n########## Szenario: ${_scenario.name} ##########`);
        console.log('Fuehre die alte Implementierung aus ...');
        const oldLog = await runScenario(oldCode, false, _scenario.opts);
        console.log('Fuehre die neue Implementierung aus ...');
        const newLog = await runScenario(newCode, true, _scenario.opts);

        console.log('\n--- Alte Implementierung ---');
        oldLog.forEach((l, i) => console.log(`${String(i).padStart(3)}: ${l}`));

        console.log('\n--- Neue Implementierung ---');
        newLog.forEach((l, i) => console.log(`${String(i).padStart(3)}: ${l}`));

        console.log('\n--- Vergleich ---');
        const _max = Math.max(oldLog.length, newLog.length);
        let _diffs = 0;
        for (let i = 0; i < _max; i++) {
            const _o = oldLog[i] === undefined ? '(fehlt)' : oldLog[i];
            const _n = newLog[i] === undefined ? '(fehlt)' : newLog[i];
            if (_o !== _n) {
                _diffs++;
                console.log(`Schritt ${i}: alt "${_o}"  neu "${_n}"`);
            }
        }

        console.log('');
        if (_diffs === 0) {
            console.log(`>>> ${_scenario.name}: alt und neu sind verlaufsequivalent`);
        } else {
            console.log(`>>> ${_scenario.name}: ${_diffs} Abweichung(en)`);
            _allOk = false;
            _totalDiffs += _diffs;
        }
    }

    finish(_allOk, _totalDiffs);
})();
