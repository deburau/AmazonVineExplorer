// ==UserScript==
// @name         Amazon Vine Explorer
// @namespace    https://github.com/deburau/AmazonVineExplorer
// @version      0.12.1.47
// @updateURL    https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/VineExplorer.user.js
// @downloadURL  https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/VineExplorer.user.js
// @supportURL   https://github.com/deburau/AmazonVineExplorer/issues
// @description  Better View, Search and Explore for Amazon Vine Products - Vine Voices Edition
// @author       MarkusSR1984, Christof121, Olum-hack, Deburau, adripo
// @match        https://www.amazon.com/*
// @match        https://www.amazon.ca/*
// @match        https://www.amazon.co.uk/*
// @match        https://www.amazon.de/*
// @match        https://www.amazon.fr/*
// @match        https://www.amazon.it/*
// @match        https://www.amazon.es/*
// @match        https://www.amazon.co.jp/*
// @license      MIT
// @icon64       https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/vine_logo.png
// @run-at       document-start
// @noframes     The script must not run in frames (e.g. in the hidden iframe of the background scan)
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @require      globals.js
// @require      i18n.js
// @require      class_db_handler.js
// @require      class_product.js
// @require      vine_fetch.js
// @require      https://raw.githubusercontent.com/eligrey/FileSaver.js/v2.0.4/src/FileSaver.js
// ==/UserScript==

'use strict';

/* exported PAGETYPE, addAVESettingsMenu, addAveSettingsTab, addDBCleaningSymbol, addDBLoadingSymbol,
   addLeftSideButtons, addLoadingSymbol, addStyleToTile, addTileEventhandlers,
   appendInfiniteScrollTiles, backGroundTileScanner, btnEventhandlerClick, cleanUpDatabase,
   colorToHex, completeDelayedInit, componentToHex, createButton, createFavStarElement,
   createFirstSeenElement, createInfiniteScrollSite, createNavButton, createNewSite,
   createProductSite, createSettingsKeywordsTableElement, createSettingsMenuElement,
   createShareElement, createTaxInfoElement, createTileFromProduct, createTimeSeenElement,
   currentMainPage, database, desktopNotifikation, detectCurrentPageType, exportDatabase,
   favStarEventhandlerClick, fixProductImageUrl, getContrastColor, getPageinationData,
   getTilesFromURL, getUrlParameter, gotifyNotification, handleAutoScan, handleInfiniteScroll,
   importDatabase, init, initBackgroundScan, initTileEventHandlers, injectDarkMode,
   markAllCurrentDatabaseProductsAsSeen, markAllCurrentSiteProductsAsSeen, parseTileData,
   populateSettingsContainer, readFile, reloadPageWithSubpageTarget, requestProductDetails,
   rgbToHex, rgbaToHex, shareEventHandlerClick, showAutoScanScreen, showBackgroundScanScreen,
   sort_by_key, startAutoScan, stickElementToTopScrollEVhandler, timeAgo, translate,
   updateAutoScanScreenText, updateBackgroundScanScreenText, updateFavoritesBtn,
   updateNewProductsBtn, updateTileStyle, stopBackgroundScan, aveFixRelativeVineLinks,
   aveResolveUrl, aveUrlWithPage, notifyAboutUnseenItems, notifyAboutNewProducts,
   searchKeywordsInProducts, checkKeywordsForProduct, stringToRegex,
   notifyAboutProductDrop, shouldStopFastScan, stopFastScan, handleFastScanFinished,
   initTileParsing, initNavigationButtons, initSearchBar, initPagination */
console.log(`Init Vine Voices Explorer ${AVE_VERSION}`);

/**
 * On witch page are we atm ? PAGETYPE
 * @type {PAGETYPE}
 */
let currentMainPage;

// Translation wrapper with a fallback string for early-load timing.
const translate = (category, key, fallback, ...args) => (typeof t === 'function' ? t(category, key, ...args) : fallback);

loadSettings();
fastStyleChanges();
aveFixRelativeVineLinks();

let searchInputTimeout;
let backGroundScanTimeout;

let BackGroundScanIsRunning = false;

/**
 * The pagination data of the last page that was scanned in the background.
 * The iframe with the scanned document is removed after the scan, so the data
 * has to be cached to be able to read it later.
 * @type {object|undefined}
 */
let lastScanPaginationData = undefined;

// Make some things accessable from console.
// NOTE: The object of globals.js is not replaced, otherwise the helpers of globals.js
// (e.g. addBranding) would be lost.
unsafeWindow.ave = Object.assign(unsafeWindow.ave || {}, {
    classes: [DB_HANDLER],
    config: SETTINGS,
    event: ave_eventhandler
});

let database;
// Async bootstrap to avoid blocking document-start and to keep DB init isolated.
(async () => {
    try {
        database = await DB_HANDLER.init(DATABASE_NAME, DATABASE_OBJECT_STORE_NAME, DATABASE_VERSION);

        /* Prevent duplicate initialization when multiple DOM targets appear.
           NOTE: The check `if (_execLock) return; _execLock = true;` is atomic enough
           because JS in the browser is single-threaded. Both observers run sequentially
           in the event loop, so a true race condition cannot occur in practice. */
        let _execLock = false;
        console.log('Lets Check where we are....');
        if (SITE_IS_VINE) {
            console.log('We are on Amazon Vine'); // We are on the amazon vine site
            if (SETTINGS && SETTINGS.DarkMode) {
                waitForHtmlElement('body', () => {
                    injectDarkMode();
                });
            }

            const urlParams = new URLSearchParams(window.location.search);
            const aveData = urlParams.get('vine-data');
            const aveShareData = localStorage.getItem('ave-share-details');
            if (aveData || aveShareData) {
                let _data;
                try {
                    _data = aveShareData ? JSON.parse(aveShareData) : aveData ? JSON.parse(aveData) : null;
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    return;
                }
                waitForHtmlElement('body', () => {
                    const aveShareElementTmp = document.createElement('div');
                    aveShareElementTmp.style.display = 'none';
                    aveShareElementTmp.innerHTML = `
                <span class="a-button a-button-primary vvp-details-btn" id="a-autoid-0">
                <span class="a-button-inner">
                <input data-asin="${_data.asin}" data-is-parent-asin="${_data.isParentAsin}" data-is-pre-release="${_data.data_is_pre_release ?? false}" data-recommendation-id="${_data.recommendationId}" data-recommendation-type="VENDOR_TARGETED" class="a-butt[...]
<span class="a-button-text" aria-hidden="true" id="a-autoid-0-announce">${translate('buttons', 'moreDetails', 'Weitere Details')}
                </span>
                </span>
                </span>
                `;
                    document.body.appendChild(aveShareElementTmp);
                    setTimeout(() => {
                        aveShareElementTmp.querySelector('input').click();
                        setTimeout(() => {
                            localStorage.removeItem('ave-share-details');
                        }, 200);
                    }, 500);
                });
            }
            addAveSettingsTab();
            addAVESettingsMenu();
            // Wait until tiles exist before initializing UI and page state.
            waitForHtmlElement('.vvp-details-btn', (elem) => {
                if (!elem) return;

                if (_execLock) return;

                _execLock = true;
                addBranding();
                detectCurrentPageType();
                let _tileCount = 0;
                const _initialWaitForAllTiles = setInterval(() => {
                    const _count = document.getElementsByClassName('vvp-details-btn').length;
                    if (_count > _tileCount) {
                        _tileCount = _count;
                    } else {
                        clearInterval(_initialWaitForAllTiles);
                        init(true);
                    }
                }, 100);
            });
            // Alternate init path for empty pages (no offers).
            // This is the alternative for a page without products. On a page with products
            // this element never appears, so the timeout warning is not wanted here.
            waitForHtmlElement(
                '.vvp-no-offers-msg',
                (elem) => {
                    // Empty Page ?!?!
                    if (!elem) return;

                    if (_execLock) return;

                    _execLock = true;
                    if (SETTINGS.DarkMode) {
                        waitForHtmlElement('body', () => {
                            injectDarkMode();
                        });
                    }
                    addBranding();
                    init(false);
                },
                document,
                10000,
                false
            );
        } else if (SITE_IS_SHOPPING) {
            console.log('We are on Amazon Shopping');
            _execLock = true;
            waitForHtmlElement('body', () => {
                addBranding();
            });
            useEnrollmentData();

            function useEnrollmentData() {
                const urlParams = new URLSearchParams(window.location.search);
                const aveData = urlParams.get('vine-data');
                if (aveData) {
                    let enrollmentData;
                    try {
                        enrollmentData = JSON.parse(decodeURIComponent(aveData));
                    } catch (error) {
                        console.error('Error parsing enrollment data:', error);
                        return;
                    }
                    localStorage.setItem('ave-share-details', JSON.stringify(enrollmentData));
                    window.open(`${window.location.origin}/vine/vine-items`, '_blank');
                }
            }
        }
    } catch (err) {
        console.error(`Something was going wrong while init database :'(`, err);
        return;
    }
})();

unsafeWindow.ave.database = database;

let oldCountOfNewItems = 0;

let showDbUpdateLogoTimeout = null;
let showDbUpdateLogoIcon = null;

// Is set to true if a new product was added to the database. The search for the
// keywords is expensive, so it is only done if a new product was really added and not
// after every update of an existing product.
let newProductWasAdded = false;

ave_eventhandler.on('ave-new-product-added', () => {
    if (SETTINGS.DebugLevel > 1) console.info('EVENT - A new product was added to the database');
    newProductWasAdded = true;
});

ave_eventhandler.on('ave-database-changed', () => {
    if (SETTINGS.DebugLevel > 1) console.info('EVENT - Database has new Data for us! we should look what has changed');
    updateNewProductsBtn();
    updateFavoritesBtn();

    if (showDbUpdateLogoTimeout) clearTimeout(showDbUpdateLogoTimeout);
    if (!showDbUpdateLogoIcon) showDbUpdateLogoIcon = addDBLoadingSymbol();

    showDbUpdateLogoTimeout = setTimeout(() => {
        if (showDbUpdateLogoIcon) showDbUpdateLogoIcon.remove();
        showDbUpdateLogoTimeout = null;
        showDbUpdateLogoIcon = null;
    }, 5000);
});

window.onscroll = () => {
    // ONSCROLL Event handler
    var _top = 5;
    stickElementToTopScrollEVhandler('ave-btn-allseen', `${_top}px`);
    _top = _top + 35;

    if (SETTINGS.EnableBtnMarkAllAsSeen) {
        stickElementToTopScrollEVhandler('ave-btn-db-allseen', `${_top}px`);
        _top = _top + 35;
    }

    stickElementToTopScrollEVhandler('ave-btn-backtotop', `${_top}px`);

    if (currentMainPage == PAGETYPE.ALL) handleInfiniteScroll();
};

let blockHandleInfiniteScroll = false;
let infiniteScrollLastPreloadedPage = 1;
let infiniteScrollMaxPreloadPage = 125; // Hardcoded for scrolltest, must later get extracted from Pagination
/* NOTE: 'inifiniteScrollBlockAppend' is a known typo for 'infiniteScroll...'. It is
   consistent across all usages in this file, so renaming it would be purely cosmetic
   and risks introducing regressions. */
let inifiniteScrollBlockAppend = false;
let infiniteScrollTilesBufferArray = [];

function injectDarkMode() {
    const _darkModeIgnoreBackgroundColor = `
    i,
    span.a-declarative *,
    #navbar-main *,
    #ave-btn-allseen *,
    #ave-btn-db-allseen *,
    #ave-btn-backtotop *,
    #ave-branding-text,
    #ave-brandig-text,
    .animated-progress *,
    .a-switch.a-declarative,
    .vvp-reviews-table--actions-col *,
    .a-tab-heading,
    .a-tab-heading a,
    .ave-favorite-star,
    .vvp-item-tile,
    .vvp-item-tile-content,
    .vvp-item-tile-content *,
    .a-popover-lgtbox,
    .a-modal-scroller.a-declarative,
    #ave-btn-all-products *,
    #ave-btn-favorites *,
    #ave-btn-list-new *,
    .ave-settings-label-switch *,
    .a-last *
    `;
    const _darkModeIgnoreColor = `
    span.a-declarative *,
    #navbar-main *,
    #ave-btn-allseen *,
    #ave-btn-db-allseen *,
    #ave-btn-backtotop *,
    #ave-branding-text,
    #ave-brandig-text,
    .a-switch.a-declarative,
    .vvp-reviews-table--actions-col *,
    .vvp-details-btn *,
    .vvp-header-link *,
    .a-link-normal,
    #ave-btn-all-products,
    #ave-btn-all-products *,
    #ave-btn-favorites,
    #ave-btn-favorites *,
    #ave-btn-list-new,
    #ave-btn-list-new *,
    .a-last *
    `;

    const _darkModeIgnoreIcons = `
    #vvp-feedback-star-rating
    `;

    const darkCSS = `
    :root{
      --primary-color: ${SETTINGS.DarkModeColor};
      --secondary-color: ${SETTINGS.DarkModeBackgroundColor};
    }

    .ave-color, .ave-color *:not(${_darkModeIgnoreColor}){
      color: var(--primary-color) !important;
    }
    .ave-background-color, .ave-background-color *:not(${_darkModeIgnoreBackgroundColor}){
      background-color: var(--secondary-color) !important;
    }
    .a-expander-content-fade,
    .a-popover-footer::before,
    .a-popover-wrapper::after
    {
      background: none !important;
    }
    i:not(${_darkModeIgnoreIcons}){
      background-color: transparent !important;
      filter: invert(1) !important;
    }
    `;
    // Erstelle ein neues Style-Element
    var styleElement = document.createElement('style');
    styleElement.type = 'text/css';

    // Füge die CSS-Variable und den Wert am Anfang des Style-Elements hinzu
    styleElement.textContent = darkCSS;

    // Füge das Style-Element am Anfang des <head>-Tags hinzu
    document.head.insertBefore(styleElement, document.head.firstChild);
    document.body.classList.add('ave-color', 'ave-background-color');
}

/**
 * Append buffered tiles and prefetch additional pages when near the bottom.
 * Guards are used to avoid concurrent fetches and duplicate appends.
 */
function handleInfiniteScroll() {
    if (SETTINGS.DebugLevel > 10) console.log('Called handleInfiniteScroll()');
    if (!inifiniteScrollBlockAppend) {
        inifiniteScrollBlockAppend = true;
        appendInfiniteScrollTiles(() => {
            inifiniteScrollBlockAppend = false;
        });
    }

    if (SETTINGS.EnableInfiniteScrollLiveQuerry) {
        if (blockHandleInfiniteScroll) return;
        blockHandleInfiniteScroll = true;

        const _maxScrollHeight = Math.max(
            document.body.scrollHeight - window.innerHeight,
            document.documentElement.scrollHeight - window.innerHeight
        );

        if (SETTINGS.DebugLevel > 10)
            console.log(
                `handleInfiniteScroll(): _maxScrollHeight: ${_maxScrollHeight} window.scrollY+inner: ${window.scrollY + window.innerHeight}`
            );

        if (_maxScrollHeight > window.scrollY + window.innerHeight * 2) {
            blockHandleInfiniteScroll = false;
            return;
        } else if (infiniteScrollTilesBufferArray.length < 1000 && infiniteScrollLastPreloadedPage < infiniteScrollMaxPreloadPage) {
            /* NOTE: The unescaped dots in the regex match any character, but Amazon's
               URL structure is stable. A null return from .exec() is theoretically
               possible only if Amazon changes domains, in which case AVE is unusable. */
            const _baseUrl = /(http[s]{0,1}:\/\/[w]{0,3}.amazon.[a-z]{1,}.{0,1}[a-z]{0,}\/vine\/vine-items)/.exec(window.location.href)[1];
            infiniteScrollLastPreloadedPage++;
            getTilesFromURL(`${_baseUrl}?queue=encore&pn=&cn=&page=${infiniteScrollLastPreloadedPage}`, (tiles) => {
                infiniteScrollTilesBufferArray = infiniteScrollTilesBufferArray.concat(tiles);

                blockHandleInfiniteScroll = false;
                if (infiniteScrollTilesBufferArray.length < 500) handleInfiniteScroll();
            });
        } else {
            blockHandleInfiniteScroll = false;
        }
    }
}

function getUrlParameter(name) {
    const _queryString = window.location.search;
    const _urlParams = new URLSearchParams(_queryString);
    return _urlParams.get(name);
}

/**
 * Resolves a (possibly relative) URL against the current page.
 *
 * Amazon uses relative links on the Vine pages, e.g. the "Für Sie empfohlen"
 * button points to "vine-items?queue=potluck". A relative URL is resolved
 * against the DIRECTORY of the current URL. As long as the page was loaded
 * from "https://www.amazon.de/vine/vine-items" the directory is "/vine/" and
 * the link resolves to "https://www.amazon.de/vine/vine-items?queue=potluck".
 * If the page was loaded with a trailing slash
 * ("https://www.amazon.de/vine/vine-items/") the directory is
 * "/vine/vine-items/" and the link resolves to
 * "https://www.amazon.de/vine/vine-items/vine-items?queue=potluck", which is
 * an error page on Amazon.
 *
 * To avoid this, the trailing slash is removed from the path of the base URL
 * before the resolution.
 *
 * @param {string} href The URL to resolve (absolute or relative)
 * @returns {string} The absolute URL
 */
function aveResolveUrl(href) {
    if (!href) return href;
    try {
        // The path of the current page is used without a trailing slash, so that
        // the relative links are resolved against the directory of the page
        // ("/vine/") and not against the page itself ("/vine/vine-items/").
        const _path = window.location.pathname.replace(/\/+$/, '');
        // A path with only one segment (e.g. "/vine") keeps its slash, because
        // otherwise the directory would be the root of the domain.
        const _keepSlash = _path.split('/').filter(Boolean).length <= 1 ? '/' : '';
        const _base = `${window.location.origin}${_path}${_keepSlash}${window.location.search}${window.location.hash}`;
        return new URL(href, _base).href;
    } catch (error) {
        console.error(`aveResolveUrl(): could not resolve the URL "${href}":`, error);
        return href;
    }
}

/**
 * Returns the URL of the current page with the given page number.
 *
 * The pagination parameter of the Vine pages is "page". The previous generic
 * replacement (/=[0-9]+/) could also hit other parameters, e.g. "ave-subpage".
 *
 * @param {number} page The page number to set
 * @returns {string} The URL with the new page number
 */
function aveUrlWithPage(page) {
    const _url = window.location.href;
    if (/([?&]page=)\d+/.test(_url)) {
        return _url.replace(/([?&]page=)\d+/, `$1${page}`);
    }
    // Fallback for the case that the pagination parameter is not named "page".
    return _url.replace(/=[0-9]+/, `=${page}`);
}

/**
 * Removes a trailing slash from the URL of the current Vine page.
 *
 * See aveResolveUrl() for the reason. The URL is only changed in the address
 * bar of the browser, the page is not reloaded.
 */
function aveStripTrailingSlashFromUrl() {
    if (!SITE_IS_VINE) return;
    if (!window.location.pathname.endsWith('/')) return;
    const _newUrl = `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}${window.location.search}${window.location.hash}`;
    try {
        window.history.replaceState(window.history.state, '', _newUrl);
        if (SETTINGS.DebugLevel > 1) console.log(`aveStripTrailingSlashFromUrl(): the URL was changed to ${_newUrl}`);
    } catch (error) {
        console.error('aveStripTrailingSlashFromUrl(): could not change the URL:', error);
    }
}

/**
 * Makes the relative links of the Amazon Vine navigation absolute.
 *
 * Amazon renders the Vine navigation buttons with relative links
 * ("vine-items?queue=potluck"). If the page was loaded with a trailing slash
 * in the URL, the browser resolves them wrongly and the user ends up on
 * ".../vine/vine-items/vine-items?queue=potluck" (an Amazon error page).
 * Making the links absolute removes the dependency on the current URL.
 *
 * The function also removes a trailing slash from the URL itself, because
 * AVE uses relative URLs for its own navigation as well.
 */
function aveFixRelativeVineLinks() {
    if (!SITE_IS_VINE) return;

    aveStripTrailingSlashFromUrl();

    // The selectors of the Amazon links that are relative and would therefore
    // break on a URL with a trailing slash.
    const _selectors = ['#vvp-items-button-container a[href]', '.a-pagination a[href]'];

    const _fixLinks = () => {
        // Amazon can change the URL after the page was loaded (e.g. it adds the
        // queue parameter), so the trailing slash has to be removed again here.
        aveStripTrailingSlashFromUrl();
        for (const _selector of _selectors) {
            const _links = document.querySelectorAll(_selector);
            for (const _link of _links) {
                const _href = _link.getAttribute('href');
                if (!_href) continue;
                const _absolute = aveResolveUrl(_href);
                if (_absolute !== _href) _link.setAttribute('href', _absolute);
            }
        }
    };

    let _observedContainer = null;
    let _observer = null;

    const _observeContainer = (_container) => {
        if (!_container || _container === _observedContainer) return;
        if (_observer) _observer.disconnect();
        _observedContainer = _container;
        _observer = new MutationObserver(() => {
            _fixLinks();
            // Amazon can replace the whole container, then the new one has to be
            // observed instead of the old one.
            const _current = document.getElementById('vvp-items-button-container');
            if (_current && _current !== _observedContainer) {
                _observeContainer(_current);
                _fixLinks();
            }
        });
        _observer.observe(_container, { childList: true, subtree: true });
    };

    waitForHtmlElement(
        '#vvp-items-button-container',
        (elem) => {
            if (!elem) return;
            _fixLinks();
            _observeContainer(elem);
        },
        document,
        10000,
        false
    );
}

