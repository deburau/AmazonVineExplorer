/* exported DB_HANDLER, migrateProductToVersion5 */
console.log('loaded db_handler.js');
class DB_HANDLER {
    #version;
    #dbName;
    #storeName;
    #db;
    #eventDelayTimeout;
    // The write operations of the running window of the change event. The numbers are
    // handed over with the event, so that a listener can log what happened (see
    // fireDataChangedEvent()).
    #pendingWrites = 0;
    #pendingNewProducts = 0;

    /**
     * Db Handler to easy use of IndexedDB Object Store Databases
     * @constructor
     * @param {string} dbName Name your Database
     * @param {string} [storeName] Object Store Name
     * @param {number} [version] Object Store Name
     * @param {function} [cb] Callback function executes when database initialisation is done
     * @return {DB_HANDLER} DBHANDLER Object
     */

    constructor(dbName, storeName, version) {
        if (!dbName)
            throw new Error(`CLASS DB_HANDLER needs a name for the database to init: example:  const db = new DB_HANDLER('AnyName')`);
        this.#dbName = dbName;
        this.#version = version || 1;
        this.#storeName = storeName || dbName + '_ObjectStore';
        // NOTE: Do NOT call async code here!
    }

    /**
     * Creates the handler and opens the database.
     *
     * The database cannot be opened in the constructor, because the constructor
     * must not run async code.
     *
     * @param {string} dbName Name of the database
     * @param {string} [storeName] Object store name
     * @param {number} [version] Version of the database
     * @returns {Promise<DB_HANDLER>} The initialised handler
     */
    static async init(dbName, storeName, version) {
        const instance = new DB_HANDLER(dbName, storeName, version);
        await instance.#init();
        return instance;
    }

    /**
     * Class Internal DB Init Function
     * @async
     * @returns {Promise<string>}
     */
    async #init() {
        return new Promise((resolve, reject) => {
            const _request = indexedDB.open(this.#dbName, this.#version);
            const _storeName = this.#storeName; // private class variable is not accessable inside _request functions

            console.log('IndexedDB init()');

            _request.onerror = (event) => {
                reject(event);
                console.error(event);
                throw new Error('Indexed DB has an Error');
            };

            _request.onblocked = (event) => {
                reject(event);
                console.warn(event);
                throw new Error('IndexedDB is blocked');
            };

            _request.onsuccess = (event) => {
                this.#db = event.target.result;
                resolve(event.target.result);
            };

            // Schema migration and index maintenance happen here.
            _request.onupgradeneeded = (event) => {
                console.log(`DB_HANDLER: Database has to be created or Updated`);
                console.log(JSON.stringify(event, null, 4));
                console.log(event);

                const _req = event.target;
                const _db = _req.result;
                let _store;

                if (!_db.objectStoreNames.contains(_storeName)) {
                    if (SETTINGS.DebugLevel > 10) console.log('Database needs to be created...');
                    _store = _db.createObjectStore(_storeName, { keyPath: 'id' });
                } else {
                    // Get a reference to the implicit transaction for this request
                    // @type IDBTransaction
                    const _transaction = _req.transaction;

                    // Now, get a reference to the existing object store
                    // @type IDBObjectStore
                    _store = _transaction.objectStore(_storeName);
                }

                console.log(`Updating Database from Version ${event.oldVersion} to ${event.newVersion}`);

                if (!_store.indexNames.contains('isNew')) {
                    _store.createIndex('isNew', 'isNew', { unique: false });
                }

                if (!_store.indexNames.contains('isFav')) {
                    _store.createIndex('isFav', 'isFav', { unique: false });
                }

                // The products are migrated to the version 5 of the database. They
                // get the list with the prices of the product and of its
                // variations.
                const _needsMigration = event.oldVersion < 5;

                // The index of the ASIN can only be unique, if there are no
                // duplicated ASINs in the database.
                const _needsAsinIndex = !_store.indexNames.contains('data_asin');

                if (_needsAsinIndex && event.oldVersion === 0) {
                    // A new database has no duplicates.
                    _store.createIndex('data_asin', 'data_asin', { unique: true });
                } else if (_needsMigration || _needsAsinIndex) {
                    // The migration and the check for duplicated ASINs both need a
                    // cursor over the products, so they are done in one run.
                    this.#updateProducts(_store, _needsMigration, _needsAsinIndex);
                }
            };
        });
    }