/**
 * Detect the current Vine queue based on URL parameters.
 * Sets currentMainPage for downstream navigation logic.
 */
function detectCurrentPageType() {
    // NOTE: The trailing slash is optional, because Amazon redirects to
    // ".../vine/vine-items/" and the relative links of the page are resolved
    // against the directory of the URL (see aveResolveUrl()).
    if (/http[s]{0,1}:\/\/[w]{0,3}.amazon.[a-z]{1,}.{0,1}[a-z]{0,}\/vine\/vine-items\/?$/.test(window.location.href)) {
        currentMainPage = PAGETYPE.ORIGINAL_LAST_CHANCE;
    } else if (getUrlParameter('queue') == 'last_chance') {
        currentMainPage = PAGETYPE.ORIGINAL_LAST_CHANCE;
    } else if (getUrlParameter('queue') == 'potluck') {
        currentMainPage = PAGETYPE.OROGINAL_POTLUCK;
    } else if (getUrlParameter('queue') == 'encore') {
        currentMainPage = PAGETYPE.ORIGINAL_SELLER;
    }
}

/**
 * Parse tile metadata and sync with IndexedDB.
 * @param {Element} tile
 * @returns {Promise<Product>}
 */
async function parseTileData(tile) {
    if (SETTINGS.DebugLevel > 12) console.log(`Called parseTileData(`, tile, ')');

    const _id = tile.getAttribute('data-recommendation-id');
    const _ret = await database.getById(_id);

    if (_ret) {
        _ret.gotFromDB = true;
        _ret.ts_lastSeen = unixTimeStamp();
        _ret.notSeenCounter = 0;
        if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): got DB Entry`);
        await database.update(_ret);
        return _ret;
    }

    // The badges are optional, so a short timeout without a warning is enough
    await waitForHtmlElementPromise('.vvp-item-badges', tile, 3000, false);
    const _isPrerelease = tile.getElementsByClassName('vvp-badge-prerelease').length > 0;
    const _isFeatured = tile.getElementsByClassName('vvp-badge-featured').length > 0;

    await waitForHtmlElementPromise('.vvp-item-tile-content', tile);
    const _div_vpp_item_tile_content = tile.getElementsByClassName('vvp-item-tile-content')[0];

    await waitForHtmlElementPromise('img', _div_vpp_item_tile_content);
    const _div_vpp_item_tile_content_img = _div_vpp_item_tile_content.getElementsByTagName('img')[0];

    await waitForHtmlElementPromise('.vvp-item-product-title-container', _div_vpp_item_tile_content);
    const _div_vvp_item_product_title_container = _div_vpp_item_tile_content.getElementsByClassName('vvp-item-product-title-container')[0];

    var _div_vvp_item_product_title_container_a;
    if (!_isPrerelease) {
        await waitForHtmlElementPromise('a', _div_vvp_item_product_title_container);
        _div_vvp_item_product_title_container_a = _div_vvp_item_product_title_container.getElementsByTagName('a')[0];
    }

    await waitForHtmlElementPromise('.a-button-inner', _div_vpp_item_tile_content);
    const _div_vpp_item_tile_content_button_inner = _div_vpp_item_tile_content.getElementsByClassName('a-button-inner')[0];

    await waitForHtmlElementPromise('input', _div_vpp_item_tile_content_button_inner);
    const _div_vpp_item_tile_content_button_inner_input = _div_vpp_item_tile_content_button_inner.getElementsByTagName('input')[0];

    if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): wait 6`);

    const _newProduct = new Product(_id);
    _newProduct.data_recommendation_id = _id;
    _newProduct.data_img_url = tile.getAttribute('data-img-url');
    _newProduct.data_img_alt = _div_vpp_item_tile_content_img.getAttribute('alt') || '';
    _newProduct.data_is_featured = _isFeatured;

    if (!_isPrerelease) {
        _newProduct.link = _div_vvp_item_product_title_container_a.getAttribute('href');
    }

    _newProduct.description_full = _div_vvp_item_product_title_container.getElementsByClassName('a-truncate-full')[0].textContent;
    _newProduct.description_short = _div_vvp_item_product_title_container.getElementsByClassName('a-truncate-cut')[0].textContent;

    _newProduct.data_asin = _div_vpp_item_tile_content_button_inner_input.getAttribute('data-asin');
    _newProduct.data_recommendation_type = _div_vpp_item_tile_content_button_inner_input.getAttribute('data-recommendation-type');
    _newProduct.data_asin_is_parent = _div_vpp_item_tile_content_button_inner_input.getAttribute('data-is-parent-asin') == 'true';
    _newProduct.data_is_pre_release = _div_vpp_item_tile_content_button_inner_input.getAttribute('data-is-pre-release') == 'true';

    // If short description is empty, try to fetch it with retries
    if (_newProduct.description_short == '') {
        if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): we don´t have a short description`);
        let _timeLoopCounter = 0;
        const _maxLoops = Math.round(SETTINGS.FetchRetryMaxTime / SETTINGS.FetchRetryTime);
        const _halfdelay = SETTINGS.FetchRetryTime / 2;

        while (_timeLoopCounter++ < _maxLoops) {
            await new Promise((res) => setTimeout(res, _halfdelay + Math.round(Math.random() * _halfdelay * 2)));
            const _short = _div_vvp_item_product_title_container.getElementsByClassName('a-truncate-cut')[0].textContent;
            if (_short != '') {
                _newProduct.description_short = _short;
                return _newProduct;
            }
        }
        _newProduct.description_short = `${_newProduct.description_full.substr(0, 50)}...`;
        _newProduct.generated_short = true;
        return _newProduct;
    } else {
        if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): END`);
        return _newProduct;
    }
}

function reloadPageWithSubpageTarget(target) {
    if (window.location.href.includes('?')) {
        window.location.href = window.location.href + `&ave-subpage=${target}`;
    } else {
        window.location.href = window.location.href + `?ave-subpage=${target}`;
    }
}

function addLeftSideButtons(forceClean) {
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');
    if (!_nodesContainer) return;

    if (forceClean) _nodesContainer.innerHTML = '';

    const _div = _nodesContainer.appendChild(document.createElement('div'));
    _div.setAttribute('class', 'parent-node');

    _div.appendChild(document.createElement('p')); // A bit of Space above our Buttons

    const _setAllSeenBtn = createButton(
        translate('buttons', 'markPageAsSeen', 'Seite als gesehen markieren'),
        'ave-btn-allseen',
        `width: 240px; background-color: ${SETTINGS.BtnColorMarkCurrSiteAsSeen};`,
        () => {
            if (SETTINGS.DebugLevel > 10) console.log('Clicked All Seen Button');
            markAllCurrentSiteProductsAsSeen();
            window.scrollTo(0, 0);
        }
    );
    _div.appendChild(_setAllSeenBtn);

    if (SETTINGS.EnableBtnMarkAllAsSeen) {
        const _setAllSeenDBBtn = createButton(
            translate('buttons', 'markAllAsSeen', 'Alle als gesehen markieren'),
            'ave-btn-db-allseen',
            `left: 0; width: 240px; background-color: ${SETTINGS.BtnColorMarkAllAsSeen};`,
            () => {
                if (SETTINGS.DebugLevel > 10) console.log('Clicked All Seen Button');
                setTimeout(() => {
                    database.getNewEntries().then((prodsArr) => {
                        const _prodsArryLength = prodsArr.length;
                        for (let i = 0; i < _prodsArryLength; i++) {
                            const _currProd = prodsArr[i];
                            if (_currProd.isNew) {
                                _currProd.isNew = 0;
                                database
                                    .update(_currProd)
                                    .then(() => {
                                        // Update the tile on the current page, so that the "new" frame
                                        // disappears right away and not only after a reload of the page.
                                        updateTileStyle(_currProd);
                                    })
                                    .catch((error) => {
                                        console.error(`Could not update the product ${_currProd.id}: ${error}`);
                                    });
                            }
                        }
                    });
                }, 30);
            }
        );
        _div.appendChild(_setAllSeenDBBtn);
    }

    const _backToTopBtn = createButton(
        translate('buttons', 'backToTop', 'Zum Seitenanfang'),
        'ave-btn-backtotop',
        `width: 240px; background-color: ${SETTINGS.BtnColorBackToTop};`,
        () => {
            if (SETTINGS.DebugLevel > 10) console.log('Clicked back to Top Button');
            window.scrollTo(0, 0);
        }
    );
    _div.appendChild(_backToTopBtn);
}

/**
 * Marks all products of the current page as seen.
 *
 * @returns {Promise<void>} Resolves when every tile was processed. A tile that
 *                          could not be read or written does not stop the others.
 */
async function markAllCurrentSiteProductsAsSeen() {
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tilesLength = _tiles.length;

    const _workersProms = [];
    for (let i = 0; i < _tilesLength; i++) {
        const _tile = _tiles[i];
        const _id = _tile.getAttribute('data-recommendation-id');
        _workersProms.push(
            (async () => {
                try {
                    const _prod = await database.getById(_id);
                    // The product is not in the database (should not happen normally), so there is
                    // nothing to mark. Without this check the following line would throw an error.
                    if (!_prod) return;
                    _prod.isNew = 0;
                    await database.update(_prod);
                    updateTileStyle(_prod);
                } catch (error) {
                    console.error(`markAllCurrentSiteProductsAsSeen(): could not process the product ${_id}: ${error}`);
                }
            })()
        );
    }
    await Promise.allSettled(_workersProms);
}

/**
 * Marks all products of the database as seen.
 *
 * @returns {Promise<void>} Resolves when every product was processed.
 */
async function markAllCurrentDatabaseProductsAsSeen() {
    if (SETTINGS.DebugLevel > 10) console.log('Called markAllCurrentDatabaseProductsAsSeen()');
    const _prods = await database.getNewEntries();
    const _prodsLength = _prods.length;
    if (SETTINGS.DebugLevel > 10) console.log(`markAllCurrentDatabaseProductsAsSeen() - Got ${_prodsLength} Products with Tag isNew`);

    const _workersProms = [];
    for (let i = 0; i < _prodsLength; i++) {
        const _currProd = _prods[i];
        _currProd.isNew = 0;
        _workersProms.push(
            database
                .update(_currProd)
                .then(() => {
                    if (SETTINGS.DebugLevel > 10) console.log(`markAllCurrentDatabaseProductsAsSeen() - Updated ${_currProd.id}`);
                })
                .catch((error) => {
                    console.error(`markAllCurrentDatabaseProductsAsSeen(): could not update the product ${_currProd.id}: ${error}`);
                })
        );
    }
    await Promise.allSettled(_workersProms);
}

function createButton(text, id, style, clickHandler) {
    const _btnSpan = document.createElement('span');
    _btnSpan.setAttribute('id', id);
    _btnSpan.setAttribute('class', 'a-button a-button-normal a-button-toggle');
    _btnSpan.setAttribute('aria-checked', 'true');
    _btnSpan.style.marginLeft = '0';
    _btnSpan.style.marginTop = '5px';
    _btnSpan.innerHTML = `
        <span class="a-button-inner" style="${style || ''}">
            <span class="a-button-text">${text}</span>
        </span>
    `;
    _btnSpan.addEventListener('click', (ev) => {
        if (clickHandler) {
            clickHandler(ev);
        } else {
            alert(translate('notifications', 'nothingToSee', 'Hier gibt es nix zu sehen.\nZumindest noch nicht :P'));
        }
    });
    return _btnSpan;
}

async function createTileFromProduct(product, btnID, cb) {
    if (!product) {
        throw new Error('createTileFromProduct(): no valid product element');
    }
    return new Promise((resolve, _reject) => {
        const _btnAutoID = btnID || Math.round(Math.random() * 10000);

        const _tile = document.createElement('div');
        _tile.setAttribute('class', 'vvp-item-tile');
        _tile.setAttribute('data-recommendation-id', product.data_recommendation_id);
        _tile.setAttribute('data-img-url', fixProductImageUrl(product.data_img_url));
        _tile.setAttribute(
            'style',
            product.notSeenCounter > 0
                ? SETTINGS.CssProductRemovalTag
                : product.isFav
                  ? SETTINGS.CssProductNewTag
                  : product.isNew
                    ? SETTINGS.CssProductNewTag
                    : SETTINGS.CssProductDefault
        );
        const _spanTruncateHtml = `
            <span class="a-truncate" data-a-word-break="normal" data-a-max-rows="2" data-a-overflow-marker="&amp;hellip;" style="line-height: 1.3em !important; max-height: 2.6em;" data-a-recalculate="false" data-a-updated="true">
                <span class="a-truncate-full a-offscreen">${product.description_full}</span>
                <span class="a-truncate-cut" aria-hidden="true" style="height: 2.6em;">${product.description_short}</span>
            </span>
        `;
        const _itemProductTitleContainerHtml = product.link
            ? `
            <a class="a-link-normal" target="_blank" rel="noopener" href="${product.link}">
                ${_spanTruncateHtml}
            </a>
        `
            : _spanTruncateHtml;
        var _itemBadgesHtml = '';
        if (product.data_is_pre_release || product.data_is_featured) {
            _itemBadgesHtml += '<div class="vvp-item-badges" style="margin-top: 20px;">';
            if (product.data_is_pre_release) {
                _itemBadgesHtml += `<span class="vvp-badge-prerelease">${translate('badges', 'preRelease', 'Vorabversion')}</span>`;
            }
            if (product.data_is_featured) {
                _itemBadgesHtml += `<span class="vvp-badge-featured">${translate('badges', 'featured', 'Empfohlen')}</span>`;
            }
            _itemBadgesHtml += '</div>';
        }
        _tile.innerHTML = `
            <div class="vvp-item-tile-content">
                ${_itemBadgesHtml}
                <img alt="${product.data_img_alt}" src="${fixProductImageUrl(product.data_img_url)}">
                <div class="vvp-item-product-title-container">
                    ${_itemProductTitleContainerHtml}
                </div>
                <span class="a-button a-button-primary vvp-details-btn" id="a-autoid-${_btnAutoID}">
                    <span class="a-button-inner">
                        <input data-asin="${product.data_asin}" data-is-parent-asin="${product.data_asin_is_parent}" data-is-pre-release="${product.data_is_pre_release ?? false}" data-recommendation-id="${product.data_recommendation_id}" data-recommendation-type="${product.data_recommendation_type}" class="a-button-input" type="submit" aria-labelledby="a-autoid-${_btnAutoID}-announce">
                        <span class="a-button-text" aria-hidden="true" id="a-autoid-${_btnAutoID}-announce">${translate('buttons', 'moreDetails', 'Weitere Details')}</span>
                    </span>
                </span>
            </div>
        `;
        _tile.prepend(createFavStarElement(product, btnID));
        _tile.prepend(createTimeSeenElement(product, btnID));
        _tile.prepend(createShareElement(product, btnID));
        waitForHtmlElement(
            '.vvp-item-product-title-container',
            (_elem) => {
                if (!_elem) return;

                insertHtmlElementAfter(_elem, createTaxInfoElement(product, btnID));
            },
            _tile
        );
        if (cb) cb(_tile);
        resolve(_tile);
    });
}

function createFavStarElement(prod, index = Math.round(Math.random() * 10000)) {
    const _favElement = document.createElement('div');
    _favElement.setAttribute('id', `p-fav-${index || Math.round(Math.random() * 5000)}`);
    _favElement.classList.add('ave-favorite-star');
    _favElement.style.cssText = SETTINGS.CssProductFavStar();
    _favElement.textContent = '★';
    if (prod.isFav) _favElement.style.color = SETTINGS.FavStarColorChecked; // SETTINGS.FavStarColorChecked = Gelb;
    return _favElement;
}

function createFirstSeenElement(prod, index = Math.round(Math.random() * 10000)) {
    return createTimeSeenElement(prod, index, true);
}

function createTimeSeenElement(prod, index = Math.round(Math.random() * 10000), showFirstSeen) {
    const _showFirstSeen = showFirstSeen === false || showFirstSeen === true ? showFirstSeen : SETTINGS.ShowFirstSeen || false;

    const _timeSeenElement = document.createElement('div');
    _timeSeenElement.setAttribute('id', `ave-p-timeSeen-${index || Math.round(Math.random() * 5000)}`);
    _timeSeenElement.classList.add('ave-last-seen');
    if (_showFirstSeen) {
        _timeSeenElement.textContent = 'First seen: ' + timeAgo(new Date(toTimestamp(prod.ts_firstSeen)));
    } else {
        _timeSeenElement.textContent = 'Last seen: ' + timeAgo(new Date(toTimestamp(prod.ts_lastSeen)));
    }
    _timeSeenElement.style.float = 'left';
    _timeSeenElement.style.display = 'flex';
    return _timeSeenElement;
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    const interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + ' years ago';
    }
    if (interval === 1) {
        return interval + ' year ago';
    }

    const months = Math.floor(seconds / 2628000);
    if (months > 1) {
        return months + ' months ago';
    }
    if (months === 1) {
        return months + ' month ago';
    }

    const days = Math.floor(seconds / 86400);
    if (days > 1) {
        return days + ' days ago';
    }
    if (days === 1) {
        return days + ' day ago';
    }

    const hours = Math.floor(seconds / 3600);
    if (hours > 1) {
        return hours + ' hours ago';
    }
    if (hours === 1) {
        return hours + ' hour ago';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes > 1) {
        return minutes + ' minutes ago';
    }
    if (minutes === 1) {
        return minutes + ' minute ago';
    }

    return 'just now';
}

function createShareElement(prod, index = Math.round(Math.random() * 10000)) {
    const _shareElement = document.createElement('div');
    _shareElement.setAttribute('id', `ave-p-share-${index || Math.round(Math.random() * 5000)}`);
    _shareElement.classList.add('ave-share');
    _shareElement.textContent = '🔗';
    _shareElement.style.float = 'left';
    _shareElement.style.display = 'flex';
    _shareElement.style.margin = '0';
    _shareElement.style.cursor = 'pointer';
    return _shareElement;
}

function shareEventHandlerClick(event, _data) {
    if (_data.recommendation_id) {
        if (SETTINGS.DebugLevel > 1) console.log('[AVE]', _data);
        const newUrl = `${window.location.origin}/dp/${_data.asin}?vine-data=${encodeURIComponent(
            JSON.stringify({
                asin: _data.asin,
                isParentAsin: _data.parent_asin,
                recommendationId: _data.recommendation_id,
                tax: _data.tax
            })
        )}`;

        const urlParams = new URLSearchParams(window.location.search);
        let queueParam = currentMainPage;
        let pageParam = urlParams.get('page');
        if (pageParam == null) {
            pageParam = 1;
        }
        let page = '';

        switch (queueParam) {
            case PAGETYPE.OROGINAL_POTLUCK:
                queueParam = translate('share', 'myFSE', 'Mein FSE');
                page = `${translate('share', 'page', 'Seite:')} ${pageParam}`;
                break;
            case PAGETYPE.ORIGINAL_LAST_CHANCE:
                queueParam = translate('share', 'availableAll', 'Verfügbar für Alle');
                page = `${translate('share', 'page', 'Seite:')} ${pageParam}`;
                break;
            case PAGETYPE.ORIGINAL_SELLER:
                queueParam = translate('share', 'additional', 'Zusätzliche Artikel');
                page = `${translate('share', 'page', 'Seite:')} ${pageParam}`;
                break;
            default:
                queueParam = '';
                page = ``;
                break;
        }

        const shareText = `
${queueParam}
${page}
${_data.tax}

${newUrl}`;

        const inputRect = event.target.getBoundingClientRect();

        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        const avePopup = document.createElement('div');
        avePopup.style.position = 'absolute';
        avePopup.style.zIndex = '9999';
        avePopup.style.padding = '5px';
        avePopup.style.top = `${inputRect.top + scrollY}px`;
        avePopup.style.left = `${inputRect.left + scrollX}px`;
        avePopup.style.border = '5px solid black';
        avePopup.style.borderRadius = '100vh';
        avePopup.style.backgroundColor = 'white';
        avePopup.style.transform = 'translate(-50%, -100%)';
        avePopup.style.opacity = '0';
        avePopup.style.transition = 'opacity 0.2s ease-in-out';

        navigator.clipboard
            .writeText(shareText)
            .then(() => {
                avePopup.innerText = translate('notifications', 'copySuccess', 'Text wurde in die Zwischenablage kopiert.');
            })
            .catch((err) => {
                avePopup.innerText = `${translate('notifications', 'copyError', 'Fehler beim Kopieren in die Zwischenablage:')}${err}`;
            });

        document.body.appendChild(avePopup);

        // Timeout 0ms for the next Event Cycle -> Give time to render
        setTimeout(() => {
            avePopup.style.opacity = '1';
        }, 0);

        setTimeout(() => {
            avePopup.style.opacity = '0';
            setTimeout(() => {
                avePopup.remove();
            }, 200);
        }, 3500);
    }
}

function createTaxInfoElement(prod, index = Math.round(Math.random() * 10000)) {
    if (SETTINGS.DebugLevel > 10) 'Called createTaxInfo()';
    let _currencySymbol = '';
    if (prod.data_tax_currency && prod.data_tax_currency == 'EUR') _currencySymbol = '€';

    const _taxElement = document.createElement('span');
    _taxElement.setAttribute('id', `ave-taxinfo-${index}`);
    _taxElement.style.cssText = 'position: relative; transform: translate(0px, -30px); width: fit-content; right: 0px;';

    const _taxElement_span = document.createElement('span');
    _taxElement_span.setAttribute('id', `ave-taxinfo-${index}-text`);
    _taxElement_span.classList.add('ave-taxinfo-text');
    const _prize = prod.data_estimated_tax_prize;
    if (SETTINGS.DebugLevel > 10) console.log('Called createTaxInfo(): We have a Taxprize of: ', _prize);
    _taxElement_span.innerText = `Tax Price: ${typeof _prize == 'number' ? Intl.NumberFormat(undefined, { minimumFractionDigits: 2 }).format(_prize) : '--.--'} ${_currencySymbol}`;
    if (SETTINGS.DebugLevel > 10) console.log('createTaxInfo(): After innerText');

    _taxElement.appendChild(_taxElement_span);
    if (SETTINGS.DebugLevel > 10) console.log('createTaxInfo(): END', _taxElement);
    return _taxElement;
}

function insertHtmlElementAfter(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

async function createProductSite(siteType, productArray, cb) {
    if (!productArray) return;

    const _showFirstSeen = SETTINGS.ShowFirstSeen || false;
    productArray = sort_by_key(productArray, _showFirstSeen ? 'ts_firstSeen' : 'ts_lastSeen');

    const _productArrayLength = productArray.length;
    const _fastCount = Math.min(_productArrayLength, SETTINGS.MaxItemsPerPage);
    if (SETTINGS.DebugLevel > 10) console.log(`Create Overview for ${_productArrayLength} Products`);

    // Remove Pagination
    const _paginations = document.querySelectorAll('.a-pagination');
    _paginations.forEach((_pagination) => {
        _pagination.remove();
    });

    const _contentContainer = document.querySelector('.a-section.vvp-tab-content');
    if (_contentContainer.querySelector('.vvp-no-offers-msg')) {
        _contentContainer.querySelector('.vvp-no-offers-msg').remove();
        const _tileStructure = document.createElement('div');
        _tileStructure.classList = 'a-section vvp-items-container';
        _tileStructure.innerHTML = `
        <div id="vvp-browse-nodes-container">
        </div>
        <div id="vvp-items-grid-container">
        <p>
        </p>
        <div id="vvp-items-grid" class="a-section">
        </div>
        </div>`;

        _contentContainer.appendChild(_tileStructure);
    }

    // Cear Left Nodes Container
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');
    if (_nodesContainer) _nodesContainer.innerHTML = '';

    // Items Grid Container
    const _tilesContainer = document.getElementById('vvp-items-grid-container');
    /* NOTE: If the container is missing we trigger a reload, but JS execution
       continues briefly. In practice these DOM elements always exist on loaded
       Vine pages, so the TypeError below is a theoretical fallback only. */
    if (!_tilesContainer) reloadPageWithSubpageTarget(siteType);

    // Edit Top Line
    if (_tilesContainer) {
        const _topLine = _tilesContainer.getElementsByTagName('p')[0];
        _topLine.innerHTML = `<p>Anzeigen von <strong>${_fastCount}</strong> von <strong>${_productArrayLength}</strong> Ergebnissen</p>`;
    }

    const _tilesGrid = document.getElementById('vvp-items-grid');
    if (!_tilesGrid) reloadPageWithSubpageTarget(siteType);
    /* NOTE: See above — the reload is a fallback. In practice _tilesGrid is never
       null here, so the following line is safe. */
    _tilesGrid.innerHTML = '';

    let _index = 0;
    let _returned = 0;

    for (; _index < _fastCount; _index++) {
        createTileFromProduct(productArray[_index], _index, (tile) => {
            _tilesGrid.append(tile);
            _returned++;
            if (SETTINGS.DebugLevel > 10) console.log(`Created Tile (${_returned}/${_fastCount})`);
            if (_returned == _fastCount) cb(true);
        }).catch((error) => {
            // The tile could not be created. It has to be counted as well, otherwise the
            // callback would never be called and the page would stay unfinished.
            console.error(`createProductSite(): could not create the tile: ${error}`);
            _returned++;
            if (_returned == _fastCount) cb(true);
        });
    }

    addLeftSideButtons(true);
}

async function createInfiniteScrollSite(siteType, cb) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called createInfiniteScrollSite()`);

    // Remove Pagination
    const _paginations = document.querySelectorAll('.a-pagination');
    _paginations.forEach((_pagination) => {
        _pagination.remove();
    });

    const _contentContainer = document.querySelector('.a-section.vvp-tab-content');
    if (_contentContainer.querySelector('.vvp-no-offers-msg')) {
        _contentContainer.querySelector('.vvp-no-offers-msg').remove();
        const _tileStructure = document.createElement('div');
        _tileStructure.classList = 'a-section vvp-items-container';
        _tileStructure.innerHTML = `
        <div id="vvp-browse-nodes-container">
        </div>
        <div id="vvp-items-grid-container">
        <p>
        </p>
        <div id="vvp-items-grid" class="a-section">
        </div>
        </div>`;

        _contentContainer.appendChild(_tileStructure);
    }

    // Cear Left Nodes Container
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');
    if (_nodesContainer) _nodesContainer.innerHTML = '';

    // Items Grid Container
    const _tilesContainer = document.getElementById('vvp-items-grid-container');
    /* NOTE: See createProductSite() for the same pattern. In practice the DOM is
       always present when this code runs, making the reload a theoretical fallback. */
    if (!_tilesContainer) reloadPageWithSubpageTarget(siteType);

    // Edit Top Line
    if (_tilesContainer) {
        const _topLine = _tilesContainer.getElementsByTagName('p')[0];
        _topLine.innerHTML = '';
    }

    const _tilesGrid = document.getElementById('vvp-items-grid');
    if (!_tilesGrid) reloadPageWithSubpageTarget(siteType);
    /* NOTE: Same as createProductSite(): _tilesGrid is never null in practice. */
    _tilesGrid.innerHTML = '';

    addLeftSideButtons(true);
    cb(_tilesGrid);
}

async function appendInfiniteScrollTiles(cb = () => {}) {
    // So lange tiles hinzufügen bis wir wieder über dem sichtbaren bereich sind
    if (SETTINGS.DebugLevel > 10) console.log('appendInfiniteScrollTiles(): ', infiniteScrollTilesBufferArray);
    const _tilesContainer = document.getElementById('vvp-items-grid');

    let _stopCreation = false;
    let _createdCount = 0;
    while (infiniteScrollTilesBufferArray.length > 0 && !_stopCreation) {
        const _tile = infiniteScrollTilesBufferArray.shift();
        if (SETTINGS.EnableInfiniteScrollLiveQuerry) {
            _tilesContainer.appendChild(_tile);
            parseTileData(_tile)
                .then((_product) => {
                    if (SETTINGS.DebugLevel > 14)
                        console.log('Come Back from parseTileData <<<<<<<<<< INFINITYSCROLL <<<<<<<<<<<<<<<<<<<<<<<', _tile, _product);
                    addStyleToTile(_tile, _product);
                    addTileEventhandlers(_tile);
                })
                .catch((error) => {
                    // The tile could not be processed, remove it again, so that no half
                    // finished tile is left behind.
                    console.error(`appendInfiniteScrollTiles(): could not process the tile: ${error}`);
                    _tile.remove();
                });
        } else {
            createTileFromProduct(_tile)
                .then((_elem) => {
                    _tilesContainer.appendChild(_elem);
                    addTileEventhandlers(_elem);
                })
                .catch((error) => {
                    console.error(`appendInfiniteScrollTiles(): could not create the tile: ${error}`);
                });
        }

        if (_createdCount++ >= 100) _stopCreation = true;

        const _maxScrollHeight = Math.max(
            document.body.scrollHeight - window.innerHeight,
            document.documentElement.scrollHeight - window.innerHeight
        );
        if (_maxScrollHeight > window.scrollY + window.innerHeight * 2) _stopCreation = true;

        if (SETTINGS.DebugLevel > 10)
            console.log(`appendInfiniteScrollTiles(): Inside WHILE: _maxScrollHeigt: ${_maxScrollHeight} currPosition ${window.scrollY}`);
    }

    if (SETTINGS.DebugLevel > 10)
        console.log(`appendInfiniteScrollTiles(): After WHILE: left tile to create: ${infiniteScrollTilesBufferArray.length}`);
    cb(true);

    // },100);
}

/**
 * AVE PAGETYPE ENUM
 * @readonly
 * @enum {number}
 */
/* NOTE: 'OROGINAL_POTLUCK' is a known typo for 'ORIGINAL_POTLUCK'. It is kept as-is
   because the misspelling is consistent across all three usages (definition,
   detectCurrentPageType, and createProductSite). Changing it now risks breaking any
   external code or bookmarks that rely on the current enum value. */
const PAGETYPE = {
    NEW_ITEMS: 0,
    FAVORITES: 1,
    ALL: 2,
    SEARCH_RESULT: 9,

    OROGINAL_POTLUCK: 100,
    ORIGINAL_LAST_CHANCE: 101,
    ORIGINAL_SELLER: 102
};

function createNewSite(type, data) {
    // Unhightlight nav buttons
    const _btnContainer = document.getElementById('vvp-items-button-container');
    const _selected = _btnContainer.getElementsByClassName('a-button-selected');
    for (let i = 0; i < _selected.length; i++) {
        const _btn = _selected[i];
        _btn.classList.remove('a-button-selected');
        _btn.classList.add('a-button-normal');
        _btn.removeAttribute('aria-checked');
    }

    switch (type) {
        case PAGETYPE.NEW_ITEMS: {
            currentMainPage = PAGETYPE.NEW_ITEMS;
            database.getNewEntries().then((_prodArr) => {
                createProductSite(type, _prodArr, () => {
                    initTileEventHandlers();
                    const _btn = document.getElementById('ave-btn-list-new');
                    _btn.classList.add('a-button-selected');
                    _btn.setAttribute('aria-checked', true);
                });
            });
            break;
        }
        case PAGETYPE.FAVORITES: {
            currentMainPage = PAGETYPE.FAVORITES;
            database.getFavEntries().then((_prodArr) => {
                createProductSite(type, _prodArr, () => {
                    initTileEventHandlers();
                    // NOTE: The button has its own id, because the "all products" button
                    // used the same id as the favorites button.
                    const _btn = document.getElementById('ave-btn-favorites');
                    if (_btn) {
                        _btn.classList.add('a-button-selected');
                        _btn.setAttribute('aria-checked', true);
                    }
                });
            });
            break;
        }
        case PAGETYPE.ALL: {
            currentMainPage = PAGETYPE.ALL;
            createInfiniteScrollSite(currentMainPage, (_tilesContainer) => {
                const _btn = document.getElementById('ave-btn-all-products');
                if (_btn) {
                    _btn.classList.add('a-button-selected');
                    _btn.setAttribute('aria-checked', true);
                }
                /* NOTE: Same regex caveat as in handleInfiniteScroll: unescaped dots
                   are lax, but the URL structure is stable for the Vine platform. */
                const _baseUrl = /(http[s]{0,1}:\/\/[w]{0,3}.amazon.[a-z]{1,}.{0,1}[a-z]{0,}\/vine\/vine-items)/.exec(
                    window.location.href
                )[1];
                const _preloadPages = ['potluck', 'last_chance', 'encore'];
                infiniteScrollLastPreloadedPage = 1;
                infiniteScrollMaxPreloadPage = 100;
                infiniteScrollTilesBufferArray = [];

                if (SETTINGS.EnableInfiniteScrollLiveQuerry) {
                    getTilesFromURL(`${_baseUrl}?queue=${_preloadPages[0]}`, (tiles1) => {
                        infiniteScrollTilesBufferArray = infiniteScrollTilesBufferArray.concat(tiles1);
                        appendInfiniteScrollTiles();
                        getTilesFromURL(`${_baseUrl}?queue=${_preloadPages[1]}`, (tiles2) => {
                            infiniteScrollTilesBufferArray = infiniteScrollTilesBufferArray.concat(tiles2);
                            appendInfiniteScrollTiles();
                            getTilesFromURL(`${_baseUrl}?queue=${_preloadPages[2]}`, (tiles3) => {
                                infiniteScrollTilesBufferArray = infiniteScrollTilesBufferArray.concat(tiles3);
                                appendInfiniteScrollTiles();
                                setTimeout(() => {
                                    handleInfiniteScroll(); // Just to trigger first preloads
                                }, 500);
                            });
                        });
                    });
                } else {
                    database.getAll().then((prodArr) => {
                        const _showFirstSeen = SETTINGS.ShowFirstSeen || false;
                        prodArr = sort_by_key(prodArr, _showFirstSeen ? 'ts_firstSeen' : 'ts_lastSeen');
                        infiniteScrollTilesBufferArray = prodArr;
                        appendInfiniteScrollTiles();
                    });
                }
            });
            break;
        }
        case PAGETYPE.SEARCH_RESULT: {
            currentMainPage = PAGETYPE.SEARCH_RESULT;
            createProductSite(type, data, () => {
                initTileEventHandlers();
            });
            break;
        }
    }
}

let lastGetTilesFromURLQuerry = 0;
function getTilesFromURL(url, cb = (_tilesArray) => {}) {
    if (lastGetTilesFromURLQuerry + SETTINGS.PageLoadMinDelay > Date.now()) {
        const _delay = Math.max(1, lastGetTilesFromURLQuerry + SETTINGS.PageLoadMinDelay - Date.now());
        console.warn(`getTilesFromURL() DELAYED for ${_delay}ms`);
        setTimeout(() => {
            getTilesFromURL(url, cb);
        }, _delay);
        return;
    }
    GM.xmlHttpRequest({
        method: 'GET',
        url: url,
        onload: function (response) {
            const _parser = new DOMParser();
            const _doc = _parser.parseFromString(response.responseText, 'text/html');
            lastGetTilesFromURLQuerry = Date.now();
            waitForHtmlElement(
                '#vvp-items-grid',
                (itemsContainer) => {
                    if (!itemsContainer) return;

                    if (SETTINGS.DebugLevel > 10) console.log('getTileFromURL(): itemsContainer:', itemsContainer);
                    const _retArr = [];
                    const _elemArr = itemsContainer.querySelectorAll('.vvp-item-tile');
                    for (let i = 0; i < _elemArr.length; i++) {
                        _retArr.push(_elemArr[i].cloneNode(true));
                    }
                    cb(_retArr);

                    const _paginationData = getPageinationData();
                    if (_paginationData) infiniteScrollMaxPreloadPage = _paginationData.maxPage;
                },
                _doc
            );
        }
    });
}

let lastBtnEventhandlerClickTimeStamp = 0;
function btnEventhandlerClick(event, data) {
    if (lastBtnEventhandlerClickTimeStamp + 1000 >= Date.now()) return;
    lastBtnEventhandlerClickTimeStamp = Date.now();
    if (SETTINGS.DebugLevel > 10) console.log(`called btnEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
    if (data.recommendation_id) {
        database.getById(data.recommendation_id).then(async (prod) => {
            if (SETTINGS.DebugLevel > 10) console.log(`btnEventhandlerClick() got respose from DB:`, prod);
            if (prod) {
                prod.isNew = 0;
                requestProductDetails(prod)
                    .then((_newProd) => {
                        database
                            .update(_newProd || prod)
                            .then(() => {
                                updateTileStyle(_newProd || prod);
                            })
                            .catch((error) => {
                                console.error(`btnEventhandlerClick(): could not update the product: ${error}`);
                            });
                    })
                    .catch((error) => {
                        console.error(`btnEventhandlerClick(): could not get the product details: ${error}`);
                    });
            }
        });
    }
}

function favStarEventhandlerClick(event, data) {
    if (SETTINGS.DebugLevel > 10) console.log(`called favStarEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
    if (data.recommendation_id) {
        database.getById(data.recommendation_id).then((prod) => {
            if (SETTINGS.DebugLevel > 10) console.log(`favStarEventhandlerClick() got respose from DB:`, prod);
            if (prod) {
                prod.isFav = 1 - prod.isFav;
                database
                    .update(prod)
                    .then(() => {
                        updateTileStyle(prod);
                    })
                    .catch((error) => {
                        console.error(`favStarEventhandlerClick(): could not update the product: ${error}`);
                    });
            }
        });
    }
}

/**
 * Updates Style and Text of a Product Tile
 * @param {Product} prod
 * @returns
 */
function updateTileStyle(prod) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called updateTileStyle(${JSON.stringify(prod, null, 4)})`);
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tilesLength = _tiles.length;

    if (SETTINGS.DebugLevel > 10) console.log(`Searching for tile with id ${prod.id}`);
    for (let i = 0; i < _tilesLength; i++) {
        const _tile = _tiles[i];
        const _id = _tile.getAttribute('data-recommendation-id');

        if (_id == prod.data_recommendation_id) {
            if (SETTINGS.DebugLevel > 10) console.log(`Found Tile with id: ${prod.id}`);
            _tile.setAttribute(
                'style',
                prod.isFav ? SETTINGS.CssProductFavTag : prod.isNew ? SETTINGS.CssProductNewTag : SETTINGS.CssProductDefault
            );
            const _favStar = _tile.querySelector('.ave-favorite-star');
            if (_favStar) _favStar.style.color = prod.isFav ? SETTINGS.FavStarColorChecked : 'white'; // SETTINGS.FavStarColorChecked = Gelb;

            const _taxValue = prod.data_estimated_tax_prize;
            if (typeof _taxValue == 'number') {
                const _taxValueElem = _tile.querySelector('.ave-taxinfo-text');
                if (_taxValueElem) {
                    _taxValueElem.innerText = _taxValueElem.innerText.replace('--.--', _taxValue);
                }
            }
            return;
        }
    }
}

// Adds Eventhandler to Product Buttons
function initTileEventHandlers() {
    if (SETTINGS.DebugLevel > 10)
        console.log(
            'Called inttTileEventHandlers() >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'
        );
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tileLength = _tiles.length;
    for (let i = 0; i < _tileLength; i++) {
        if (SETTINGS.DebugLevel > 10) console.log(`Adding Eventhandler to Tile ${i}`);
        const _currTile = _tiles[i];
        addTileEventhandlers(_currTile);
    }
}

function addTileEventhandlers(_currTile) {
    if (SETTINGS.DebugLevel > 10) console.log('Tile Event Handler');
    const _btn = _currTile.querySelector('.vvp-details-btn input');

    const _data = new Object();
    _data.asin = _btn.getAttribute('data-asin');
    _data.parent_asin = _btn.getAttribute('data-is-parent-asin');
    _data.recommendation_id = _btn.getAttribute('data-recommendation-id');

    waitForHtmlElement(
        '[id^="ave-taxinfo-"]',
        (elem) => {
            _data.tax = elem?.textContent;
        },
        _currTile
    );

    const _childs = _btn.childNodes;
    _btn.addEventListener('click', (event) => {
        btnEventhandlerClick(event, _data);
    });

    for (let j = 0; j < _childs.length; j++) {
        if (SETTINGS.DebugLevel > 10) console.log(`Adding Eventhandler to Children ${j} of Tile ${_currTile}`);
        _childs[j].addEventListener('click', (event) => {
            btnEventhandlerClick(event, _data);
        });
    }

    waitForHtmlElement(
        '.ave-favorite-star',
        (elem) => {
            if (!elem) return;

            elem.addEventListener('click', (event) => {
                favStarEventhandlerClick(event, _data);
            });
        },
        _currTile
    );

    waitForHtmlElement(
        '.ave-share',
        (elem) => {
            if (!elem) return;

            elem.addEventListener('click', (event) => {
                shareEventHandlerClick(event, _data);
            });
        },
        _currTile
    );
}

function completeDelayedInit() {
    initTileEventHandlers();
}