    /**
     * Updates the products of the object store, while the database is upgraded.
     *
     * The products are migrated to the current version of the database. The
     * ASINs are checked for duplicates, so that the index of the ASIN can be
     * created as unique.
     *
     * NOTE: The cursor has to run inside the transaction of the upgrade,
     * otherwise the changes are not written to the database. The index can only
     * be created, while this transaction is active.
     *
     * @param {IDBObjectStore} store The object store of the database
     * @param {boolean} migrate true, if the products have to be migrated
     * @param {boolean} checkDuplicates true, if the ASINs have to be checked
     */
    #updateProducts(store, migrate, checkDuplicates) {
        const _asins = [];
        const _request = store.openCursor();

        _request.onsuccess = (event) => {
            const _cursor = event.target.result;
            if (_cursor) {
                if (checkDuplicates && _cursor.value && _cursor.value.data_asin) _asins.push(_cursor.value.data_asin);
                if (migrate) _cursor.update(migrateProductToVersion5(_cursor.value));
                _cursor.continue();
            } else if (checkDuplicates) {
                const _uniqueAsins = new Set(_asins);
                if (_asins.length === _uniqueAsins.size) {
                    // No duplicates found, the index can be marked as unique
                    store.createIndex('data_asin', 'data_asin', { unique: true });
                } else {
                    console.warn('Duplikate in "data_asin" gefunden. Bereinigen oder löschen Sie die Datenbank');
                }
            }
        };