function showAutoScanScreen(text) {
    const _overlay = document.createElement('div');
    _overlay.style.position = 'fixed';
    _overlay.style.top = '0';
    _overlay.style.left = '0';
    _overlay.style.width = '100%';
    _overlay.style.height = '100%';
    _overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; // Grauer Hintergrund mit Transparenz
    _overlay.style.zIndex = '1000'; // Stelle sicher, dass das Overlay über anderen Elementen liegt

    const _text = document.createElement('div');
    _text.style.position = 'absolute';
    _text.style.top = '50%';
    _text.style.left = '50%';
    _text.style.transform = 'translate(-50%, -50%)';
    _text.style.color = 'orange'; // Textfarbe
    _text.style.textAlign = 'center';
    _text.style.fontSize = '50px'; // Ändere die Schriftgröße hier
    _text.style.lineHeight = '1';
    _text.style.zIndex = '1001';
    const _autoScanText = document.getElementById('ave-autoscan-text');
    if (!_autoScanText) {
        _text.innerHTML = `<p id="ave-autoscan-text">${text}</p>`;
    } else {
        _autoScanText.textContent = text;
    }

    document.body.appendChild(_overlay);
    document.body.appendChild(_text);
}

function updateAutoScanScreenText(text = '') {
    const _elem = document.getElementById('ave-autoscan-text');
    _elem.textContent = text;
}

// Populate settings only once per render to avoid duplicates on re-open.
/**
 * Fill the settings container with controls defined in SETTINGS_USERCONFIG_DEFINES.
 */
function populateSettingsContainer() {
    const _settingsContent = document.body.querySelector('[data-a-name="ave-settings"]');
    if (!_settingsContent) return;
    const _settingsContainer = _settingsContent.querySelector('#ave-settings-container');
    if (!_settingsContainer) return;
    if (_settingsContainer.getAttribute('data-ave-populated') === '1') return;

    _settingsContainer.innerHTML = '';
    for (const elem of SETTINGS_USERCONFIG_DEFINES) {
        if (SETTINGS.DebugLevel > 1) console.log('Creating Settings Menu Element: ', elem);
        _settingsContainer.appendChild(createSettingsMenuElement(elem));
    }
    _settingsContainer.setAttribute('data-ave-populated', '1');
}

/**
 * Inject the AVE settings tab into the Vine navigation bar.
 */
function addAveSettingsTab() {
    waitForHtmlElement('.vvp-tab-set-container > ul', (_upperButtonsContainer) => {
        if (!_upperButtonsContainer) return;

        const _upperSettingsButton = document.createElement('li');
        _upperSettingsButton.id = 'vvp-ave-settings-tab';
        _upperSettingsButton.classList = 'a-tab-heading';
        _upperSettingsButton.role = 'presentation';
        _upperSettingsButton.innerHTML += `<a role="tab" aria-selected="false" tabindex="-1">${translate('buttons', 'settingsTab', 'AVE Einstellungen')}</a>`;

        _upperSettingsButton.addEventListener('click', function () {
            const _upperButtons = document.body.querySelectorAll('.a-tab-container.vvp-tab-set-container > ul > li');
            _upperButtons.forEach((element) => element.classList.remove('a-active'));

            const _contentContainer = document.body.querySelectorAll('.a-tab-container.vvp-tab-set-container > div');
            _contentContainer.forEach((element) => element.classList.add('a-hidden'));
            if (SETTINGS.DebugLevel > 1) console.log(_contentContainer);

            _upperSettingsButton.classList.add('a-active');
            const _settingsContent = document.body.querySelector('[data-a-name="ave-settings"]');
            _settingsContent.classList.remove('a-hidden');

            populateSettingsContainer();
        });

        _upperButtonsContainer.appendChild(_upperSettingsButton);
    });
}

/**
 * Build the settings panel container and insert it into the tab set.
 */
/**
 * The CSS of the settings menu.
 *
 * NOTE: The CSS was a template literal inside addAVESettingsMenu(). It was moved
 * into its own constant, because the function was mostly CSS and the linter
 * counted the whole block as function lines.
 */
const AVE_SETTINGS_CSS = `
:root {
  --toggleSliderSize: 1;
  --numberBorder: 1px;
  --numberPadding: 2px;
  --itemHeight: 21px;
}
.ave-settings-container {
  display: grid;
}

.ave-settings-container label {
  padding: 0;
}

.ave-settings-container input[type="number"] {
  width: 75px;
  height: 21px;
  border: var(--numberBorder) solid #888C8C;
  padding: var(--numberPadding);
}

.ave-settings-container input[type="color"] {
  width: 30px;
  padding: 0;
  border: 1px solid darkgrey;
  border-radius: 6px;
  cursor: pointer;
  height: var(--itemHeight);
}

.ave-settings-container input[type="text"] {
  width: 500px;
}

.ave-settings-item{
  display: inline-flex;
  align-items: center;
  margin: 5px 0;
  height: var(--itemHeight);
}

.ave-item-left {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ave-item-right {

}

.ave-item-right > label {

}

.ave-settings-item > * >.ave-settings-label-setting {
  margin-left: 5px;
}

.ave-settings-item > * >.ave-settings-label-setting:hover{
  color: red;
}

/* Add this attribute to the element that needs a tooltip */
[data-ave-tooltip] {
  position: relative;
  z-index: 2;
  cursor: pointer;
}

/* Hide the tooltip content by default */
[data-ave-tooltip]:before,
[data-ave-tooltip]:after {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

/* Position tooltip above the element */
[data-ave-tooltip]:before {
  position: absolute;
  bottom: -50%;
  /*left: calc(150% + 10px);*/
  margin-bottom: 5px;
  margin-left: calc(100% + 10px);
  padding: 7px;
  width: 160px;
  -webkit-border-radius: 3px;
  -moz-border-radius: 3px;
  border-radius: 3px;
  background-color: hsla(0, 0%, 20%, 0.9);
  color: #fff;
  content: attr(data-ave-tooltip);
  text-align: center;
  font-size: 14px;
  line-height: 1.2;
}

/* Triangle hack to make tooltip look like a speech bubble */
[data-ave-tooltip]:after {
  position: absolute;
  bottom: 25%;
  /*left: 50%;*/
  margin-left: calc(0% + 5px);
  width: 0;
  border-right: 5px solid hsla(0, 0%, 20%, 0.9);
  border-bottom: 5px solid transparent;
  border-top: 5px solid transparent;
  content: " ";
  font-size: 0;
  line-height: 0;
}

/* Show tooltip content on hover */
[data-ave-tooltip]:hover:before,
[data-ave-tooltip]:hover:after,
[data-ave-tooltip]:focus-within:before,
[data-ave-tooltip]:focus-within:after{
  visibility: visible;
  opacity: 1;
}

.ave-settings-label-switch{
  position: relative;
  display: inline-block;
  width: calc(var(--toggleSliderSize) * 30px);
  height: calc(var(--toggleSliderSize) * 17px);
}

.ave-settings-switch-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: calc(var(--toggleSliderSize) * 17px);
}

.ave-settings-switch-toggle-slider:before{
  position: absolute;
  content: "";
  height: calc(var(--toggleSliderSize) * 13px);
  width: calc(var(--toggleSliderSize) * 13px);
  left: calc(var(--toggleSliderSize) * 2px);
  bottom: calc(var(--toggleSliderSize) * 2px);
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .ave-settings-switch-toggle-slider {
  background-color: #2196F3;
}

input:checked + .ave-settings-switch-toggle-slider:before {
  transform: translateX(calc(var(--toggleSliderSize) * 13px));
}

.ave-settings-label-switch input{
  display: none
}

.ave-keyword-wrapper {
  margin: 25px 0;
}

.ave-keyword-input {
  width: fit-content;
}

.ave-keyword-input button {
font-weight: bold;
}

.ave-keyword-list-wrapper {
  margin-top: 10px;
}

.ave-keyword-list-wrapper table {
  border-collapse: collapse;
  width: 500px;
}

.ave-keyword-list-wrapper > table td {
  border: 1px solid #000000;
  text-align: left;
  padding: 8px;
}

.ave-keyword-list-wrapper > table td:first-child {
  width: 25px;
  text-align: center;
  vertical-align: middle;
}

.ave-keyword-list-wrapper > table tr:nth-child(even) {
  background-color: #dddddd;
}

.ave-keyword-list-wrapper #list-delete {
  width: 75px;
  text-align: center;
}

.ave-keyword-list-wrapper > table button {
  display: flex;
  margin: auto;
  background-color: inherit;
  border: none;
}

.ave-input-button {
  border: none;
  background: none;
  margin: 3px;
}

::-webkit-color-swatch-wrapper {
  padding: 0;
}

::-webkit-color-swatch{
  border: 0;
  border-radius: 5px;
}

::-moz-color-swatch,
::-moz-focus-inner{
  border: 0;
}

::-moz-focus-inner{
  padding: 0;
}
`;

function addAVESettingsMenu() {
    waitForHtmlElement('.a-tab-container.vvp-tab-set-container', (_tabContainer) => {
        if (!_tabContainer) return;

        //const _tabContainer = document.body.querySelector('.a-tab-container.vvp-tab-set-container');

        const _boxContainer = document.createElement('div');
        _boxContainer.setAttribute('data-a-name', 'ave-settings');
        _boxContainer.classList = 'a-box a-box-tab a-tab-content a-hidden';
        _boxContainer.role = 'tabpanel';
        _boxContainer.tabindex = '0';

        const _contentContainer = document.createElement('div');
        _contentContainer.classList = 'a-box-inner';

        _boxContainer.appendChild(_contentContainer);
        _tabContainer.appendChild(_boxContainer);

        // After a language change reload, restore the settings tab view.
        if (localStorage.getItem('AVE_OPEN_SETTINGS_TAB') === '1') {
            localStorage.removeItem('AVE_OPEN_SETTINGS_TAB');
            waitForHtmlElement('#vvp-ave-settings-tab', (_settingsTab) => {
                if (_settingsTab) {
                    _settingsTab.click();
                }
            });
        }

        _contentContainer.innerHTML = `
    <style>
${AVE_SETTINGS_CSS}
    </style>

    <div id="ave-settings-header" style="margin-bottom: 10px"><h3>${translate('settings', 'header', `Einstellungen ${AVE_TITLE} - Version ${AVE_VERSION}`, AVE_TITLE, AVE_VERSION)}</h3></div>
    <div id="ave-settings-container" class="ave-settings-container">


</div>
    `;

        // Ensure the container exists before populating controls.
        waitForHtmlElement(
            '#ave-settings-container',
            () => {
                populateSettingsContainer();
            },
            _contentContainer
        );
    });
}
/**
 * Creates the left part of a settings item (the input control).
 * @param {string} className The CSS class of the created div
 * @returns {Element} The created div
 */
function createSettingsItemLeft(className = 'ave-item-left') {
    const _elem = document.createElement('div');
    _elem.classList.add(className);
    return _elem;
}

/**
 * Creates the right part of a settings item (the label with the tooltip).
 * @param {string} labelName The name of the setting
 * @param {string} labelDescription The description of the setting
 * @returns {Element} The created div
 */
function createSettingsItemRight(labelName, labelDescription) {
    const _elem = document.createElement('div');
    _elem.classList.add('ave-item-right');
    _elem.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${labelDescription}">${labelName}</label>`;
    return _elem;
}

/**
 * Creates a settings item with a switch.
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 * @param {string} _labelName The name of the setting
 * @param {string} _labelDescription The description of the setting
 */
function createSettingsBoolElement(dat, _elem, _labelName, _labelDescription) {
    const _elem_item_left = createSettingsItemLeft();
    const _elem_item_left_label = document.createElement('label');
    _elem_item_left_label.classList.add('ave-settings-label-switch');
    const _elem_item_left_label_input = document.createElement('input');
    _elem_item_left_label_input.type = 'checkbox';
    _elem_item_left_label_input.className = 'ave-input-binary';
    _elem_item_left_label_input.setAttribute('ave-data-key', dat.key);
    _elem_item_left_label_input.checked = SETTINGS[dat.key];
    _elem_item_left_label_input.addEventListener('click', (event) => {
        console.log('This is a Boolean Value Input', event);
        SETTINGS[dat.key] = event.target.checked;
        SETTINGS.save();
    });

    const _elem_item_left_label_span = document.createElement('span');
    _elem_item_left_label_span.classList.add('ave-settings-switch-toggle-slider');

    _elem_item_left_label.appendChild(_elem_item_left_label_input);
    _elem_item_left_label.appendChild(_elem_item_left_label_span);
    _elem_item_left.appendChild(_elem_item_left_label);
    _elem.appendChild(_elem_item_left);

    _elem.appendChild(createSettingsItemRight(_labelName, _labelDescription));
}

/**
 * Creates a settings item with a password input.
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 * @param {string} _labelName The name of the setting
 * @param {string} _labelDescription The description of the setting
 */
function createSettingsPasswordElement(dat, _elem, _labelName, _labelDescription) {
    const _elem_item_left = createSettingsItemLeft();
    const _elem_item_left_input = document.createElement('input');
    _elem_item_left_input.type = 'password';
    _elem_item_left_input.className = 'ave-input-number';
    _elem_item_left_input.style.width = '300px';
    _elem_item_left_input.setAttribute('ave-data-key', dat.key);
    _elem_item_left_input.setAttribute('value', SETTINGS[dat.key]);
    _elem_item_left_input.setAttribute('value', SETTINGS[dat.key]);
    _elem_item_left_input.addEventListener('change', (event) => {
        console.log('This is a Password Value Input', event);

        SETTINGS[dat.key] = event.target.value;
        SETTINGS.save();
    });
    _elem_item_left.appendChild(_elem_item_left_input);
    _elem.appendChild(_elem_item_left);

    _elem.appendChild(createSettingsItemRight(_labelName, _labelDescription));
}

/**
 * Creates a settings item with an URL input.
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 * @param {string} _labelName The name of the setting
 * @param {string} _labelDescription The description of the setting
 */
function createSettingsUrlElement(dat, _elem, _labelName, _labelDescription) {
    const _elem_item_left = createSettingsItemLeft();
    const _elem_item_left_input = document.createElement('input');
    _elem_item_left_input.type = 'url';
    _elem_item_left_input.className = 'ave-input-number';
    _elem_item_left_input.style.width = '300px';
    _elem_item_left_input.setAttribute('ave-data-key', dat.key);
    _elem_item_left_input.setAttribute('value', SETTINGS[dat.key]);
    _elem_item_left_input.addEventListener('change', (event) => {
        console.log('This is a URL Value Input', event);

        let _url = event.target.value;
        if (_url.length > 0) {
            if (!_url.endsWith('/')) _url = _url + '/';
            if (!(_url.startsWith('http://') || _url.startsWith('https://'))) _url = 'https://' + _url;
        }
        event.target.value = _url;
        SETTINGS[dat.key] = event.target.value;
        SETTINGS.save();
    });
    _elem_item_left.appendChild(_elem_item_left_input);
    _elem.appendChild(_elem_item_left);

    _elem.appendChild(createSettingsItemRight(_labelName, _labelDescription));
}

/**
 * Creates a settings item with a number input.
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 * @param {string} _labelName The name of the setting
 * @param {string} _labelDescription The description of the setting
 */
function createSettingsNumberElement(dat, _elem, _labelName, _labelDescription) {
    const _elem_item_left = createSettingsItemLeft();
    const _elem_item_left_input = document.createElement('input');
    _elem_item_left_input.type = 'number';
    _elem_item_left_input.className = 'ave-input-number';
    _elem_item_left_input.setAttribute('ave-data-key', dat.key);
    _elem_item_left_input.setAttribute('value', SETTINGS[dat.key]);
    if (!isNaN(dat.min)) _elem_item_left_input.setAttribute('min', dat.min);
    if (!isNaN(dat.max)) _elem_item_left_input.setAttribute('max', dat.max);
    _elem_item_left_input.addEventListener('change', (event) => {
        const _value = event.target.value;
        const _min = parseFloat(event.target.min);
        const _max = parseFloat(event.target.max);
        console.log('This is a Number Value Input', event);

        if (_value <= _max && _value >= _min) {
            console.log('Eingabe Valid');
            SETTINGS[dat.key] = parseInt(event.target.value);
            SETTINGS.save();
        } else {
            console.log('Eingabe Fehlerhaft');
        }
    });
    _elem_item_left_input.addEventListener('input', (event) => {
        const _value = event.target.value;
        const _min = parseFloat(event.target.min);
        const _max = parseFloat(event.target.max);

        if (_value <= _max && _value >= _min) {
            event.target.style.borderColor = 'inherit';
            event.target.style.color = 'inherit';
        } else {
            event.target.style.borderColor = 'red';
            event.target.style.color = 'red';
        }
    });
    _elem_item_left.appendChild(_elem_item_left_input);
    _elem.appendChild(_elem_item_left);

    _elem.appendChild(createSettingsItemRight(_labelName, _labelDescription));
}

/**
 * Creates a settings item with a button.
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 * @param {string} _labelName The name of the setting
 * @param {string} _labelDescription The description of the setting
 */
function createSettingsButtonElement(dat, _elem, _labelName, _labelDescription) {
    const _elem_item_left = createSettingsItemLeft();

    const _elem_item_left_input_label = document.createElement('label');
    _elem_item_left_input_label.setAttribute('data-ave-tooltip', _labelDescription);
    _elem_item_left_input_label.setAttribute('class', 'a-button');
    _elem_item_left_input_label.style.width = '250px';
    if (dat.bgColor) _elem_item_left_input_label.style.backgroundColor = dat.bgColor;
    const _elem_item_left_input = document.createElement('button');
    _elem_item_left_input.type = 'button';
    _elem_item_left_input.className = 'ave-input-button';

    _elem_item_left_input.innerText = _labelName;
    _elem_item_left_input.addEventListener('click', (event) => {
        console.log('This is a button Input', event);
        if (dat.btnClick) dat.btnClick();
    });

    _elem_item_left_input_label.appendChild(_elem_item_left_input);
    _elem_item_left.appendChild(_elem_item_left_input_label);
    _elem.appendChild(_elem_item_left);
}

/**
 * Creates a settings item with a color input.
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 */
function createSettingsColorElement(dat, _elem) {
    const _elem_item_left = createSettingsItemLeft();
    const _elem_item_left_input = document.createElement('input');
    _elem_item_left_input.type = 'color';
    _elem_item_left_input.className = 'ave-input-color';
    _elem_item_left_input.setAttribute('ave-data-key', dat.key);
    _elem_item_left_input.setAttribute('value', colorToHex(SETTINGS[dat.key]));
    _elem_item_left_input.addEventListener('change', (event) => {
        console.log('This is a Color Value Input', event);
        SETTINGS[dat.key] = event.target.value;
        SETTINGS.save();
    });
    _elem_item_left.appendChild(_elem_item_left_input);
    _elem.appendChild(_elem_item_left);

    const _elem_item_right = document.createElement('div');
    _elem_item_right.classList.add('ave-item-right');
    _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${dat.description && dat.description != '' ? dat.description : dat.name}">${dat.name}</label>`;

    _elem.appendChild(_elem_item_right);
}

/**
 * Creates a settings item with a select dropdown.
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 */
function createSettingsSelectElement(dat, _elem) {
    const _elem_item_left = createSettingsItemLeft();
    const _elem_item_left_input = document.createElement('select');
    _elem_item_left_input.className = 'ave-input-number';
    _elem_item_left_input.style.width = '300px';
    _elem_item_left_input.style.height = '21px';
    _elem_item_left_input.setAttribute('ave-data-key', dat.key);

    if (dat.options && Array.isArray(dat.options)) {
        dat.options.forEach((opt) => {
            const _option = document.createElement('option');
            _option.value = opt;
            _option.textContent = opt;
            _option.selected = opt === SETTINGS[dat.key];
            _elem_item_left_input.appendChild(_option);
        });
    }

    _elem_item_left_input.addEventListener('change', (event) => {
        console.log('This is a Select Input', event);
        SETTINGS[dat.key] = event.target.value;
        SETTINGS.save();
        if (dat.key === 'UI_LANGUAGE') {
            localStorage.setItem('AVE_OPEN_SETTINGS_TAB', '1');
            window.location.reload();
        }
    });
    _elem_item_left.appendChild(_elem_item_left_input);
    _elem.appendChild(_elem_item_left);

    const _elem_item_right = document.createElement('div');
    _elem_item_right.classList.add('ave-item-right');
    const _labelName = dat.key === 'UI_LANGUAGE' ? translate('settings', 'languageLabel', 'Sprache') : dat.name;
    const _labelDescription = dat.description && dat.description != '' ? dat.description : _labelName;
    _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${_labelDescription}">${_labelName}</label>`;

    _elem.appendChild(_elem_item_right);
}

/**
 * Creates a settings item that is only a title (a separator between the sections).
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 * @param {string} _labelName The name of the setting
 */
function createSettingsTitleElement(dat, _elem, _labelName) {
    const _elem_spacer_horizontal = document.createElement('hr');
    _elem_spacer_horizontal.style.width = '100%';

    const _elem_spacer_title = document.createElement('h4');
    _elem_spacer_title.textContent = _labelName;

    _elem.style.height = 'fit-content';
    _elem.style.display = 'flex';
    _elem.style.flexWrap = 'wrap';
    _elem.appendChild(_elem_spacer_horizontal);
    _elem.appendChild(_elem_spacer_title);
}

/**
 * Creates the list of the keywords of a setting.
 * @param {object} dat The definition of the setting
 * @returns {Element} The created list
 */
function createSettingsKeywordsList(dat) {
    const _elem_keyword_list = document.createElement('div');
    _elem_keyword_list.classList.add('ave-keyword-list-wrapper');
    const _elem_keyword_list_table = document.createElement('table');
    const _elem_keyword_list_table_tbody = document.createElement('tbody');
    _elem_keyword_list_table_tbody.setAttribute('id', dat.key);
    for (let i = 0; i < SETTINGS[dat.key].length; i++) {
        _elem_keyword_list_table_tbody.appendChild(createSettingsKeywordsTableElement(dat, i, SETTINGS[dat.key][i]));
    }
    _elem_keyword_list_table.appendChild(_elem_keyword_list_table_tbody);
    _elem_keyword_list.appendChild(_elem_keyword_list_table);
    return _elem_keyword_list;
}

/**
 * Writes the keywords of a setting back into the settings and rebuilds the list.
 * @param {object} dat The definition of the setting
 */
function updateSettingsKeywordsList(dat) {
    const _table = document.getElementById(dat.key);
    _table.innerHTML = '';
    for (let i = 0; i < SETTINGS[dat.key].length; i++) {
        _table.appendChild(createSettingsKeywordsTableElement(dat, i, SETTINGS[dat.key][i]));
    }
}

/**
 * Creates a settings item with a textarea for the keywords.
 * @param {object} dat The definition of the setting
 * @param {Element} _elem The element of the setting
 * @param {string} _labelName The name of the setting
 * @param {string} _labelDescription The description of the setting
 * @param {string} _inputPlaceholder The placeholder of the textarea
 */
function createSettingsKeywordsElement(dat, _elem, _labelName, _labelDescription, _inputPlaceholder) {
    if (SETTINGS[dat.key].length > 0) {
        SETTINGS[dat.key].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }

    _elem.classList.remove('ave-settings-item');
    _elem.classList.add('ave-keyword-wrapper');
    _elem.innerHTML = `<h4>${_labelName}</h4>`;
    const _elem_keyword_input = document.createElement('div');
    _elem_keyword_input.innerHTML = '<span></span>';
    _elem_keyword_input.classList.add('ave-keyword-input');

    const _elem_keyword_input_label = document.createElement('label');
    _elem_keyword_input_label.setAttribute('data-ave-tooltip', _labelDescription);

    const _elem_keyword_input_input = document.createElement('textarea');
    _elem_keyword_input_input.setAttribute('cols', 70);
    _elem_keyword_input_input.setAttribute('rows', 1);
    _elem_keyword_input_input.setAttribute('placeholder', _inputPlaceholder || dat.inputPlaceholder);
    _elem_keyword_input_input.addEventListener('change', (elm, ev) => {
        if (SETTINGS.DebugLevel > 1) console.log('EVENTHANDLER CHANGE:', elm, 'event:', ev);
        const _value = elm.target.value.trim();
        if (_value && _value.length > 0) {
            for (let _key of _value.split('\n')) {
                _key = _key.trim();
                if (_key.length === 0) {
                    continue;
                }
                if (!SETTINGS[dat.key].includes(_key)) {
                    SETTINGS[dat.key].push(_key);
                }
            }
        }
        SETTINGS.save();
        elm.target.value = '';
        updateSettingsKeywordsList(dat);
    });
    _elem_keyword_input_label.appendChild(_elem_keyword_input_input);
    _elem_keyword_input.appendChild(_elem_keyword_input_label);
    _elem.appendChild(_elem_keyword_input);

    _elem.appendChild(createSettingsKeywordsList(dat));
}

/**
 * Create a settings UI element based on its definition.
 * @param {object} dat
 * @returns {Element}
 */
function createSettingsMenuElement(dat) {
    const _labelKey = dat.key || dat.name;
    const _labelName = translate('settingsLabels', _labelKey, dat.name || '');
    const _labelDescription = translate('settingsDescriptions', _labelKey, dat.description || _labelName || '');
    const _inputPlaceholder = dat.inputPlaceholder ? translate('settingsPlaceholders', _labelKey, dat.inputPlaceholder) : '';

    const _elem = document.createElement('div');
    if (dat.key) _elem.setAttribute('ave-config-key', dat.key);
    _elem.classList.add('ave-settings-item');

    switch (dat.type) {
        case 'bool':
            createSettingsBoolElement(dat, _elem, _labelName, _labelDescription);
            break;
        case 'password':
            createSettingsPasswordElement(dat, _elem, _labelName, _labelDescription);
            break;
        case 'url':
            createSettingsUrlElement(dat, _elem, _labelName, _labelDescription);
            break;
        case 'number':
            createSettingsNumberElement(dat, _elem, _labelName, _labelDescription);
            break;
        case 'button':
            createSettingsButtonElement(dat, _elem, _labelName, _labelDescription);
            break;
        case 'color':
            createSettingsColorElement(dat, _elem);
            break;
        case 'select':
            createSettingsSelectElement(dat, _elem);
            break;
        case 'title':
            createSettingsTitleElement(dat, _elem, _labelName);
            break;
        case 'keywords':
            createSettingsKeywordsElement(dat, _elem, _labelName, _labelDescription, _inputPlaceholder);
            break;
    }

    return _elem;
}

function createSettingsKeywordsTableElement(dat, index, entry) {
    const _tableRow = document.createElement('tr');
    _tableRow.setAttribute('index', index);
    const _tableRow_td1 = document.createElement('td');
    const _tableRow_td1_button = document.createElement('button');
    _tableRow_td1_button.innerHTML = `<i class="a-icon a-icon-close"></i>`;
    _tableRow_td1_button.setAttribute('ave-data-keyword', entry);
    _tableRow_td1_button.addEventListener('click', (elm, ev) => {
        SETTINGS[dat.key].splice(index, 1);
        SETTINGS.save();
        const _table = document.getElementById(dat.key);
        _table.innerHTML = '';
        for (let i = 0; i < SETTINGS[dat.key].length; i++) {
            _table.appendChild(createSettingsKeywordsTableElement(dat, i, SETTINGS[dat.key][i]));
        }
    });
    _tableRow_td1.appendChild(_tableRow_td1_button);
    _tableRow.appendChild(_tableRow_td1);
    const _tableRow_td2 = document.createElement('td');
    _tableRow_td2.innerText = entry;
    _tableRow.appendChild(_tableRow_td2);
    return _tableRow;
}

function componentToHex(c) {
    const _c = Math.min(c, 255);
    const _hex = _c.toString(16);
    return _hex.length == 1 ? '0' + _hex : _hex;
}

function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function rgbaToHex(r, g, b, a) {
    return '#' + componentToHex(a) + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function colorToHex(color) {
    const _color = color.replace(/\s/g, ''); // Remove all spaces
    let _cache;

    if (_color == 'white') {
        return '#ffffff';
    } else if (_color == 'black') {
        return '#000000';
    } else if ((_cache = /rgb\(([\d]+),([\d]+),([\d]+)\)/.exec(_color))) {
        // rgb(0,0,0)
        return rgbToHex(_cache[1], _cache[2], _cache[3]);
    } else if ((_cache = /rgba\(([\d]+),([\d]+),([\d]+),([\d]+|[\d]*.[\d]+)\)/.exec(_color))) {
        // rgba(0,0,0,0)
        return rgbaToHex(_cache[1], _cache[2], _cache[3], _cache[4]);
    } else if (/#[0-9a-fA-F]{6}|[0-9a-fA-F]{8}$/.exec(_color)) {
        // #000000
        return _color;
    }
}

unsafeWindow.ave.colorToHex = colorToHex;

function addDBCleaningSymbol() {
    const _cleaningDiv = document.createElement('div');
    _cleaningDiv.style.width = '25px';
    _cleaningDiv.style.height = '25px';
    // _cleaningDiv.style.position = 'absolute';
    _cleaningDiv.style.position = 'fixed';
    _cleaningDiv.style.zIndex = '9999';
    _cleaningDiv.style.left = '10px';
    _cleaningDiv.style.bottom = '35px';

    _cleaningDiv.innerHTML = `
    <style>
    .ave-db {
    }
    .ave-cleaning {
      transform: translate(35%, -140%) scale(0.7);
    }
    .ave-cleaning svg {
      animation: rotate 2s linear infinite;
    }
    @keyframes rotate {
      0% {
        transform: translateX(-100%);
      }
      50% {
        transform: translateX(0);
      }
      100% {
        transform: translateX(-100%);
      }
    }
    </style>
    <div id="dbVector" class="ave-db"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M20 18C20 20.2091 16.4183 22 12 22C7.58172 22 4 20.2091 4 18V13.974C4.50221 14.5906 5.21495 15.1029 6.00774 15.4992C7.58004 16.2854 9.69967 16.75 12 16.75C14.3003 16.75 16.42 16.2854 17.9923 15.4992C18.7851 15.1029 19.4978 14.5906 20 13.974V18Z" fill="#1C274C"></path> <path d="M12 10.75C14.3003 10.75 16.42 10.2854 17.9923 9.49925C18.7851 9.10285 19.4978 8.59059 20 7.97397V12C20 12.5 18.2143 13.5911 17.3214 14.1576C15.9983 14.8192 14.118 15.25 12 15.25C9.88205 15.25 8.00168 14.8192 6.67856 14.1576C5.5 13.5683 4 12.5 4 12V7.97397C4.50221 8.59059 5.21495 9.10285 6.00774 9.49925C7.58004 10.2854 9.69967 10.75 12 10.75Z" fill="#1C274C"></path> <path d="M17.3214 8.15761C15.9983 8.81917 14.118 9.25 12 9.25C9.88205 9.25 8.00168 8.81917 6.67856 8.15761C6.16384 7.95596 5.00637 7.31492 4.2015 6.27935C4.06454 6.10313 4.00576 5.87853 4.03988 5.65798C4.06283 5.50969 4.0948 5.35695 4.13578 5.26226C4.82815 3.40554 8.0858 2 12 2C15.9142 2 19.1718 3.40554 19.8642 5.26226C19.9052 5.35695 19.9372 5.50969 19.9601 5.65798C19.9942 5.87853 19.9355 6.10313 19.7985 6.27935C18.9936 7.31492 17.8362 7.95596 17.3214 8.15761Z" fill="#1C274C"></path> </g></svg></div>
    <div id="loadingVector" class="ave-cleaning"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg></div>
    `;
    //Vector used
    //Vector DB: https://www.svgrepo.com/svg/525311/database
    //Vector Lupe: https://www.svgrepo.com/svg/532552/search-alt-2
    document.body.appendChild(_cleaningDiv);
    return _cleaningDiv;
}

function addDBLoadingSymbol() {
    const _loadingDiv = document.createElement('div');
    _loadingDiv.style.width = '25px';
    _loadingDiv.style.height = '25px';
    // _loadingDiv.style.position = 'absolute';
    _loadingDiv.style.position = 'fixed';
    _loadingDiv.style.zIndex = '9999';
    _loadingDiv.style.left = '10px';
    _loadingDiv.style.bottom = '35px';

    _loadingDiv.innerHTML = `
    <style>
    .ave-db {
    }
    .ave-loading {
      transform: translate(35%, -140%) scale(0.7);
    }
    .ave-loading svg {
      animation: rotate 1s linear infinite;
    }
    @keyframes rotate {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
    </style>
    <div id="dbVector" class="ave-db"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M20 18C20 20.2091 16.4183 22 12 22C7.58172 22 4 20.2091 4 18V13.974C4.50221 14.5906 5.21495 15.1029 6.00774 15.4992C7.58004 16.2854 9.69967 16.75 12 16.75C14.3003 16.75 16.42 16.2854 17.9923 15.4992C18.7851 15.1029 19.4978 14.5906 20 13.974V18Z" fill="#1C274C"></path> <path d="M12 10.75C14.3003 10.75 16.42 10.2854 17.9923 9.49925C18.7851 9.10285 19.4978 8.59059 20 7.97397V12C20 12.5 18.2143 13.5911 17.3214 14.1576C15.9983 14.8192 14.118 15.25 12 15.25C9.88205 15.25 8.00168 14.8192 6.67856 14.1576C5.5 13.5683 4 12.5 4 12V7.97397C4.50221 8.59059 5.21495 9.10285 6.00774 9.49925C7.58004 10.2854 9.69967 10.75 12 10.75Z" fill="#1C274C"></path> <path d="M17.3214 8.15761C15.9983 8.81917 14.118 9.25 12 9.25C9.88205 9.25 8.00168 8.81917 6.67856 8.15761C6.16384 7.95596 5.00637 7.31492 4.2015 6.27935C4.06454 6.10313 4.00576 5.87853 4.03988 5.65798C4.06283 5.50969 4.0948 5.35695 4.13578 5.26226C4.82815 3.40554 8.0858 2 12 2C15.9142 2 19.1718 3.40554 19.8642 5.26226C19.9052 5.35695 19.9372 5.50969 19.9601 5.65798C19.9942 5.87853 19.9355 6.10313 19.7985 6.27935C18.9936 7.31492 17.8362 7.95596 17.3214 8.15761Z" fill="#1C274C"></path> </g></svg></div>
    <div id="loadingVector" class="ave-loading"><svg viewBox="-0.8 -0.8 17.60 17.60" xmlns="http://www.w3.org/2000/svg" fill="none" class="hds-flight-icon--animation-loading" stroke="#000000" stroke-width="0.8"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g fill="#000000" fill-rule="evenodd" clip-rule="evenodd"> <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z" opacity=".2"></path> <path d="M7.25.75A.75.75 0 018 0a8 8 0 018 8 .75.75 0 01-1.5 0A6.5 6.5 0 008 1.5a.75.75 0 01-.75-.75z"></path> </g> </g></svg></div>
    `;
    //Vector used
    //Vector DB: https://www.svgrepo.com/svg/525311/database
    //Vector Loading: https://www.svgrepo.com/svg/448500/loading
    document.body.appendChild(_loadingDiv);
    return _loadingDiv;
}

function addLoadingSymbol() {
    const _loadingDiv = document.createElement('div');
    _loadingDiv.style.width = '25px';
    _loadingDiv.style.height = '25px';
    // _loadingDiv.style.position = 'absolute';
    _loadingDiv.style.position = 'fixed';
    _loadingDiv.style.zIndex = '9999';
    _loadingDiv.style.left = '10px';
    _loadingDiv.style.bottom = '35px';

    _loadingDiv.innerHTML = `
    <style>
    .ave-db {
    }
    .ave-loading {

    }
    .ave-loading svg {
      animation: rotate 2s linear infinite;
    }
    @keyframes rotate {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(-360deg);
      }
    }
    </style>
    <div id="loadingVector" class="ave-loading"><svg fill="none" viewBox="0 0 24 24" id="update-alt" data-name="Line Color" xmlns="http://www.w3.org/2000/svg" class="icon line-color"><path id="primary" d="M5.07,8A8,8,0,0,1,20,12" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path><path id="primary-2" data-name="primary" d="M18.93,16A8,8,0,0,1,4,12" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path><polyline id="secondary" points="5 3 5 8 10 8" style="fill: none; stroke: rgb(44, 169, 188); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline><polyline id="secondary-2" data-name="secondary" points="19 21 19 16 14 16" style="fill: none; stroke: rgb(44, 169, 188); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline></svg></div>
    `;
    //Vector used
    //Vector DB: https://www.svgrepo.com/svg/525311/database
    //Vector Loading: https://www.svgrepo.com/svg/448500/loading
    document.body.appendChild(_loadingDiv);
    return _loadingDiv;
}

function getPageinationData(localDocument = document) {
    if (SETTINGS.DebugLevel > 10) console.log('Called getPageinationData()');
    const _ret = new Object();
    const _paginationContainer = localDocument.querySelector('.a-pagination');
    if (!_paginationContainer) return;
    if (!_paginationContainer.lastChild) return;

    let _currChild = _paginationContainer.lastChild;

    while ((!_ret.href || !_ret.maxPage) && _currChild) {
        const _curr = _currChild.firstChild;

        if (_curr && typeof _curr.hasAttribute === 'function') {
            if (_curr.hasAttribute('href')) _ret.href = _curr.getAttribute('href').replace(/=[0-9]+/, '=');
            if (parseInt(_curr.text)) _ret.maxPage = parseInt(_curr.text);
        }
        _currChild = _currChild.previousSibling;
    }
    return _ret;
}

/**
 * Cleans up and fixes a single entry of the database.
 *
 * @param {Product} _currEntry The entry to check
 * @param {object} _limits The cleanup limits of the current run
 * @returns {Promise<string>} Resolves with "deleted" or "updated", or with an
 *                           empty string if nothing was written.
 */
async function cleanUpDatabaseEntry(_currEntry, _limits) {
    const { vendorCleanupDate, normalCleanupDate, secondsBeforeCleanup, currentTimeStamp } = _limits;
    let _needUpdate = false;
    if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Checking Entry ${_currEntry.id} `);

    // Checking Product Vars
    if (!_currEntry.ts_firstSeen) {
        _currEntry.ts_firstSeen = unixTimeStamp() - Math.round(Math.random() * (SECONDS_PER_WEEK / 2));
        _needUpdate = true;
        if (SETTINGS.DebugLevel > 14) console.log(`cleanUpDatabase() - Entry ${_currEntry.id} had no valid firstseen timestamp. fixed`);
    }

    if (!_currEntry.ts_lastSeen) {
        _currEntry.ts_lastSeen = _currEntry.ts_firstSeen + SECONDS_PER_DAY;
        _needUpdate = true;
        if (SETTINGS.DebugLevel > 14) console.log(`cleanUpDatabase() - Entry ${_currEntry.id} had no valid lastseen timestamp. fixed`);
    }

    let _notSeenCounter = _currEntry.notSeenCounter;
    if (_currEntry.data_recommendation_type == 'VENDOR_TARGETED' && _currEntry.ts_lastSeen < vendorCleanupDate) {
        // If PotLuck start revoving after 1 day
        _notSeenCounter++;
        if (SETTINGS.DebugLevel > 14)
            console.log(`cleanUpDatabase() - Entry ${_currEntry.id} increased notSeenCounter to ${_notSeenCounter}`);
    } else if (_currEntry.ts_lastSeen < normalCleanupDate) {
        // Normal Product Start Removing after 1 week
        _notSeenCounter++;
        if (SETTINGS.DebugLevel > 14)
            console.log(`cleanUpDatabase() - Entry ${_currEntry.id} increased notSeenCounter to ${_notSeenCounter}`);
    }

    if (_currEntry.notSeenCounter != _notSeenCounter) {
        if (SETTINGS.DebugLevel > 14)
            console.log(
                `cleanUpDatabase() - Entry ${_currEntry.id} update notSeenCounter from ${_currEntry.notSeenCounter} to ${_notSeenCounter}`
            );
        _currEntry.notSeenCounter = _notSeenCounter;
        _needUpdate = true;
    }

    const _hasToBeRemoved =
        ((_currEntry.notSeenCounter > 0 && currentTimeStamp - _currEntry.ts_lastSeen >= secondsBeforeCleanup) || _currEntry.forceRemove) &&
        (!_currEntry.isFav || SETTINGS.EnableCleanupFavorites);

    if (_hasToBeRemoved) {
        if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Removing Entry ${_currEntry.id}`);
        await database.removeID(_currEntry.id);
        return 'deleted';
    }
    if (_needUpdate) {
        await database.update(_currEntry);
        return 'updated';
    }
    return '';
}

/**
 * Cleans up and fixes the entries of the database.
 *
 * @returns {Promise<boolean>} Resolves with true if the cleanup was successful
 *                              and with false if the database could not be read.
 */