        _request.onerror = (event) => {
            console.error(`DB_HANDLER.#updateProducts: ${event.target.error.name}`);
        };
    }

    /**
     * Fires the Event ave-database-changed when any writeaccess has happend
     * If a new product was added, the Event ave-new-product-added is fired as well.
     * The two events are debounced together, so that a burst of write operations
     * results in only one event.
     *
     * The change event carries the number of the write operations of the window and
     * the number of the new products in it, so that a listener can log what happened.
     *
     * @param {boolean} [isNewProduct] true if the record was added and not updated
     */
    // Debounced change event to avoid flooding listeners on batch writes.
    #fireDataChangedEvent(isNewProduct = false) {
        this.#pendingWrites++;
        if (isNewProduct) this.#pendingNewProducts++;
        if (this.#eventDelayTimeout) clearTimeout(this.#eventDelayTimeout);
        this.#eventDelayTimeout = setTimeout(() => {
            // NOTE: The numbers are taken and reset before the events are fired, so that
            // the write operations of a listener belong to the next window.
            const _detail = { writes: this.#pendingWrites, newProducts: this.#pendingNewProducts };
            this.#pendingWrites = 0;
            this.#pendingNewProducts = 0;
            this.#eventDelayTimeout = null;

            // NOTE: The event for a new product comes first, so that the listener of the
            // change event can already know that a new product was added.
            if (_detail.newProducts > 0) ave_eventhandler.emit('ave-new-product-added');
            ave_eventhandler.emit('ave-database-changed', _detail);
        }, 250);
    }

    /**
     * Get Object Store Object
     * @param {boolean} [rw] Set to true if u want to create a writeable access
     * @return {object} Object Store Object
     */
    #getStore(rw = false) {
        if (!this.#db) throw new Error('DB_HANDLER.#getStore: Database Object is not defined');
        const _transaction = this.#db.transaction([this.#storeName], rw ? 'readwrite' : 'readonly');
        const _store = _transaction.objectStore(this.#storeName);
        return _store;
    }

    /**
     * Add Object to Database
     * @param {object} obj The object to add
     * @returns {Promise<void>}
     */
    add(obj) {
        return new Promise((resolve, reject) => {
            if (!obj || typeof obj != 'object') {
                reject('DB_HANDLER.add(): obj is not defined or is not type of object');
                return;
            }

            const _request = this.#getStore(true).add(obj);

            _request.onerror = (event) => {
                if (`${event.target.error}`.includes('data_asin')) {
                    console.error('Tryed to ADD New Product with existing ASIN ???', obj);
                }

                reject(`DB_HANDLER.add(): ${event.target.error}`);
            };

            _request.onsuccess = (event) => {
                resolve();
                this.#fireDataChangedEvent(true);
            };
        });
    }

    /**
     * Get Object by ID
     * @param {string} id Object ID
     * @returns {Promise<Product>}
     */
    get(id) {
        return new Promise((resolve, reject) => {
            if (!id || typeof id != 'string') {
                reject('DB_HANDLER.get(): id is not defined or is not typeof string');
                return;
            }

            const _request = this.#getStore().get(id);
            _request.onerror = (event) => {
                reject(`DB_HANDLER.get(): ${event.target.error}`);
            };
            _request.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    }

    /**
     * Get Object by ID
     * If the entry is not found by the given ID, the ID is deconstructed to get the ASIN.
     * If an entry exists with this ASIN, it is returned
     * @param {string} id Object ID
     * @returns {Promise<Product>}
     */
    getById(id) {
        return new Promise((_resolve, _reject) => {
            this.get(id)
                .then((_prod) => {
                    if (_prod) {
                        if (SETTINGS.DebugLevel > 10) console.info(`got object with ID "${id}": "${_prod}"`);
                        _resolve(_prod);
                    } else {
                        const _data_asin = id.split('#')[1];
                        if (SETTINGS.DebugLevel > 1)
                            console.debug(`object with ID "${id}" not found, trying to get it with ASIN "${_data_asin}"`);
                        this.getByASIN(_data_asin)
                            .then((_prod) => {
                                if (_prod) {
                                    if (SETTINGS.DebugLevel > 1)
                                        console.debug(`got object with ID "${id}" and ASIN "${_data_asin}": "${_prod}"`);
                                }

                                _resolve(_prod);
                            })
                            .catch((_error) => {
                                console.error(`failed to get object with ID "${id}" and ASIN "${_data_asin}": "${_error}"`);
                                _reject(_error);
                            });
                    }
                })
                .catch((_error) => {
                    console.error(`failed to get object with ID "${id}": "${_error}"`);
                    _reject(_error);
                });
        });
    }

    /**
     * Get Object by ASIN
     * @param {string} asin ASIN
     * @returns {Promise<Product>}
     */
    getByASIN(asin) {
        return new Promise((resolve, reject) => {
            if (!asin || typeof asin != 'string') {
                reject('DB_HANDLER.getByASIN(): asin is not defined or is not typeof string');
                return;
            }

            const _index = this.#getStore().index('data_asin');
            const _request = _index.get(asin);
            _request.onerror = (event) => {
                reject(`DB_HANDLER.getByASIN(): ${event.target.error.name}`);
            };
            _request.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    }

    /**
     * Update Object
     * @param {object} obj Object to update
     * @returns {Promise<void>}
     */
    update(obj) {
        return new Promise((resolve, reject) => {
            if (SETTINGS.DebugLevel > 1) console.log('Called DB_HANDLER:update()');
            if (!obj || typeof obj != 'object') {
                reject('DB_HANDLER.update(): obj is not defined or is not type of object');
                return;
            }

            const _request = this.#getStore(true).put(obj);

            _request.onerror = (event) => {
                reject(event.target.error);
            };

            _request.onsuccess = (event) => {
                this.#fireDataChangedEvent();
                resolve();
            };
        });
    }

    /**
     * Query Database for Searchstring
     * @param {(string|array)} query String to find
     * @returns {Promise<Product[]>}
     */
    query(query) {
        return new Promise((resolve, reject) => {
            if (!query || (typeof query != 'string' && !Array.isArray(query))) {
                reject('DB_HANDLER.query(): query is not defined or is not typeof string or array');
                return;
            }

            const _request = this.#getStore().openCursor();
            const _result = [];

            // Use an array of words for the search
            const _keys = typeof query == 'string' ? [query] : query;
            for (let _key of _keys) {
                _key = _key.toLowerCase();
            }

            _request.onsuccess = (event) => {
                const _cursor = event.target.result;
                if (_cursor) {
                    const _descriptionFull = (_cursor.value.description_full || '').toLowerCase();

                    if (_keys.every((_key) => _descriptionFull.includes(_key))) {
                        _result.push(_cursor.value);
                    }

                    _cursor.continue();
                } else {
                    // No more entries
                    resolve(_result);
                }
            };

            _request.onerror = (event) => {
                reject('Error querying records:', event.target.error.name);
            };
        });
    }

    /**
     * Get all new "unseen" products from Database
     * @returns {Promise<Product[]>}
     */
    getNewEntries() {
        return new Promise((resolve, reject) => {
            const _result = [];
            const _onlyTrue = IDBKeyRange.only(1);
            const _request = this.#getStore().index('isNew').openCursor(_onlyTrue);

            _request.onsuccess = (event) => {
                const _cursor = event.target.result;

                if (_cursor) {
                    _result.push(_cursor.value);
                    _cursor.continue();
                } else {
                    // No more entries
                    resolve(_result);
                }
            };
            _request.onerror = (event) => {
                reject(`DB_HANDLER.getNewEntries(): ${event.target.error.name}`);
            };
        });
    }

    /**
     * Get all Favorite products from Database
     * @returns {Promise<Product[]>}
     */
    getFavEntries() {
        return new Promise((resolve, reject) => {
            const _result = [];
            const _onlyTrue = IDBKeyRange.only(1);
            const _request = this.#getStore().index('isFav').openCursor(_onlyTrue);

            _request.onsuccess = (event) => {
                const _cursor = event.target.result;

                if (_cursor) {
                    _result.push(_cursor.value);
                    _cursor.continue();
                } else {
                    // No more entries
                    resolve(_result);
                }
            };
            _request.onerror = (event) => {
                reject(`DB_HANDLER.getFavEntries(): ${event.target.error.name}`);
            };
        });
    }

    /**
     * Get all the Objects stored in our DB
     * @returns {Promise<Product[]>}
     */
    getAll() {
        return new Promise((resolve, reject) => {
            const _request = this.#getStore().getAll();
            _request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            _request.onerror = (event) => {
                reject(`DB_HANDLER.getAll(): ${event.target.error.name}`);
            };
        });
    }

    /**
     * Removes Object with given ID from Database
     * @param {string} id Object ID
     * @returns {Promise<void>}
     */
    removeID(id) {
        return new Promise((resolve, reject) => {
            if (!id || typeof id != 'string') {
                reject('DB_HANDLER.removeID(): id is not defined or is not typeof string');
                return;
            }

            const _request = this.#getStore(true).delete(id);
            _request.onsuccess = (event) => {
                resolve();
                this.#fireDataChangedEvent();
            };
            _request.onerror = (event) => {
                reject(`DB_HANDLER.removeID(): ${event.target.error.name}`);
            };
        });
    }

    /**
     * Imports the database, i.e. delete all existing entries and add new ones
     * @returns {Promise<void>}
     */
    import(datas) {
        return new Promise((resolve, reject) => {
            if (datas === null) {
                reject('DB_HANDLER.import(): datas is null');
                return;
            }

            if (typeof datas[Symbol.iterator] !== 'function') {
                reject('DB_HANDLER.import(): datas is not iterable');
                return;
            }

            const _store = this.#getStore(true);
            const _clearRequest = _store.clear();
            _clearRequest.onsuccess = () => {
                let _addRequest;
                for (const data of datas) {
                    // NOTE: The products of an old backup do not have the list of
                    // the prices, so they are migrated too.
                    _addRequest = _store.add(migrateProductToVersion5(data));
                    _addRequest.onerror = (event) => {
                        reject(`DB_HANDLER.import().add(): ${event.target.error.name}`);
                    };
                }
                if (_addRequest) {
                    _addRequest.onsuccess = () => {
                        // NOTE: The listeners of the database have to be informed about the
                        // new data, otherwise the badge and the title stay outdated.
                        this.#fireDataChangedEvent(true);
                        resolve();
                    };
                } else {
                    this.#fireDataChangedEvent(true);
                    resolve();
                }
            };

            _clearRequest.onerror = (event) => {
                reject(`DB_HANDLER.import().clear(): ${event.target.error.name}`);
            };
        });
    }

    /**
     * Closes the connection to the database.
     *
     * NOTE: An open connection blocks the delete of the database. The connection
     * has to be closed before deleteDatabase() is called, otherwise the delete
     * request waits for the connection and never finishes.
     */
    closeDatabase() {
        if (!this.#db) return;
        this.#db.close();
        this.#db = null;
        console.log('DB_HANDLER: the connection to the database was closed');
    }

    /**
     * Deletes the entire database.
     * @returns {Promise<void>}
     */
    deleteDatabase() {
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(this.#dbName);

            deleteRequest.onerror = (event) => {
                reject(event);
                console.error(event);
                throw new Error('Error deleting the database');
            };

            deleteRequest.onsuccess = () => {
                this.#db = null; // Reset the reference to the database
                resolve();
            };
        });
    }
}

/**
 * Migrates a product of the database to the version 5.
 *
 * The version 5 of the database has the list with the prices of a product
 * (data_estimated_tax_prices). The price of the product is in
 * data_estimated_tax_prize, the prices of the variations are in the variations
 * of the product. Both are taken over, so that the prices do not have to be
 * requested from Amazon again after the migration.
 *
 * @param {object} prod The product from the database
 * @returns {object} The product with the list of the prices
 */
function migrateProductToVersion5(prod) {
    if (!prod || typeof prod != 'object') return prod;
    // The product was already migrated.
    if (Array.isArray(prod.data_estimated_tax_prices)) return prod;

    const _prices = [];

    // The price of the product. It is the only price that is known for the
    // products without variations.
    if (Number.isFinite(prod.data_estimated_tax_prize) && !_prices.includes(prod.data_estimated_tax_prize)) {
        _prices.push(prod.data_estimated_tax_prize);
    }

    // The prices of the variations.
    const _variations = Array.isArray(prod.data_childs) ? prod.data_childs : [];
    for (const _variation of _variations) {
        if (_variation && Number.isFinite(_variation.taxValue) && !_prices.includes(_variation.taxValue)) {
            _prices.push(_variation.taxValue);
        }
    }

    prod.data_estimated_tax_prices = _prices;
    return prod;
}