async function cleanUpDatabase() {
    if (SETTINGS.DebugLevel > 10) console.log('Called cleanUpDatabase()');
    const _dbCleanIcon = addDBCleaningSymbol();

    try {
        const _prodArr = await database.getAll();
        const _prodArrLength = _prodArr.length;
        if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Checking ${_prodArrLength} Entrys`);

        let _vendorCleanupDate = toUnixTimestamp(localStorage.getItem('AVE_CLEANUP_LAST_TIME') || 0);
        let _normalCleanupDate = _vendorCleanupDate;
        if (_vendorCleanupDate < unixTimeStamp() - SECONDS_PER_DAY) {
            // potluck removal starts at last cleanup time or after a day, whichever comes later
            _vendorCleanupDate = unixTimeStamp() - SECONDS_PER_DAY;
        }
        if (_normalCleanupDate < unixTimeStamp() - SECONDS_PER_WEEK) {
            // normal removal starts at last cleanup time or after 7 days, whichever comes later
            _normalCleanupDate = unixTimeStamp() - SECONDS_PER_WEEK;
        }

        const _limits = {
            vendorCleanupDate: _vendorCleanupDate,
            normalCleanupDate: _normalCleanupDate,
            secondsBeforeCleanup: SETTINGS.HoursBeforeCleanup * 3600,
            currentTimeStamp: unixTimeStamp()
        };

        const _results = await Promise.allSettled(
            _prodArr.map((_currEntry) =>
                cleanUpDatabaseEntry(_currEntry, _limits).catch((error) => {
                    // NOTE: A failed write must not stop the cleanup of the other entries.
                    console.error(`cleanUpDatabase(): could not process the entry ${_currEntry.id}: ${error}`);
                    return '';
                })
            )
        );

        const _updated = _results.filter((_r) => _r.value === 'updated').length;
        const _deleted = _results.filter((_r) => _r.value === 'deleted').length;

        if (SETTINGS.DebugLevel > 0)
            console.log(`Databasecleanup Finished: Entrys:${_prodArrLength} Updated:${_updated} Deleted:${_deleted}`);
        _dbCleanIcon.remove();
        // store current date
        localStorage.setItem('AVE_CLEANUP_LAST_TIME', Date.now());
        return true;
    } catch (error) {
        // The database could not be read. The symbol has to be removed anyway, otherwise
        // it would stay on the screen forever.
        console.error(`cleanUpDatabase(): could not read the database: ${error}`);
        _dbCleanIcon.remove();
        return false;
    }
}

unsafeWindow.ave.dbCleanup = cleanUpDatabase;

function exportDatabase() {
    console.log('Create Database Dump...');

    database.getAll().then((db) => {
        try {
            console.log('Creating db export JSON as BLOB (uncompressed)');
            const dbBlob = new Blob([JSON.stringify(db, null, 4)], { type: 'application/json;charset=utf-8' });

            console.log('Emulating download file using saveAs script to export JSON file (uncompressed)');
            saveAs(dbBlob, 'AmazonVineExplorerDatabase.json');
        } catch (error) {
            console.log('Oops, there was an error exporting AVE user database');
            console.log(error);
        }
    });
}

/**
 * Opens a file selector dialog and imports a database from a JSON file.
 * @async
 * @returns {Promise<void>}
 */
async function importDatabase() {
    return new Promise((resolve, reject) => {
        // Create an input element of type "file"
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';

        // Set up an event listener for when a file is selected
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];

            if (file) {
                const enableBackgroundScan = SETTINGS.EnableBackgroundScan;
                SETTINGS.EnableBackgroundScan = false;
                if (backGroundScanTimeout) {
                    console.log('Stopping background scan');
                    clearTimeout(backGroundScanTimeout);
                    backGroundScanTimeout = null;
                }

                try {
                    const jsonData = await readFile(file);
                    database
                        .import(jsonData)
                        .then(() => {
                            console.log('Data imported successfully.');
                            alert('Data imported successfully');
                            resolve();
                        })
                        .catch((error) => {
                            console.error('Error importing data:', error);
                            alert(`Error importing data: ${error}`);
                            reject(error);
                        })
                        .finally(() => {
                            SETTINGS.EnableBackgroundScan = enableBackgroundScan;
                            BackGroundScanIsRunning = false;
                            localStorage.setItem('AVE_BACKGROUND_SCAN_LAST_TIME', 0);
                            localStorage.setItem('AVE_BACKGROUND_SCAN_IS_RUNNING', false);
                            initBackgroundScan();
                        });
                } catch (error) {
                    SETTINGS.EnableBackgroundScan = enableBackgroundScan;
                    console.error('Error importing data:', error);
                    alert(`Error importing data: ${error}`);
                    reject(error);
                }
            }
        });

        // Trigger a click event to open the file selector dialog
        fileInput.click();
    });
}

unsafeWindow.ave.importDB = importDatabase;

/**
 * Reads the content of a file as text.
 * @param {File} file - The file to read.
 * @returns {Promise<string>} - A Promise that resolves to the file content as a string.
 */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                resolve(JSON.parse(event.target.result));
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsText(file);
    });
}

/**
 * Stops a running background scan.
 * Is used when this tab is not the master session (anymore).
 */
function stopBackgroundScan() {
    if (!BackGroundScanIsRunning) return;
    console.warn('stopBackgroundScan(): stopping the background scan');
    BackGroundScanIsRunning = false;
    if (backGroundScanTimeout) {
        clearTimeout(backGroundScanTimeout);
        backGroundScanTimeout = null;
    }
    // A running scan can leave its iframe behind, e.g. if the scan is stopped
    // while a page is loaded. The iframe holds the whole page in memory.
    removeScanIframe(document.getElementById('ave-iframe-backgroundloader'));
}

/**
 * The shared state of the background scan.
 *
 * The state outlives a single iteration of the scan loop, because the loop is
 * restarted with a delay after every scanned page.
 *
 * @typedef {object} BackgroundScanState
 * @property {boolean} loopIsWorking True while a page is being scanned
 * @property {number} stage The stage of the scan (0 - 4)
 * @property {number} subStage The current page inside the current stage
 * @property {number} pageMax The number of pages of the current queue
 * @property {string[]} stageZeroSites The queues that belong to the first stage
 */

/**
 * The values of a single iteration of the background scan loop.
 *
 * @typedef {object} BackgroundScanIteration
 * @property {number} startTime The start time of the iteration (performance.now)
 * @property {number} timeWaitingMS The milliseconds since the last finished scan
 * @property {number} timeWaitingMin The minutes since the last finished scan
 * @property {string} scannerName The name of the scanner for the screen text
 */

/**
 * Starts the background scan.
 *
 * The scan itself runs in a loop that is started with a delay and restarted
 * after every scanned page. The stages of the scan are handled by the
 * scanStage*() functions.
 */
function initBackgroundScan() {
    if (SETTINGS.DebugLevel > 10) console.log('Called initBackgroundScan()');
    if (BackGroundScanIsRunning) {
        console.warn('initBackgroundScan(): Backgroundscan is already running => Exit');
        return;
    }
    if (!SETTINGS.EnableBackgroundScan) {
        console.warn('initBackgroundScan(): Backgroundscan is disabled => Exit');
        return;
    }
    if (!AVE_IS_THIS_SESSION_MASTER) {
        console.warn('initBackgroundScan(): This Instance is not the Master Session! => don´t start BackgroundScan');
        return;
    }
    BackGroundScanIsRunning = true;
    /* NOTE: Same regex caveat as above: .exec() is safe because Amazon's Vine URLs
       are stable. If Amazon changes domains, AVE is broken regardless of this check. */
    const _baseUrl = /(http[s]{0,1}:\/\/[w]{0,3}.amazon.[a-z]{1,}.{0,1}[a-z]{0,}\/vine\/vine-items)/.exec(window.location.href)[1];

    showBackgroundScanScreen('Start Background Scanner');

    const _state = {
        loopIsWorking: false,
        stage: 0,
        subStage: 0,
        pageMax: 0,
        stageZeroSites: []
    };

    const _paginationWaitLoop = setInterval(() => {
        const _maxPage = localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX') || 100;
        if (_maxPage) {
            clearInterval(_paginationWaitLoop);
            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): pagination WaitLoop');

            initBackgroundScanStorage(_maxPage);

            _state.stageZeroSites = getBackgroundScanStageZeroSites();
            _state.pageMax = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX')) || 0;

            backGroundScanTimeout = setTimeout(() => {
                backgroundScanLoop(_baseUrl, _state);
            }, SETTINGS.BackGroundScanDelayPerPage);
        }
    }, 250); //scan every 250ms
}

/**
 * Writes the initial values of the background scan to the local storage.
 * A running scan is not reset, so that a reload continues where it stopped.
 *
 * @param {string|number} maxPage The maximum number of pages of the scan
 */
function initBackgroundScanStorage(maxPage) {
    if (localStorage.getItem('AVE_BACKGROUND_SCAN_IS_RUNNING') == 'true') return;
    if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): init localStorage Variables');
    localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_MAX', maxPage);
    localStorage.setItem('AVE_BACKGROUND_SCAN_IS_RUNNING', true);
    localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', 0);
    localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', 0);
    localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', false);
}

/**
 * The queues that belong to the first stage of the background scan.
 * The last chance queue does not exist in Germany.
 *
 * @returns {string[]} The queues of the first stage
 */
function getBackgroundScanStageZeroSites() {
    switch (getCountry()) {
        case 'DE':
            return ['queue=potluck'];
        default:
            return ['queue=potluck', 'queue=last_chance'];
    }
}

/**
 * One iteration of the background scan loop.
 *
 * The iteration only decides what has to be scanned, the scanning itself is
 * done by backGroundTileScanner(). The next iteration is started by
 * backgroundScanFinished(), as soon as the page was scanned.
 *
 * @param {string} baseUrl The base url of the Vine pages
 * @param {BackgroundScanState} state The state of the scan
 */
function backgroundScanLoop(baseUrl, state) {
    const startTime = performance.now(); // Get the Starttime to calculate the speed

    if (state.loopIsWorking) return;
    state.loopIsWorking = true;

    prepareFastScan();

    const _iteration = prepareScanIteration(state, startTime);

    switch (state.stage) {
        case 0:
            scanStageZero(baseUrl, state, _iteration);
            break;
        case 1:
            scanStageEncore(baseUrl, state, _iteration);
            break;
        case 2:
            scanStageSkip(baseUrl, state, _iteration);
            break;
        case 3:
            scanStageCleanup(baseUrl, state, _iteration);
            break;
        case 4:
            scanStageIdle(baseUrl, state, _iteration);
            break;
    }
}

/**
 * Decides if a fast scan should be started.
 *
 * A fast scan is a shortened version of the background scan. It is only started
 * if the last scan is long enough ago and the scan is at the beginning, so that
 * a possible product drop is found early.
 */
function prepareFastScan() {
    if (localStorage.getItem('AVE_FAST_SCAN_IS_RUNNING') == 'true') return;

    const _backgroundScanStage = localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE') || -1;
    const _backgroundScanPageMax = localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX') || -1;
    const _backgroundScanPageCurrent = localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT') || -1;

    const _fastTimeWaitingMS = Date.now() - (localStorage.getItem('AVE_FAST_SCAN_LAST_TIME') || 0);
    const _fastTimeWaitingSec = _fastTimeWaitingMS / 1000;
    let _fastTimeIntervalSec = ((SETTINGS.BackGroundScanDelayPerPage + SETTINGS.BackGroundScannerRandomness / 2) * 15) / 1000;
    if (_fastTimeIntervalSec < 30) _fastTimeIntervalSec = 30;

    /* The fast scan is started if the last scan is long enough ago, if the scan
       is not at the very beginning and if it did not just start with the encore
       queue. The conditions are combined into one expression, because every
       single one of them would set the same flag. */
    const _startFastScan =
        !(_fastTimeWaitingSec < _fastTimeIntervalSec) &&
        !(_backgroundScanStage <= 0) &&
        !(_backgroundScanPageMax <= 0) &&
        !(_backgroundScanStage == 1 && _backgroundScanPageCurrent <= 0) &&
        !(_backgroundScanStage == 1 && _backgroundScanPageCurrent < _backgroundScanPageMax / 20);

    if (_startFastScan) {
        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): starting fast scan');
        localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', true);
        localStorage.setItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS', '-1:-1:-1:-1');
        localStorage.setItem('AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT', localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT'));
        localStorage.setItem('AVE_LAST_BACKGROUND_SCAN_STAGE', localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE'));
        localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', 0);
        localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', 0);
        localStorage.setItem('AVE_NEW_COUNT', 0);
    } else {
        localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', false);
    }
}

/**
 * Determines the stage and the sub stage of the current iteration.
 *
 * @param {BackgroundScanState} state The state of the scan
 * @param {number} startTime The start time of the iteration (performance.now)
 * @returns {BackgroundScanIteration} The values of the current iteration
 */
function prepareScanIteration(state, startTime) {
    const _timeWaitingMS = Date.now() - (localStorage.getItem('AVE_BACKGROUND_SCAN_LAST_TIME') || 0);
    const _timeWaitingMin = _timeWaitingMS / 1000 / 60;

    if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): TimeWaitingMin ', _timeWaitingMin);

    //Nach 10 Stunden wird neu gestartet
    if (_timeWaitingMin > 600) {
        state.stage = 0;
        state.subStage = 0;
        localStorage.setItem('AVE_BACKGROUND_SCAN_LAST_TIME', Date.now());
        localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', false);
    } else {
        state.stage = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE')) || 0;
        state.subStage = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT')) || 0;
    }

    if (SETTINGS.DebugLevel > 10)
        console.log('initBackgroundScan(): loop with _backgroundScanStage ', state.stage, ' and Substage: ', state.subStage);

    let _scannerName;
    if (localStorage.getItem('AVE_FAST_SCAN_IS_RUNNING') == 'true') {
        _scannerName = 'Fast Scanner';
    } else {
        _scannerName = 'Background Scanner';
    }

    return {
        startTime: startTime,
        timeWaitingMS: _timeWaitingMS,
        timeWaitingMin: _timeWaitingMin,
        scannerName: _scannerName
    };
}

/**
 * Stage 0 of the background scan: the potluck and the last chance queue.
 *
 * @param {string} baseUrl The base url of the Vine pages
 * @param {BackgroundScanState} state The state of the scan
 * @param {BackgroundScanIteration} iteration The values of the current iteration
 */
function scanStageZero(baseUrl, state, iteration) {
    if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', state.subStage);
    if (state.stageZeroSites[state.subStage]) {
        updateBackgroundScanScreenText(
            `${iteration.scannerName} ${state.stageZeroSites[state.subStage].replace('queue=', '')} Page: ${state.subStage + 1} / ${state.pageMax}`
        );
        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', state.subStage, ' inside IF');
        backGroundTileScanner(`${baseUrl}?${state.stageZeroSites[state.subStage]}`, (newCount) => {
            backgroundScanFinished(baseUrl, state, iteration, newCount);
        });
        state.subStage++;
    } else {
        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', state.subStage, ' inside ELSE');
        state.subStage = 0;
        localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', state.subStage);
        state.stage++;
        backgroundScanFinished(baseUrl, state, iteration);
    }
}

/**
 * Stage 1 of the background scan: the encore queue, page by page.
 *
 * @param {string} baseUrl The base url of the Vine pages
 * @param {BackgroundScanState} state The state of the scan
 * @param {BackgroundScanIteration} iteration The values of the current iteration
 */
function scanStageEncore(baseUrl, state, iteration) {
    state.subStage = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT')) || 0;

    if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.1 update PAGE_MAX');

    /* NOTE: The pagination of the last scanned page is used. It cannot
       be read from the iframe anymore, because the iframe is removed
       after every scanned page (see createScanIframe()). */
    const _pagedate = lastScanPaginationData;
    if (_pagedate) {
        state.pageMax = _pagedate.maxPage;
        localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_MAX', state.pageMax);
    } else {
        state.pageMax = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX')) || 0;
    }

    if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.1 with _subStage: ', state.subStage);

    // Wenn die aktuelle Seite die erste ist oder die maximale Seitenzahl nicht erreicht ist, wird gescannt
    if (state.subStage == 0 || state.subStage < state.pageMax) {
        updateBackgroundScanScreenText(`${iteration.scannerName} encore Page: ${state.subStage + 1} / ${state.pageMax}`);
        backGroundTileScanner(`${baseUrl}?queue=encore&pn=&cn=&page=${state.subStage + 1}`, (newCount) => {
            backgroundScanFinished(baseUrl, state, iteration, newCount);
        });
        state.subStage++;
        localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', state.subStage);
    } else {
        localStorage.setItem('AVE_BACKGROUND_SCAN_LAST_TIME', Date.now());
        state.subStage = 0;
        state.stage++;
        backgroundScanFinished(baseUrl, state, iteration);
    }
}

/**
 * Stage 2 of the background scan.
 *
 * This stage would query additional values (tax, real prize, ...), but it is
 * disabled because of the bugs with fetching the tax.
 *
 * @param {string} baseUrl The base url of the Vine pages
 * @param {BackgroundScanState} state The state of the scan
 * @param {BackgroundScanIteration} iteration The values of the current iteration
 */
function scanStageSkip(baseUrl, state, iteration) {
    //Disaled due to Bugs fetching the Tax
    state.stage++;
    backgroundScanFinished(baseUrl, state, iteration);
}

/**
 * Stage 3 of the background scan: the cleanup of the database.
 *
 * @param {string} baseUrl The base url of the Vine pages
 * @param {BackgroundScanState} state The state of the scan
 * @param {BackgroundScanIteration} iteration The values of the current iteration
 */
function scanStageCleanup(baseUrl, state, iteration) {
    cleanUpDatabase();
    state.stage++;
    backgroundScanFinished(baseUrl, state, iteration);
}

/**
 * Stage 4 of the background scan: waiting for the next scan.
 *
 * @param {string} baseUrl The base url of the Vine pages
 * @param {BackgroundScanState} state The state of the scan
 * @param {BackgroundScanIteration} iteration The values of the current iteration
 */
function scanStageIdle(baseUrl, state, iteration) {
    updateBackgroundScanScreenText(
        `${iteration.scannerName} Time Waiting: ${formatDuration(SETTINGS.IdlePeriodAfterScan * 60 * 1000 - iteration.timeWaitingMS)}`
    );

    if (iteration.timeWaitingMin > SETTINGS.IdlePeriodAfterScan) {
        state.stage = 0;
        state.subStage = 0;
    }
    backgroundScanFinished(baseUrl, state, iteration);
}

/**
 * Sends the notification about a possible product drop.
 *
 * @param {number} _newCount The number of the new products of the fast scan
 */
function notifyAboutProductDrop(_newCount) {
    if (SETTINGS.NewItemsNotificationThreshold <= 0 || _newCount < SETTINGS.NewItemsNotificationThreshold) return;

    const _lastDropMS = Date.now() - (localStorage.getItem('AVE_LAST_DROP') || 0);
    const _lastDropMinutes = _lastDropMS / 1000 / 60;

    if (_lastDropMinutes <= SETTINGS.NewItemsNotificationRepititionMinutes) return;

    localStorage.setItem('AVE_LAST_DROP', Date.now());

    if (SETTINGS.GotifyUrl) {
        gotifyNotification(`Possible new product drop starting, Amazon Vine Explorer has ${_newCount} new products`);
    }

    if (SETTINGS.EnableDesktopNotifikation) {
        desktopNotifikation(
            `Amazon Vine Explorer - ${AVE_VERSION}`,
            `Possible new product drop starting, Amazon Vine Explorer has ${_newCount} new products`
        );
    }
}

/**
 * Decides if the fast scan has to be stopped.
 *
 * The fast scan is stopped if the scan passed the stage that it started with,
 * if no new product was found or if the scan did not get any further.
 *
 * @param {object} _fastScanState The state of the fast scan
 * @param {number} newCount The number of the new products of the last iteration
 * @returns {boolean} true if the fast scan has to be stopped
 */
function shouldStopFastScan(_fastScanState, newCount) {
    const _backGroundScanStage = _fastScanState.stage;
    const _lastBackGroundScanStage = _fastScanState.lastStage;
    const _scanPageCurrent = _fastScanState.pageCurrent;
    const _lastScanPageCurrent = _fastScanState.lastPageCurrent;

    // The scan is past the stage that the fast scan started with.
    if (_backGroundScanStage > 1) return true;

    if (SETTINGS.DebugLevel > 10)
        console.log(
            `checking fast scan AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS=${localStorage.getItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS')} _backGroundScanStage=${_backGroundScanStage} newCount=${newCount}`
        );

    // The scan did not find anything and the previous runs did not find anything either.
    if (
        _backGroundScanStage > 0 &&
        newCount === 0 &&
        (!localStorage.getItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS').match(/^[-0-9]+(:[-0-9]+){3}/) ||
            localStorage.getItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS') == '0:0:0:0')
    ) {
        return true;
    }

    // The scan did not get any further than the last run of the fast scan.
    if (
        _backGroundScanStage == 1 &&
        _lastBackGroundScanStage == 1 &&
        _scanPageCurrent > 0 &&
        _scanPageCurrent - _lastScanPageCurrent >= 0
    ) {
        return true;
    }

    return false;
}

/**
 * Restores the values of the background scan and stops the fast scan.
 *
 * @param {object} _fastScanState The state of the fast scan
 */
function stopFastScan(_fastScanState) {
    if (SETTINGS.DebugLevel > 10)
        console.log(
            `stopping fast scan AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS=${localStorage.getItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS')} _backGroundScanStage=${_fastScanState.stage} newCount=${_fastScanState.newCount}`
        );
    localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', false);
    localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', _fastScanState.lastPageCurrent);
    localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', _fastScanState.lastStage);
    localStorage.setItem('AVE_FAST_SCAN_LAST_TIME', Date.now());
}

/**
 * Handles the end of an iteration of the scan while a fast scan is running.
 *
 * @param {number} newCount The number of the new products of the last iteration
 */
function handleFastScanFinished(newCount) {
    const _fastScanState = {
        stage: localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE') || 0,
        lastStage: localStorage.getItem('AVE_LAST_BACKGROUND_SCAN_STAGE') || 0,
        lastPageCurrent: localStorage.getItem('AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT') || 0,
        pageCurrent: localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT') || 0,
        newCount: newCount
    };

    const _newCount = parseInt(newCount || 0, 10) + parseInt(localStorage.getItem('AVE_NEW_COUNT') || 0, 10);
    localStorage.setItem('AVE_NEW_COUNT', _newCount);

    notifyAboutProductDrop(_newCount);

    const _stopFastScan = shouldStopFastScan(_fastScanState, newCount);

    if (_fastScanState.stage > 0 && newCount >= 0) {
        localStorage.setItem(
            'AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS',
            (localStorage.getItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS') + ':' + newCount).replace(/^[^:]+:/, '')
        );
    }

    if (_stopFastScan) {
        stopFastScan(_fastScanState);
    }
}

/**
 * Handles the end of an iteration of the scan and starts the next one.
 *
 * @param {string} baseUrl The base url of the Vine pages
 * @param {object} state The state of the scan
 * @param {object} iteration The values of the current iteration
 * @param {number} newCount The number of the new products of the last iteration
 */
function backgroundScanFinished(baseUrl, state, iteration, newCount) {
    if (SETTINGS.DebugLevel > 10)
        console.log(
            `initBackgroundScan()._scanFinished(): newCount=${newCount} _backGroundScanStage=${state.stage} _subStage=${state.subStage} AVE_FAST_SCAN_IS_RUNNING=${localStorage.getItem('AVE_FAST_SCAN_IS_RUNNING')}`
        );
    localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', state.stage);
    localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', state.subStage);
    state.loopIsWorking = false;

    if (localStorage.getItem('AVE_FAST_SCAN_IS_RUNNING') == 'true') {
        handleFastScanFinished(newCount);
    }

    const _delay = SETTINGS.BackGroundScanDelayPerPage + Math.round(Math.random() * SETTINGS.BackGroundScannerRandomness);
    const _timeElapsed = performance.now() - iteration.startTime;
    if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): Scantime: ', _timeElapsed, ' Delay: ', _delay);

    backGroundScanTimeout = setTimeout(() => {
        backgroundScanLoop(baseUrl, state);
    }, _delay);
}

/**
 * Converts a duration in milliseconds into a readable string.
 *
 * @param {number} duration The duration in milliseconds
 * @returns {string} The duration as a string (e.g. "1h 5m 3s")
 */
function formatDuration(duration) {
    const portions = [];

    const msInHour = 1000 * 60 * 60;
    const hours = Math.trunc(duration / msInHour);
    if (hours > 0) {
        portions.push(hours + 'h');
        duration = duration - hours * msInHour;
    }

    const msInMinute = 1000 * 60;
    const minutes = Math.trunc(duration / msInMinute);
    if (minutes > 0) {
        portions.push(minutes + 'm');
        duration = duration - minutes * msInMinute;
    }

    const seconds = Math.trunc(duration / 1000);
    if (seconds > 0) {
        portions.push(seconds + 's');
    }

    return portions.join(' ');
}

/**
 * Creates the hidden iframe that loads a single page of the background scan.
 *
 * NOTE: The iframe is intentionally NOT reused for the next page. A reused iframe
 * keeps a session history with one entry per navigation, and the renderer holds
 * the documents of those entries in memory. That made the memory usage of the
 * renderer grow with every scanned page (measured: ~670 MB less 'anon' memory
 * with a fresh iframe per page). A new iframe starts with an empty history and
 * is removed again after the page was scanned.
 *
 * @param {string} url The URL that the iframe has to load
 * @returns {HTMLIFrameElement} The created iframe
 */
function createScanIframe(url) {
    const _iframe = document.createElement('iframe');
    _iframe.id = 'ave-iframe-backgroundloader';
    _iframe.style.position = 'fixed';
    _iframe.style.top = '0';
    _iframe.style.left = '-10000';
    _iframe.style.width = '100%';
    _iframe.style.height = '100%';
    _iframe.style.display = 'none';
    _iframe.style.zIndex = '100';
    _iframe.src = url;
    document.body.appendChild(_iframe);
    return _iframe;
}

/**
 * Removes the iframe of a background scan page and releases its memory.
 * @param {HTMLIFrameElement} iframe The iframe to remove
 */
function removeScanIframe(iframe) {
    if (!iframe) return;
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
}

function backGroundTileScanner(url, cb) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called backgroundTileScanner(${url})`);
    const _iconLoading = addLoadingSymbol();

    // NOTE: A fresh iframe per page, so that the session history of the frame
    // does not grow with every scanned page (see createScanIframe()).
    const _iframe = createScanIframe(url);

    /* NOTE: The iframe is created with the target URL, so it starts with an empty
       about:blank document. The scanner waits until the requested page is loaded.

       KNOWN: Accessing contentWindow.document could throw SecurityError on cross-origin
       navigation, but Amazon Vine keeps the iframe on the same origin in practice. */

    // Maximum number of checks (every 100ms) before the scan gives up on this page.
    // Without it the scan could wait forever if the page does not load.
    const _maxTicks = 300;
    let _tickCount = 0;

    const _loopDelay = setInterval(() => {
        _tickCount++;
        const _liveDoc = _iframe.contentWindow.document;
        const _liveUrl = _liveDoc.location ? _liveDoc.location.href : '';
        /* The page counts as loaded when the document is complete, the URL is not
           about:blank and the body has content. The about:blank document of the
           fresh iframe is already "complete", so readyState alone is not enough. */
        const _hasContent = !!(_liveDoc.body && _liveDoc.body.childElementCount > 0);
        const _hasNewPage = _liveUrl !== '' && _liveUrl !== 'about:blank' && _hasContent;
        const _isLoaded = _liveDoc.readyState === 'complete';

        if (SETTINGS.DebugLevel > 10) {
            console.log(`backgroundTileScanner(): tick ${_tickCount}, new page: ${_hasNewPage}, loaded: ${_isLoaded}`);
        }

        // Wait for the requested page. If it does not arrive in time, the scan continues
        // with the next page instead of waiting forever.
        if ((!_hasNewPage || !_isLoaded) && _tickCount < _maxTicks) return;

        if (_tickCount >= _maxTicks) {
            console.warn(`BACKGROUNDSCAN => the page ${url} was not loaded in time, the scan continues with the next page`);
        }

        /* NOTE: The document is only kept for debugging. It would otherwise retain
           the whole page (including the decoded images) in the memory of the
           renderer for the rest of the session. */
        if (SETTINGS.DebugLevel > 10) unsafeWindow.ave.backGroundIFrame = _liveDoc;
        const _tiles = _liveDoc.querySelectorAll('.vvp-item-tile');
        const _tilesLength = _tiles.length;

        // The pagination of the scanned page is cached, because the iframe (and
        // with it the document) is removed after the scan.
        lastScanPaginationData = getPageinationData(_liveDoc);
        if (SETTINGS.DebugLevel > 10) {
            console.log(`BACKGROUNDSCAN DIAG => requested: ${url}`);
            console.log(`BACKGROUNDSCAN DIAG => live iframe url: ${_liveUrl}`);
            console.log(`BACKGROUNDSCAN DIAG => tiles: ${_tilesLength}`);
            console.log(`BackgroundsScan Querryd: ${url} and got ${_tilesLength} Tiles`);
        }
        // NOTE: The interval has to be cleared before anything else that can throw,
        // otherwise the scan would run into an endless loop of errors.
        clearInterval(_loopDelay);

        if (_tilesLength > 0) {
            let _newCount = 0;
            let _returned = 0;
            const _tilesProm = [];
            for (let i = 0; i < _tilesLength; i++) {
                _tilesProm.push(
                    parseTileData(_tiles[i]).then((prod) => {
                        _returned++;
                        if (SETTINGS.DebugLevel > 14)
                            console.log(`BACKGROUNDSCAN => Got TileData Back: Tile ${_returned}/${_tilesLength} =>`, prod);
                        if (!prod.gotFromDB) {
                            ++_newCount;
                            /* NOTE: database.add() is fire-and-forget on purpose. Awaiting it
                           would delay the scan unnecessarily. Failed writes are caught by
                           .catch() and logged. _newCount may be slightly off if a write
                           fails, but the scan catches the product on the next cycle. */
                            database.add(prod).catch((error) => {
                                console.error(`BACKGROUNDSCAN => Could not save the product ${prod.id}: ${error}`);
                            });
                        }
                    })
                );
            }

            // NOTE: allSettled() does not throw, so the rejected tiles would be lost
            // silently. They are collected here to make the failures visible.
            Promise.allSettled(_tilesProm).then((_results) => {
                const _failed = _results.filter((_result) => _result.status === 'rejected');
                if (_failed.length > 0) {
                    console.warn(`BACKGROUNDSCAN => ${_failed.length} of ${_tilesLength} tiles could not be processed`);
                    if (SETTINGS.DebugLevel > 10) {
                        for (const _result of _failed) {
                            console.warn(`BACKGROUNDSCAN => Tile failed: ${_result.reason?.message || _result.reason}`);
                        }
                    }
                }
                // The iframe is removed after the tiles were processed, so that the
                // document stays intact while the tiles are parsed.
                removeScanIframe(_iframe);
                cb(_newCount);
                _iconLoading.remove();
            });
        } else {
            if (SETTINGS.DebugLevel > 10) console.log(`BACKGROUNDSCAN => We dont have anything to do here anything => resume autoscan`);
            removeScanIframe(_iframe);
            cb(); // We dont have to do here anything
            _iconLoading.remove();
        }
    }, 100);
}

function showBackgroundScanScreen(text) {
    const _text = document.createElement('div');
    _text.style.position = 'fixed';
    _text.style.bottom = '35px';
    _text.style.left = '35px';
    _text.style.color = 'orange'; // Textfarbe
    _text.style.textAlign = 'center';
    _text.style.fontSize = '10px'; // Ändere die Schriftgröße hier
    _text.style.lineHeight = '1';
    _text.style.zIndex = '9999';
    _text.innerHTML = `<p id="ave-backgroundscan-text">${text}</p>`;

    document.body.appendChild(_text);
}

function updateBackgroundScanScreenText(text = '') {
    const _elem = document.getElementById('ave-backgroundscan-text');
    _elem.textContent = text;
}

async function startAutoScan() {
    if (SETTINGS.DebugLevel > 10) console.log('Called startAutoScan()');
    showAutoScanScreen('Init Autoscan, please wait...');
    await markAllCurrentDatabaseProductsAsSeen();
    if (SETTINGS.DebugLevel > 10) console.log('startAutoScan() - markAllCurrentDatabaseProductsAsSeen() is done');
    const _pageiDat = getPageinationData();
    localStorage.setItem('AVE_INIT_AUTO_SCAN', false);
    localStorage.setItem('AVE_AUTO_SCAN_IS_RUNNING', true);
    localStorage.setItem('AVE_AUTO_SCAN_PAGE_MAX', _pageiDat.maxPage);
    localStorage.setItem('AVE_AUTO_SCAN_PAGE_CURRENT', 1);
    setTimeout(() => {
        // NOTE: The pagination href of Amazon is relative ("vine-items?...page=").
        // It has to be resolved to an absolute URL, otherwise a trailing slash
        // in the current URL would produce a doubled path (see aveResolveUrl()).
        const _url = aveResolveUrl(`${_pageiDat.href}1`);
        if (SETTINGS.DebugLevel > 10) console.log(`Loding new Page ${_url}`);
        window.location.href = _url;
    }, 5000);
}

async function handleAutoScan() {
    const _delay = Math.max(SETTINGS.PageLoadMinDelay - (Date.now() - PAGE_LOAD_TIMESTAMP), 0) + 500;
    if (SETTINGS.DebugLevel > 10) console.log(`handleAutoScan() - _delay: ${_delay}`);
    if (AUTO_SCAN_PAGE_CURRENT < AUTO_SCAN_PAGE_MAX) {
        const _nextPage = AUTO_SCAN_PAGE_CURRENT + 1;
        localStorage.setItem('AVE_AUTO_SCAN_PAGE_CURRENT', _nextPage);
        setTimeout(() => {
            // NOTE: Only the pagination parameter is replaced, so that other
            // parameters with a number (e.g. "ave-subpage") stay untouched.
            window.location.href = aveUrlWithPage(_nextPage);
        }, _delay);
    } else {
        // We are done ;)
        updateAutoScanScreenText('Success, cleaning up Database...');
        await cleanUpDatabase();
        localStorage.setItem('AVE_AUTO_SCAN_IS_RUNNING', false);
        localStorage.setItem('AVE_AUTO_SCAN_PAGE_MAX', -1);
        localStorage.setItem('AVE_AUTO_SCAN_PAGE_CURRENT', -1);
        setTimeout(() => {
            updateAutoScanScreenText('Finished Database\nupdate and cleanup\n\nPage reloading incoming... please wait');
            setTimeout(() => {
                window.location.href = aveUrlWithPage(1);
            }, 10000);
        }, _delay + 2000);
    }
}

function stickElementToTopScrollEVhandler(elemID, dist) {
    const _elem = document.getElementById(elemID);
    if (_elem) {
        const maxScrollHeight = Math.max(
            document.body.scrollHeight - window.innerHeight,
            document.documentElement.scrollHeight - window.innerHeight
        );

        requestAnimationFrame(() => {
            const _elemRect = _elem.getBoundingClientRect();

            const _elemInitialTop = parseInt(_elem.getAttribute('ave-data-default-top'));
            if (!_elemInitialTop) {
                _elem.setAttribute('ave-data-default-top', window.scrollY + _elemRect.top);
            }
            if (!_elem || !_elemRect) return;

            if (SETTINGS.DebugLevel > 10)
                console.log(`### scrollY:${window.scrollY} maxScrollHeigt ${maxScrollHeight} initialTop: ${_elemInitialTop}`);

            if (window.scrollY >= _elemInitialTop - parseInt(dist)) {
                _elem.style.position = 'fixed';
                _elem.style.top = dist;
            } else {
                _elem.style.position = 'static';
            }
        });
    }
}

let lastDesktopNotifikationTimestamp = 0;

/**
 * Update the favorites badge count in the navigation bar.
 */
function updateFavoritesBtn() {
    database.getFavEntries().then((favArr) => {
        const _btnFavBadge = document.getElementById('ave-fav-items-btn-badge');
        if (favArr.length > 0) {
            _btnFavBadge.style.display = 'inline-block';
            _btnFavBadge.innerText = favArr.length;
        } else {
            _btnFavBadge.style.display = 'none';
            _btnFavBadge.innerText = '';
        }
    });
}

/**
 * Sends the notification about the number of unseen products, if the threshold
 * is reached and the repetition time has passed.
 * @param {number} _prodArrLength The number of the new entries
 * @param {number} _badgeCount The number that is currently shown in the badge
 */
function notifyAboutUnseenItems(_prodArrLength, _badgeCount) {
    // Threshold/cooldown gate for "new entries" notifications.
    if (
        SETTINGS.UnseenItemsNotificationThreshold <= 0 ||
        _prodArrLength < SETTINGS.UnseenItemsNotificationThreshold ||
        _badgeCount >= SETTINGS.UnseenItemsNotificationThreshold
    ) {
        return;
    }

    let _shouldNotify = true;
    if (SETTINGS.UnseenItemsNotificationRepitionMinutes > 0) {
        const _lastUnseenMS = Date.now() - (localStorage.getItem('AVE_LAST_UNSEEN_NOTIFICATION') || 0);
        const _lastUnseenMinutes = _lastUnseenMS / 1000 / 60;

        if (_lastUnseenMinutes < SETTINGS.UnseenItemsNotificationRepitionMinutes) {
            _shouldNotify = false;
        }
    }

    if (!_shouldNotify) return;

    localStorage.setItem('AVE_LAST_UNSEEN_NOTIFICATION', Date.now());

    if (SETTINGS.GotifyUrl) {
        gotifyNotification(
            translate('notifications', 'unseenItemsBody', `Es wurden ${_prodArrLength} neue Eintraege gefunden`, _prodArrLength)
        );
    }
    if (SETTINGS.EnableDesktopNotifikation) {
        desktopNotifikation(
            translate('notifications', 'unseenItemsTitle', `Amazon Vine Explorer - ${AVE_VERSION}`, AVE_VERSION),
            translate('notifications', 'unseenItemsBody', `Es wurden ${_prodArrLength} neue Eintraege gefunden`, _prodArrLength)
        );
    }
}

/**
 * Converts a keyword of the form "/pattern/flags" into a regular expression.
 * A keyword without the slashes returns undefined.
 * see https://stackoverflow.com/questions/874709/converting-user-input-string-to-regular-expression
 * @param {string} s The keyword
 * @returns {RegExp|undefined} The regular expression, if the keyword is one
 */
function stringToRegex(s) {
    const _match = s.match(/^\/(.*?)\/([gimsuy]*)$/);
    if (!_match) return undefined;
    const _flags = _match[2]
        .split('')
        .filter((i, p, arr) => arr.indexOf(i) === p)
        .join('');
    return new RegExp(_match[1], _flags);
}

/**
 * Searches a keyword in the description of a product and sends the
 * notifications if the keyword was found.
 * @param {Product} _prod The product to check
 * @param {string[]} _configKeyWords The keywords to search for
 * @returns {boolean} true if a keyword was found
 */
function checkKeywordsForProduct(_prod, _configKeyWords) {
    const _descFull = _prod.description_full.toLowerCase();

    if (_prod.isNotified) {
        if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Skipping Product which was already notified: ${_descFull}`);
        return false;
    }

    if (SETTINGS.DebugLevel > 1)
        console.log(`updateNewProductsBtn(): Search Product Description: ${_descFull} for keys: `, _configKeyWords);
    const _configkeyWordsLength = _configKeyWords.length;

    for (let j = 0; j < _configkeyWordsLength; j++) {
        const _currKey = _configKeyWords[j].toLowerCase();
        let _keyFound = false;
        const _regExp = stringToRegex(_currKey);
        if (_regExp !== undefined) {
            if (SETTINGS.DebugLevel > 1)
                console.log(`updateNewProductsBtn(): Search Product Description for Regular Expression: ${_regExp}`);
            _keyFound = _regExp.test(_descFull);
        } else {
            if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Search Product Description for Keyword: ${_currKey}`);
            _keyFound = _descFull.includes(_currKey);
        }
        if (!_keyFound) continue;

        if (SETTINGS.EnableDesktopNotifikation) {
            desktopNotifikation(
                `Amazon Vine Explorer - ${AVE_VERSION}`,
                `${_prod.description_full}\nkey: ${_currKey}`,
                fixProductImageUrl(_prod.data_img_url),
                true,
                function (event) {
                    event.preventDefault();
                    const newUrl = `${window.location.origin}/vine/vine-items?vine-data=${encodeURIComponent(
                        JSON.stringify({
                            asin: _prod.data_asin,
                            isParentAsin: _prod.data_asin_is_parent,
                            recommendationId: _prod.data_recommendation_id,
                            tax: _prod.data_estimated_tax
                        })
                    )}`;
                    window.open(newUrl, '_blank');
                }
            );
        }
        if (SETTINGS.GotifyUrl) {
            if (_prod.link) {
                gotifyNotification(
                    `[![](${fixProductImageUrl(_prod.data_img_url)})](${window.location.origin + _prod.link})  \n${_prod.description_full}  \nMatched key: ${_currKey}`,
                    _prod
                );
            } else {
                gotifyNotification(
                    `![](${fixProductImageUrl(_prod.data_img_url)})  \n${_prod.description_full}  \nMatched key: ${_currKey}`
                );
            }
        }
        _prod.isNotified = true;
        if (SETTINGS.EnableAutoMarkFavorite) {
            _prod.isFav = 1;
        }
        database.update(_prod).catch((error) => {
            console.error(`Could not save the notified product ${_prod.id}: ${error}`);
        });
        return true;
    }
    return false;
}

/**
 * Searches the keywords in the new products and sends the notifications.
 *
 * NOTE: The search is expensive, because every new product is checked against
 * every keyword. It is only done if a new product was added and not after every
 * update of an existing product (e.g. after every timestamp update of the
 * background scan).
 *
 * @param {Product[]} _prodArr The new entries
 * @returns {boolean} true if at least one product was notified
 */
function searchKeywordsInProducts(_prodArr) {
    if (
        !(SETTINGS.EnableDesktopNotifikation || SETTINGS.EnableAutoMarkFavorite || SETTINGS.GotifyUrl) ||
        !SETTINGS.DesktopNotifikationKeywords?.length
    ) {
        return false;
    }

    if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Inside IF`);

    const _configKeyWords = SETTINGS.DesktopNotifikationKeywords;
    let _notifyed = false;

    for (let i = 0; i < _prodArr.length; i++) {
        const _prod = _prodArr[i];
        if (checkKeywordsForProduct(_prod, _configKeyWords)) {
            _notifyed = true;
        }
    }
    return _notifyed;
}

/**
 * Sends the notification about the number of new products, if the delay
 * between the notifications has passed.
 * @param {number} _prodArrLength The number of the new entries
 * @param {boolean} _notifyed true, if a product was already notified
 */
function notifyAboutNewProducts(_prodArrLength, _notifyed) {
    if (!SETTINGS.EnableDesktopNotifikation || SETTINGS.DesktopNotifikationDelay <= 0 || _notifyed) return;
    if (_prodArrLength <= oldCountOfNewItems) return;
    if (unixTimeStamp() - lastDesktopNotifikationTimestamp < SETTINGS.DesktopNotifikationDelay) return;

    oldCountOfNewItems = _prodArrLength;
    lastDesktopNotifikationTimestamp = unixTimeStamp();

    desktopNotifikation(`Amazon Vine Explorer - ${AVE_VERSION}`, `Es wurden ${_prodArrLength} neue Vine Produkte gefunden`);
}

/**
 * Update the "new entries" badge and trigger threshold notifications.
 */
function updateNewProductsBtn() {
    if (AUTO_SCAN_IS_RUNNING) return;
    if (SETTINGS.DebugLevel > 1) console.log('Called updateNewProductsBtn()');

    // The search for the keywords is expensive, because every new product is
    // checked against every keyword. It is only done if a new product was added
    // and not after every update of an existing product (e.g. after every
    // timestamp update of the background scan).
    const _checkForKeywords = newProductWasAdded;
    newProductWasAdded = false;

    database.getNewEntries().then((prodArr) => {
        const _btnBadge = document.getElementById('ave-new-items-btn-badge');
        const _pageTitle = document.title.replace(/^[^|]*\|/, '').trim();
        const _prodArrLength = prodArr.length;
        if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Got Database Response: ${_prodArrLength} New Items`);

        if (_prodArrLength > 0) {
            const _badgeCount = parseInt(_btnBadge && _btnBadge.innerText ? _btnBadge.innerText : '0', 10) || 0;
            notifyAboutUnseenItems(_prodArrLength, _badgeCount);

            _btnBadge.style.display = 'inline-block';
            _btnBadge.innerText = _prodArrLength;
            document.title = `${_prodArrLength} | ${_pageTitle}`;
        } else {
            _btnBadge.style.display = 'none';
            _btnBadge.innerText = '';
            document.title = `${_pageTitle}`;
        }

        const _notifyed = _checkForKeywords ? searchKeywordsInProducts(prodArr) : false;
        notifyAboutNewProducts(_prodArrLength, _notifyed);
    });
}

/**
 * Send a Desktop Notifikation
 * @param {string} title
 * @param {string} message
 * @param {string} icon
 *
 */
/* NOTE: 'desktopNotifikation' and all related settings use the misspelling
   'Notifikation' instead of 'Notification'. The spelling is consistent across
   globals.js and VineExplorer.user.js and is part of the public settings API,
   so it is kept to avoid breaking existing user configurations. */
function desktopNotifikation(title, message, image = null, requireInteraction = null, onClick = () => {}) {
    const _vineLogo = 'https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/vine_logo.png';
    /* NOTE: The 'dev-main' branch no longer exists; this URL returns 404.
       The notification still works, it just falls back to the default icon. */
    const _vineLogoImp = 'https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/dev-main/vine_logo_important.png';
    /* NOTE: Same as above — 'dev-main' no longer exists, this URL returns 404.
       The notification still works, it just falls back to the default icon. */
    const _defaultImage =
        'https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/dev-main/vine_logo_notification_image.png';

    if (Notification.permission === 'granted') {
        const _notification = new Notification(title, {
            body: message,
            icon: !requireInteraction ? _vineLogo : _vineLogoImp,
            image: image || _defaultImage,
            tag: requireInteraction ? `ave-notify-${Math.round(Math.random() * 10000000)}` : 'ave-notify',
            requireInteraction: requireInteraction
        });

        _notification.onclick = onClick;
    } else {
        Notification.requestPermission().then(function (permission) {
            if (permission === 'granted') {
                console.log('Berechtigung für Benachrichtigungen erhalten!');
                desktopNotifikation(title, message);
            }
        });
    }
}

function gotifyNotification(message, prod = null) {
    const url = SETTINGS.GotifyUrl + 'message?token=' + SETTINGS.GotifyToken;
    const bodyFormData = prod
        ? {
              title: `Amazon Vine Explorer - ${AVE_VERSION}`,
              message: message,
              priority: 5,
              extras: {
                  'client::display': {
                      contentType: 'text/markdown'
                  },
                  'client::notification': {
                      click: { url: window.location.origin + prod.link },
                      bigImageUrl: fixProductImageUrl(prod.data_img_url)
                  }
              }
          }
        : {
              title: `Amazon Vine Explorer - ${AVE_VERSION}`,
              message: message,
              priority: 5,
              extras: {
                  'client::display': {
                      contentType: 'text/markdown'
                  }
              }
          };
    console.log('bodyFormData:', JSON.stringify(bodyFormData));
    GM.xmlHttpRequest({
        method: 'POST',
        url: url,
        data: JSON.stringify(bodyFormData),
        headers: {
            'Content-Type': 'application/json'
        },
        onload: function (response) {
            console.log('Response:', response.responseText);
        },
        onerror: function (err) {
            console.error('Error:', err);
        }
    });
}

function getContrastColor(hexColor) {
    // Remove the leading '#' if present
    const hex = hexColor.replace('#', '');

    // Parse RGB components
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate perceived brightness according W3C Accessibility guidelines
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // Return black for bright colors, white for dark colors
    return brightness > 125 ? 'black' : 'white';
}

/**
 * Calculates the background color and the text color of a button in the navigation bar.
 * In the dark mode a nearly white button would glare, because the background color of the
 * button is set inline and therefore is not replaced by the dark mode background.
 * Such a button gets the background color of the dark mode and the text color of the
 * dark mode instead. All other colors are kept, the text color is calculated from them.
 * @param {string} color The configured color of the button
 * @returns {object} An object with the properties "background" and "text"
 */
function getNavButtonColors(color) {
    const _hex = colorToHex(color) || '#ffffff';

    // The hex color of a rgba value has the alpha value first (e.g. #ffrrggbb),
    // so the position of the color components has to be calculated.
    const _offset = _hex.length > 7 ? 3 : 1;
    const _r = parseInt(_hex.substr(_offset, 2), 16);
    const _g = parseInt(_hex.substr(_offset + 2, 2), 16);
    const _b = parseInt(_hex.substr(_offset + 4, 2), 16);

    // Calculate perceived brightness according W3C Accessibility guidelines
    const _brightness = (_r * 299 + _g * 587 + _b * 114) / 1000;

    if (SETTINGS.DarkMode) {
        // Only nearly white colors are replaced, so that the colored buttons
        // (e.g. yellow for the favorites) keep their color.
        if (_brightness > 240) {
            return {
                background: SETTINGS.DarkModeBackgroundColor,
                text: SETTINGS.DarkModeColor
            };
        }
    }

    return {
        background: color,
        // Return black for bright colors, white for dark colors
        text: _brightness > 125 ? 'black' : 'white'
    };
}

function createNavButton(mainID, text, textID, color, onclick, badgeId, badgeValue, badgeColor) {
    const _btn = document.createElement('span');
    _btn.setAttribute('id', mainID);
    _btn.setAttribute('class', 'a-button a-button-normal a-button-toggle vvp-items-button');
    _btn.addEventListener('click', onclick);

    const _btnColors = getNavButtonColors(color);

    const _btnInner = document.createElement('span');
    _btnInner.classList.add('a-button-inner');
    _btnInner.style.backgroundColor = _btnColors.background;
    _btnInner.style.display = 'flex';
    _btn.append(_btnInner);

    const _btnInnerText = document.createElement('span');
    _btnInnerText.setAttribute('id', textID);
    _btnInnerText.classList.add('a-button-text');
    _btnInnerText.innerText = text;
    // The text has to get a color that contrasts to the background of the button.
    // Otherwise the text would be white in the dark mode and therefore invisible on
    // a white button (e.g. the "all products" button).
    _btnInnerText.style.color = _btnColors.text;
    _btnInner.append(_btnInnerText);

    if (badgeId) {
        const _btnInnerBadge = document.createElement('span');
        _btnInnerBadge.setAttribute('id', badgeId);
        _btnInnerBadge.setAttribute('class', 'a-button-text');
        _btnInnerBadge.style.backgroundColor = badgeColor;
        _btnInnerBadge.style.color = getContrastColor(badgeColor);
        _btnInnerBadge.style.display = 'inline-block';
        _btnInnerBadge.style.textAlign = 'center';
        // _btnInnerBadge.style.transform = 'translate(-75%, -100%)';
        _btnInnerBadge.style.zIndex = '50';
        _btnInnerBadge.style.position = 'relativ';
        // _btnInnerBadge.style.padding = '5px';

        _btnInnerBadge.innerText = badgeValue;
        _btnInner.append(_btnInnerBadge);
    }

    return _btn;
}

function addStyleToTile(_currTile, _product) {
    if (!_product.gotFromDB) {
        // We have a new one ==> Save it to our Database ;)
        // NOTE: The promise is not awaited, so a failed write has to be caught here.
        // The write fails e.g. if a product with the same ASIN is already in the database.
        database.add(_product).catch((error) => {
            console.error(`addStyleToTile(): could not save the product ${_product.id}: ${error}`);
        });
        _currTile.style.cssText = SETTINGS.CssProductSaved;
        _currTile.classList.add('ave-element-saved');
    } else {
        let _style = SETTINGS.CssProductDefault;
        if (_product.isNew) {
            _style = SETTINGS.CssProductNewTag;
            _currTile.classList.add('ave-element-new');
        }
        if (_product.isFav) {
            _style = SETTINGS.CssProductFavTag;
            _currTile.classList.add('ave-element-fav');
        }
        _currTile.style.cssText = _style;

        // Update Timestamps
    }
    _currTile.prepend(createFavStarElement(_product));
    _currTile.prepend(createFirstSeenElement(_product));
    _currTile.prepend(createShareElement(_product));
    // insertHtmlElementAfter((_currTile.getElementsByClassName('vvp-item-product-title-container')[0]), createTaxInfoElement(_product));
    waitForHtmlElement(
        '.vvp-item-product-title-container',
        (_elem) => {
            if (!_elem) return;

            insertHtmlElementAfter(_elem, createTaxInfoElement(_product));
        },
        _currTile
    );
    waitForHtmlElement(
        '.vvp-item-badges',
        (_itemBadge) => {
            if (!_itemBadge) return;

            _itemBadge.style.marginTop = '20px';
        },
        _currTile,
        2000,
        false
    );
}

async function requestProductDetails(prod) {
    if (prod.data_asin_is_parent) {
        const res = await vineFetch(`${window.location.origin}/vine/api/recommendations/${prod.id}`.replace(/#/g, '#')).then((r) =>
            r.json()
        );
        if (res.error) {
            if (res.error.exceptionType == 'ITEM_NOT_IN_ENROLLMENT') {
                prod.forceRemove = true;
                return prod;
            } else {
                console.error('requestProductDetails():ERROR:', res.error);
                throw res.error.exceptionType;
            }
        }
        const _data = res.result;
        if (SETTINGS.DebugLevel > 1) console.log('DATA:', _data);
        prod.data_childs = _data.variations || [];
        return prod;
    } else {
        const ret = await vineFetch(
            `${window.location.origin}/vine/api/recommendations/${prod.id}/item/${prod.data_asin}`.replace(/#/g, '%23')
        ).then((r) => r.json());
        if (SETTINGS.DebugLevel > 1) console.log('RETURN:', ret);
        if (ret.error) {
            throw ret.error.exceptionType;
        }
        const data = ret.result;
        prod.data_feature_bullets = data.featureBullets;
        prod.data_contributors = data.byLineContributors;
        prod.data_catalogSize = data.catalogSize;
        prod.data_tax_currency = data.taxCurrency;
        prod.data_estimated_tax_prize = data.taxValue;
        prod.data_limited_quantity = data.limitedQuantity;
        return prod;
    }
}

/**
 * Parses the tiles of the current page and starts the auto scan if it is
 * running.
 *
 * @param {boolean} hasTiles true, if the page has tiles
 */
function initTileParsing(hasTiles) {
    if (!hasTiles) {
        if (SETTINGS.DebugLevel > 10) console.log(`init(): NO TILES TO PARSE ON THIS SITE => SKIP`);
        return;
    }

    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tilesLength = _tiles.length;
    const _tilePorms = [];
    const _parseStartTime = Date.now();
    for (let i = 0; i < _tilesLength; i++) {
        const _currTile = _tiles[i];
        _currTile.style.cssText = 'background-color: yellow;';
        _tilePorms.push(
            parseTileData(_currTile)
                .then((_product) => {
                    if (SETTINGS.DebugLevel > 14)
                        console.log('Come Back from parseTileData <<<<<<<<<< INIT <<<<<<<<<<<<<<<<<<<<<<<', _currTile, _product);
                    addStyleToTile(_currTile, _product);
                })
                .catch((error) => {
                    // The tile could not be processed. The yellow background is removed, so that
                    // the tile does not look broken. The error is rethrown to report it together
                    // with the other failed tiles.
                    _currTile.style.cssText = '';
                    throw error;
                })
        );
    }
    // NOTE: allSettled() does not throw, so the rejected tiles would be lost silently.
    Promise.allSettled(_tilePorms).then((_results) => {
        const _failed = _results.filter((_result) => _result.status === 'rejected');
        if (_failed.length > 0) {
            console.warn(`AVE => ${_failed.length} of ${_tilesLength} products on this page could not be processed`);
            if (SETTINGS.DebugLevel > 10) {
                for (const _result of _failed) {
                    console.warn(`AVE => Product failed: ${_result.reason?.message || _result.reason}`);
                }
            }
        }
        if (INIT_AUTO_SCAN) {
            startAutoScan();
        } else if (AUTO_SCAN_IS_RUNNING) {
            handleAutoScan();
        } else {
            completeDelayedInit();
        }
    });
}

/**
 * Adds the buttons for the product sites (all products, favorites, new entries)
 * to the navigation of Amazon.
 */
function initNavigationButtons() {
    const _searchbarContainer = document.getElementById('vvp-items-button-container');

    if (SETTINGS.EnableBtnAll)
        _searchbarContainer.appendChild(
            createNavButton('ave-btn-all-products', 'Alle Produkte', '', SETTINGS.BtnColorAllProducts, () => {
                createNewSite(PAGETYPE.ALL);
            })
        );
    _searchbarContainer.appendChild(
        createNavButton(
            'ave-btn-favorites',
            translate('buttons', 'favorites', 'Favoriten'),
            '',
            SETTINGS.BtnColorFavorites,
            () => {
                createNewSite(PAGETYPE.FAVORITES);
            },
            'ave-fav-items-btn-badge',
            '-',
            SETTINGS.BtnColorFavoritesBadge
        )
    );
    _searchbarContainer.appendChild(
        createNavButton(
            'ave-btn-list-new',
            translate('buttons', 'newEntries', 'Neue Einträge'),
            'ave-new-items-btn',
            SETTINGS.BtnColorNewProducts,
            () => {
                createNewSite(PAGETYPE.NEW_ITEMS);
            },
            'ave-new-items-btn-badge',
            '-',
            SETTINGS.BtnColorNewProductsBadge
        )
    );
}

/**
 * Adds the search bar for the products to the navigation of Amazon.
 */
function initSearchBar() {
    const _searchbarContainer = document.getElementById('vvp-items-button-container');

    const _searchBarSpan = document.createElement('span');
    _searchBarSpan.setAttribute('class', 'ave-search-container');
    _searchBarSpan.style.cssText = `margin-left: 0.5em;`;

    const _searchBarInput = document.createElement('input');
    _searchBarInput.setAttribute('type', 'search');
    _searchBarInput.setAttribute('placeholder', 'Suche Vine Produkte');
    _searchBarInput.setAttribute('name', 'ave-search');
    _searchBarInput.style.cssText = `width: 15em;`;
    _searchBarInput.addEventListener('keyup', (ev) => {
        const _input = _searchBarInput.value.toLowerCase();
        if (SETTINGS.DebugLevel > 10) console.log(`Updated Input: ${_input}`);
        if (_input.length >= 2) {
            if (searchInputTimeout) clearTimeout(searchInputTimeout);
            searchInputTimeout = setTimeout(
                () => {
                    database.query(_input.split(' ')).then((_objArr) => {
                        if (SETTINGS.DebugLevel > 10) console.log(`Found ${_objArr.length} Items with this Search`);
                        createNewSite(PAGETYPE.SEARCH_RESULT, _objArr);
                        searchInputTimeout = null;
                    });
                },
                ev.key === 'Enter' ? 1 : SETTINGS.SearchBarInputDelay
            );
        }
    });

    _searchBarSpan.appendChild(_searchBarInput);
    _searchbarContainer.appendChild(_searchBarSpan);
}

/**
 * Replaces the "next page" button of the pagination with a button that marks
 * the products of the current page as seen before it navigates to the next page.
 */
function initPagination() {
    const _paginationContainers = document.querySelectorAll('.a-pagination');
    _paginationContainers.forEach((_paginationContainer) => {
        if (SETTINGS.DebugLevel > 10) console.log('Manipulating Pagination');

        const _nextBtn = _paginationContainer.lastChild;
        const _isNextBtnDisabled = _nextBtn.classList.contains('a-disabled');
        // NOTE: The pagination href of Amazon is relative ("vine-items?...page=2").
        // It has to be resolved to an absolute URL, otherwise a trailing slash in
        // the current URL would produce a doubled path (see aveResolveUrl()).
        const _nextBtnLink = aveResolveUrl(_nextBtn.lastChild.getAttribute('href'));
        const _btn = _nextBtn.cloneNode(true);
        const anchorTag = _btn.querySelector('a');

        //const _aveNextPageButtonText = 'Alle als gesehen markieren und Nächste <span class="a-letter-space"></span><span class="a-letter-space"></span><span class="larr">→</span>';
        const _aveNextPageButtonText =
            'Gelesen <span class="a-letter-space"></span><span class="a-letter-space"></span><span class="larr">→</span>';

        const _AveNextArrow = document.createElement('style');
        _AveNextArrow.type = 'text/css';
        _AveNextArrow.innerHTML = `.ave-arrow::after{border-style: solid; border-width: 2px 2px 0 0; content: ''; padding: 2.5px; visibility: visible; display: inline-block; position: relative; left: -9px; top: -1px; transform: rotate(45deg);}`;

        if (!_isNextBtnDisabled) {
            _nextBtn.setAttribute('class', 'a-normal');
            _nextBtn.querySelector('span.larr').style.visibility = 'hidden';
            _nextBtn.querySelector('span.larr').classList.add('ave-arrow');
        }

        if (anchorTag) {
            anchorTag.innerHTML = _aveNextPageButtonText;
        } else {
            //_btn.innerHTML = _aveNextPageButtonText;
            _btn.innerHTML = 'Gelesen';
        }

        _btn.style.color = 'unset';
        _btn.style.backgroundColor = 'lime';
        _btn.style.borderRadius = '8px';
        _btn.style.cursor = 'pointer';

        _btn.addEventListener('click', async () => {
            await markAllCurrentSiteProductsAsSeen();
            if (!_nextBtn.classList.contains('a-disabled')) {
                window.location.href = _nextBtnLink;
            }
        });

        _paginationContainer.appendChild(_btn);
        _paginationContainer.appendChild(_AveNextArrow);
    });
}

function init(hasTiles) {
    // Get all Products on this page ;)

    if (AUTO_SCAN_IS_RUNNING) showAutoScanScreen(`Autoscan is running...Page (${AUTO_SCAN_PAGE_CURRENT}/${AUTO_SCAN_PAGE_MAX})`);

    const _aveSubpageRequest = getUrlParameter('ave-subpage');
    if (SETTINGS.DebugLevel > 10) console.log(`Got Subpage Parameter`, _aveSubpageRequest);

    if (_aveSubpageRequest) createNewSite(parseInt(_aveSubpageRequest));

    initTileParsing(hasTiles);

    if (AUTO_SCAN_IS_RUNNING) return;

    initNavigationButtons();

    // The search for the keywords is also done on page load, because the products could
    // have been added by an other tab or before the page was closed.
    newProductWasAdded = true;
    updateNewProductsBtn();
    updateFavoritesBtn();

    initSearchBar();

    if (hasTiles) addLeftSideButtons();

    if (SETTINGS.EnableBackgroundScan) initBackgroundScan();

    // Modify Pageination if exists
    initPagination();
}

//Sort Items by key
function sort_by_key(array, key, order) {
    return array.sort(function (a, b) {
        var x = a[key];
        var y = b[key];
        const multiplier = order === 'asc' ? 1 : -1;
        return (x < y ? -1 : x > y ? 1 : 0) * multiplier;
    });
}

// fix product image url
// fix for deburau/AmazonVineExplorer#30
function fixProductImageUrl(url) {
    return url.replace(/\/images\/.*\/images\//, '/images/');
}
