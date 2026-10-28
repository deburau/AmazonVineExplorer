# Amazon Vine Explorer

Makes the Amazon Vine Website even a bit better

![](vine_logo_notification_image.png)

## A personal remark

This fork of the Amazon Vine Exporter is for me to fix bugs and to implement and try out new features for myself.
I have not adopted the official repository as I do not want to take on any obligations for it.
So you can use the AVE from this fork, report bugs and make suggestions for improvement.
However, I will only fix bugs or implement new things if they concern me and my time allows it.

## A word of warning

This extension is in no way official and may not comply with the guidelines.
So please never contact Amazon or sellers with questions or problems with this extension.
Use at your own risk and if you lose your Vine status as a result, you are solely responsible.

## Description:

This script enhances the experience on the Amazon Vine website. However, it does not provide you with unfair and unintended advantages over other Vine Voices. For example, there will be no automated ordering based on keywords or price! We aim to operate 100% in compliance with the terms and conditions of Amazon Vine using this script.

## How to install:

* Install Tampermonkey: [https://www.tampermonkey.net/](https://www.tampermonkey.net/)
* Install Amazon Vine Explorer: [https://github.com/deburau/AmazonVineExplorer/raw/main/VineExplorer.user.js](https://github.com/deburau/AmazonVineExplorer/raw/main/VineExplorer.user.js)

## If it does not work

If AVE does not start after installing or upgrading, try a fresh install. Beforehand make a backup of your settings or take a screenshot, if you do not know how.

Then open the Tampermonkey dashboard and delete all instances of AVE. Then open the Tampermonkey trashbin and delete all AVE instances from it.

After that you can visit the GitHub repo https://github.com/deburau/AmazonVineExplorer, click on VineExplorer.user.js and then click the Raw button.

Now Tampermonkey should open and let you install the script.

AVE should work now and can be configured to your needs.

Do not try to install it using copy and paste, as the requirements then could not be fulfilled, because they use relative paths. Please do not ask me to use absolute paths since I will not change it.

## Development

```bash
npm install       # install the dev dependencies (prettier, eslint)
npm run check     # prettier --check . and eslint .
npm run format    # prettier --write .
```

The refactorings are verified automatically, because a refactoring must not
change the behaviour. Before a refactoring the current state is frozen as the
baseline, afterwards the old and the new implementation are compared:

```bash
npm run verify:baseline   # freeze the current git commit as the baseline
# ... make the refactoring ...
npm run verify            # compare the baseline with the current state
```

The verification scripts are in `scripts/verify/`. See `AGENTS.md` for the
details.

## Changelog Deburau

##### [2026-10-26] - Version 0.12.1.48

* Tooling: the verification scripts of the refactorings moved from the local notes folder into `scripts/verify/`, so that they are part of the repository and survive a change of the machine. The new npm scripts `npm run verify` (runs all five verifications) and `npm run verify:baseline` (freezes the current git commit as the baseline) make the workflow of a refactoring reproducible. `AGENTS.md` documents the procedure.

##### [2026-10-26] - Version 0.12.1.47

* Style: the last ESLint warning (the complexity of `vineFetch()` in `vine_fetch.js`) is suppressed with an `eslint-disable` comment and a note. The function handles three kinds of requests and splitting it would change the order of the response hooks, which is relevant for the behaviour of the page. The linter now runs without any warning.

##### [2026-10-26] - Version 0.12.1.46

* Refactoring: `init()` was split up. The parsing of the tiles moved into `initTileParsing()`, the buttons for the product sites into `initNavigationButtons()`, the search bar into `initSearchBar()` and the manipulation of the pagination into `initPagination()`. The behaviour did not change, it was verified with the helper script `.unotes/verify_init.js`, which compares the created DOM, the database accesses and the calls of the old and the new implementation in four scenarios.

##### [2026-10-26] - Version 0.12.1.45

* Refactoring: the fast scan of the background scan was split up. The five conditions for starting a fast scan in `prepareFastScan()` are now one combined expression, and `backgroundScanFinished()` was split into `handleFastScanFinished()`, `shouldStopFastScan()`, `stopFastScan()` and `notifyAboutProductDrop()`. The behaviour did not change, it was verified with the helper script `.unotes/verify_scan.js`, which compares the local storage accesses of the old and the new implementation over seven scenarios, among them the three reasons why a fast scan is stopped.

##### [2026-10-26] - Version 0.12.1.44

* Refactoring: `updateNewProductsBtn()` was split up. The notification about the number of unseen products moved into `notifyAboutUnseenItems()`, the notification about the number of new products into `notifyAboutNewProducts()`, the keyword search into `searchKeywordsInProducts()` and the check of a single product into `checkKeywordsForProduct()`. The helper `stringToRegex()` became a function of its own. The behaviour did not change, it was verified with the helper script `.unotes/verify_new_products_btn.js`, which compares the database accesses, the triggered notifications, the badge, the page title and the changed products of the old and the new implementation in nine scenarios.

##### [2026-10-26] - Version 0.12.1.43

* Refactoring: the settings UI was split up. The CSS of the settings menu moved from the template literal inside `addAVESettingsMenu()` into the constant `AVE_SETTINGS_CSS`, and `createSettingsMenuElement()` was split into one function per setting type (`createSettingsBoolElement()`, `createSettingsPasswordElement()`, `createSettingsUrlElement()`, `createSettingsNumberElement()`, `createSettingsButtonElement()`, `createSettingsColorElement()`, `createSettingsSelectElement()`, `createSettingsTitleElement()` and `createSettingsKeywordsElement()`), which are called by a switch statement. The behaviour did not change, it was verified with the helper script `.unotes/verify_settings_ui.js`, which compares the created DOM of all nine setting types and the generated CSS of the old and the new implementation.

##### [2026-10-26] - Version 0.12.1.42

* Refactoring: the database helpers `markAllCurrentSiteProductsAsSeen()`, `markAllCurrentDatabaseProductsAsSeen()` and `cleanUpDatabase()` now use promises and `async`/`await` instead of callbacks. `cleanUpDatabase()` was split into `cleanUpDatabase()` and `cleanUpDatabaseEntry()`, so that the checks for a single entry live in their own function. The behaviour did not change, it was verified with a comparison of the database and local storage accesses of the old and the new implementation (normal case, failing write and failing read).

##### [2026-10-26] - Version 0.12.1.41

* Refactoring: the background scan was split into small functions, one per responsibility (`initBackgroundScan`, `initBackgroundScanStorage`, `getBackgroundScanStageZeroSites`, `backgroundScanLoop`, `prepareFastScan`, `prepareScanIteration`, `scanStageZero` … `scanStageIdle`, `backgroundScanFinished` and `formatDuration`). The state that has to survive the iterations of the scan loop is kept in a `BackgroundScanState` object. The behaviour did not change, it was verified with a comparison of the local storage accesses of the old and the new implementation over all stages of the scan.

##### [2026-10-26] - Version 0.12.1.40

* Style: all source files are formatted uniformly with Prettier (configuration in `.prettierrc`). The indentation, quotes, semicolons and line breaks are now consistent. The code was not changed otherwise; the only exception is the helper `stringToRegex()`, which was rewritten from a nested ternary with an assignment into an explicit function body, because the formatter removed the parentheses that satisfied the ESLint rule `no-cond-assign`.

##### [2026-10-26] - Version 0.12.1.39

* Fix: the background scan reused a single iframe for all scanned pages. The frame accumulated a session history with one entry per navigation, and the renderer kept the documents of those entries in memory. The memory usage of the renderer grew by about 270 MB per hour until the container ran out of memory. The iframe is now created for every scanned page and removed again after the page was scanned, which reduces the memory usage by about 670 MB (measured).
* Fix: the scanned document was kept in `unsafeWindow.ave.backGroundIFrame` for the whole session. This is now only done in debug mode.

##### [2026-10-26] - Version 0.12.1.38

* Fix: a Vine page that was loaded with a trailing slash (`https://www.amazon.de/vine/vine-items/`) broke all relative links of Amazon. The navigation button "Für Sie empfohlen" pointed to `vine-items?queue=potluck`, which was resolved against the directory `/vine/vine-items/` and therefore led to the error page `/vine/vine-items/vine-items?queue=potluck`. The trailing slash is now removed from the URL and the relative links of the navigation and the pagination are made absolute.
* Fix: the auto scan and the "Gelesen ->" pagination button used the relative pagination href of Amazon for their navigation, which could produce the same doubled path. They now use absolute URLs.

##### [2026-10-26] - Version 0.12.1.37

* Docs: added comments in the source code for all known issues that are intentionally not fixed. Each comment describes the problem and explains why it is ignored (e.g. typos that are part of the public settings API, theoretical edge cases that cannot occur in practice, or fallbacks that degrade gracefully).

##### [2026-10-26] - Version 0.12.1.36

* Fix: the heartbeat interval passed a fallback `'[]'` as the second argument to `localStorage.getItem()`, which only accepts one parameter. If the key was missing, `JSON.parse(null)` was called and the interval threw a TypeError on `_sessions.length`. Fixed by using `getItem(key) || '[]'`.

##### [2026-10-26] - Version 0.12.1.35

* Fix: session id generation could produce strings longer than intended because `Math.round(Math.random() * 36).toString(36)` could yield two characters (`"10"`). Replaced with `Math.floor(Math.random() * 36)` so that every replacement is exactly one base-36 character.

##### [2026-10-26] - Version 0.12.1.34

* Fix: clicking on a parent-ASIN product that was removed from the Vine enrollment caused a TypeError because `requestProductDetails()` set `forceRemove = true` but continued to access `res.result` afterwards.

##### [2026-10-26] - Version 0.12.1.33

* Fix: branding turned red for up to ~10 seconds after navigating inside the same tab because a new session id was generated on every page load and the old ghost session blocked the master role until the timeout expired. The session id is now persisted in sessionStorage and reused across reloads, and stale entries with the same id are cleaned up on init.

##### [2026-10-26] - Version 0.12.1.32

*  Fix: the database handler stops the request when the input is invalid instead of continuing after the error, the error messages of the methods are correct now and the database import updates the badge and the title

##### [2026-10-26] - Version 0.12.1.31

*  Fix: the database cleanup does not hang anymore if a write to the database fails, the symbol of the running cleanup is removed in every case

##### [2026-10-26] - Version 0.12.1.30

*  Fix: the writes to the database are no longer left unhandled, so that a failed write is reported instead of ending up as an unhandled promise rejection

##### [2026-10-26] - Version 0.12.1.29

*  Fix: the search for the keywords is only done if a new product was really added and not after every update of an existing product, which made the background scan unnecessarily slow

##### [2026-10-26] - Version 0.12.1.28

*  Fix: the products that could not be processed are reported on every page instead of being lost silently, and a failed product no longer leaves the page unfinished (e.g. the "new entries" page without working favorite stars)

##### [2026-10-26] - Version 0.12.1.27

*  Fix: the background scan waited for the requested page instead of reading the dom of the previous page, so that the last page of a scan is not skipped anymore

##### [2026-10-26] - Version 0.12.1.26

*  Debug: the diagnostic output of the background scan can no longer throw an error, which had stopped the scan in an endless loop

##### [2026-10-26] - Version 0.12.1.25

*  Debug: the background scan logs the requested url and the url that is really loaded in the iframe, to check whether the scanner reads the dom of the previous page

##### [2026-10-26] - Version 0.12.1.24

*  Fix: the background scan reports the products that could not be processed instead of losing the errors silently

##### [2026-10-26] - Version 0.12.1.23

*  Fix: the promise for waiting for an element no longer stays pending forever if the wait fails, so that a single broken product cannot stop the background scan anymore

##### [2026-10-26] - Version 0.12.1.22

*  Fix: a nearly white button of the navigation bar (e.g. "all products") does not glare anymore in the dark mode, it uses the background color of the dark mode instead

##### [2026-10-26] - Version 0.12.1.21

*  Fix: the text of the buttons in the navigation bar is now always readable, because it uses a contrast color that fits to the background of the button (in the dark mode the text of the "all products" button was white on a white button)

##### [2026-10-26] - Version 0.12.1.20

*  Fix: the "all products" button had the same id as the "favorites" button, so the wrong button was highlighted when the favorites were opened

##### [2026-10-26] - Version 0.12.1.19

*  Fix: the button "mark all as seen" updates the tiles of the current page right away, so that the "new" frame disappears without a reload

##### [2026-10-25] - Version 0.12.1.18

*  Fix: the callback of "mark the current site as seen" is now always called, so that the pagination does not get stuck anymore

##### [2026-10-24] - Version 0.12.1.17

*  Fix: the helpers of globals.js (e.g. addBranding) were lost, because the object for the console was replaced

##### [2026-10-24] - Version 0.12.1.16

*  Debug: the helper "ave.storeSettingsAsJsonString()" in the browser console stores the settings as a JSON string

##### [2026-10-24] - Version 0.12.1.15

*  Fix: the settings are also read if they were stored as a JSON string, they were silently ignored before

##### [2026-10-24] - Version 0.12.1.14

*  Fix: the callback of "mark all products as seen" was never called, because the database update returns a promise and not a callback

##### [2026-10-24] - Version 0.12.1.13

*  Fix: the reset of the settings removes the state information of AVE too (the state of the scan, the current page, the sessions), so that AVE behaves like after a fresh installation

##### [2026-10-24] - Version 0.12.1.12

*  Fix: the settings did not register a new listener for every reset of the settings

##### [2026-10-24] - Version 0.12.1.11

*  Fix: if an other tab takes over the master role, the background scan of this tab is stopped, so that only one tab scans

##### [2026-10-24] - Version 0.12.1.10

*  Fix: a tab in the background does not lose its session anymore, because the browser throttles its timers

##### [2026-10-24] - Version 0.12.1.9

*  Fix: the branding is not shown on the pages that are not vine pages anymore

##### [2026-10-24] - Version 0.12.1.8

*  Fix: the branding is not red on the pages that are not vine pages, there is no master/slave there

##### [2026-10-24] - Version 0.12.1.7

*  Fix: a tab on a shopping page does not take over the master role anymore, the background scan crashed there

##### [2026-10-24] - Version 0.12.1.6

*  Fix: the heartbeat does not crash anymore if the own session is missing from the session list

##### [2026-10-24] - Version 0.12.1.5

*  Fix: the unload handler does not overwrite the handler of the page anymore and does not crash if the session list is not readable

##### [2026-10-24] - Version 0.12.1.4

*  Fix: the error "AmazonVineExplorer: running inside a frame - aborted" is not shown anymore
*  Fix: the script does not run in frames anymore (e.g. in the hidden iframe of the background scan)

##### [2026-10-24] - Version 0.12.1.3

*  Fix: the timeout warnings of the optional style changes (Amazon navbar, footer, buttons, ...) are not shown anymore
*  Fix: the badges of a product are only waited for 3 seconds, they are optional

##### [2026-10-24] - Version 0.12.1.2

*  Fix: the warning "Timeout: element .vvp-no-offers-msg not found" is not shown anymore on every page with products

##### [2026-10-24] - Version 0.12.1.1

*  Reworked the ESLint configuration, so the linter reports real issues instead of hundreds of false positives
*  Fix: waitForHtmlElement() no longer calls the callback a second time with null after the element was found
*  Cleanup: added "exported" headers to all files, to document the shared global scope of the userscript

##### [2026-10-09] - Version 0.12.1

*  Merge [PR #67](https://github.com/deburau/AmazonVineExplorer/pull/67) by adripo: Fix for malformed Amazon Vine recommendation variation data

##### [2026-02-09] - Version 0.12.0

*  Desktop Notification Highlight Keywords are sorted
*  Time to wait between unseen items notification is configurable
*  Time to wait between possible new drop starting notification is configurable
*  Removed unused code
*  Fixed critical bugs and reduced ESLint errors
*  Added bilingual UI (German/English) with language selection setting

##### [2026-01-21] - Version 0.11.30
*  New setting to trigger a unseen items notification if the number of unseen items exeeds the configured number.
   The notification is sent again if the items were marked as seen and the condition is met again.
*  New setting to trigger a new items notification if the number of new items exeeds the configured number during a fast scan.
   The notification is not sent again during the next 10 fast scans.

##### [2026-01-07] - Version 0.11.29
*  Fix: waitForHtmlElement() now has a default timeout of 10 seconds to avoid all sorts of errors, mainly out of memory and styles not applied
*  Next fix [deburau/AmazonVineExplorer#54](https://github.com/deburau/AmazonVineExplorer/issues/54)
*  Handle case when product link is not present for prerelease products
*  Added _isFeatured to product class
   !!! You might have to restart yout browser !!!
*  Fix exceptions when elements not found
*  Handle badges when creating product tiles
*  Badges moved below header line

##### [2025-11-13] - Version 0.11.28
*  Fix [deburau/AmazonVineExplorer#54](https://github.com/deburau/AmazonVineExplorer/issues/54)
*  Replaced FileSaver.js and updated version from adipro
*  Imported extended fetch method from VineFetchFix directly into the project

##### [2025-10-24] - Version 0.11.27
*  Enable badge color choice (thank you adripo)
*  New setting for cleaning up favorites

##### [2025-10-06] - Version 0.11.26
*  Notifications can be sent to a Gotify server
*  Added badge counter to favorites button (thank you Galile0)
*  Change notification URL to go directly to the vine item (thank you Galile0)
*  Fix [deburau/AmazonVineExplorer#50](https://github.com/deburau/AmazonVineExplorer/issues/50): Sometimes background scan did not start

##### [2025-08-24] - Version 0.11.25
*  Fix: last_chance queue availability for vine sites that use it (thank you adripo)
*  Fix: show Gelesen button all pagination elements (thank you adripo)
*  Fix: add optional top navigation to button "Alle Artikel"
*  Fix: remove all pagination elements when necessary (thank you adripo)

##### [2025-08-12] - Version 0.11.24
*  Fast scan now is started more often, after about 15 pages, or 15 * ([Background Scan Per Page Min Delay] + [Background Scan Randomness per Page] / 2). Before it was five minutes
*  Scanning the queue "last-chance" was removed, as amazon has removed it
*  New setting "Enable auto marking product as favotite": if it is enabled, new products matching one of the desktop notification highlights are marked as favorite

##### [2025-06-21] - Version 0.11.23
*  Fix: some images where missing from product tiles, fixes [deburau/AmazonVineExplorer#30](https://github.com/deburau/AmazonVineExplorer/issues/30)

##### [2025-06-19] - Version 0.11.22
*  Fast scan now runs until after four pages without new items, fixes [deburau/AmazonVineExplorer#24](https://github.com/deburau/AmazonVineExplorer/issues/24)
*  Fix: fast scan sometimes was terminated too early, even though new items where found

##### [2025-06-18] - Version 0.11.21
*  Reenabled pagination on top, fixes [deburau/AmazonVineExplorer#25](https://github.com/deburau/AmazonVineExplorer/issues/25)

##### [2025-06-18] - Version 0.11.20
*  Setting "Enable Button All Products" had no effect, fixes [deburau/AmazonVineExplorer#20](https://github.com/deburau/AmazonVineExplorer/issues/20)

##### [2025-06-18] - Version 0.11.19
*  Cosmetic change: Explicitly assigned homepage and support url for tampermonkey overview

##### [2025-06-17] - Version 0.11.18
*  Amazon introduced new product property data-is-pre-release. Fixes [deburau/AmazonVineExplorer#21](https://github.com/deburau/AmazonVineExplorer/issues/21)

##### [2025-06-14] - Version 0.11.17
*  Search box is smaller to avoid wrapping for portrait monitors.
*  The old "Not Seen Max Count" setting is replaced by the new "Number of hours to wait" setting.

##### [2025-06-10] - Version 0.11.16
*  Removed unused (at least by me) files.
*  Make @require's relative.
*  Fix some eslint warnings.
*  The max page number now is computed for every page to scan. This fixes some wierd errors which can lead to cleaning up too many items.
*  The idle period between scans can now be configured.
*  Display time until next scan instead of time since last scan.
*  Fix error message in console log while openening the database.
*  Code refactorings to use async/await.

##### [2025-06-06] - Version 0.11.15
*  The product pages ("Für Sie empfohlen", "Verfügbar für alle" and "Zusätzliche Artikel") now always show the time it was first seen because time of last seen is always the current time.

##### [2025-05-31] - Version 0.11.14
*  Order of items shown on product sites now depends on the setting of "Show first seen instead of last seen".

##### [2025-05-31] - Version 0.11.13
*  Fix: Product not seen counter was not reset when a product was seen again during a scan.

##### [2025-05-30] - Version 0.11.12
*  Show page numbers from 1 to max instead of 0 to max - 1.

##### [2025-05-30] - Version 0.11.11
*  Re-apply Fix left side buttons (Merge pull request #15 from adripo).
*  Fix side buttons vertical distance.

##### [2025-05-29] - Version 0.11.10
*  Revert Fix left side buttons (Merge pull request #15 from adripo).

##### [2025-05-29] - Version 0.11.9
*  Fix: iframe loads only when necessary (Merge pull request #16 from adripo).

##### [2025-05-29] - Version 0.11.8
*  Fix left side buttons (Merge pull request #15 from adripo).

##### [2025-05-27] - Version 0.11.7
*  Show formatted time for Background Scanner Time Waiting (Merge pull request #12 from adripo).

##### [2025-05-27] - Version 0.11.6
*  Enable match for all vine countries (Merge pull request #11 from adripo).

##### [2025-05-27] - Version 0.11.5
*  Items are sorted descending by time last seen (Merge pull request #10 from Olum-hack).

##### [2025-03-21] - Version 0.11.4
*  Fix button height after changes on the vine site.

##### [2025-03-18] - Version 0.11.3
*  Olum found the reason (or at leat one of them) for getting temporarily blocked: fetching the estimated tax price for items with variants.  
   As a workaround, this was removed with the consequence, that estimated tax prices are not shown for this items.

##### [2024-11-22] - Version 0.11.2
*  A value of 0 for "Desktop Notifikation Delay (Seconds)" disables those notifications. This does not disable notifications for item matches.
*  Up to now, database cleanup started after one day after an item was last seen for potluck items and after 7 days for other items.
   Now it starts after the time of the last cleanup.
*  New configuration button "Show first seen instead of last seen". Instead of the "Last seen" date in the product box show the date, the item was first seen.
*  Tax price is displayed with current locale and two fraction digits.
*  Bug fix: if the number of last page to scan is a multiple of 100, an exception was thrown and the scan was aborted.

##### [2024-11-10] - Version 0.11.1
*  Simpler regular expressions for Amazon domain detection
*  Don't announce that this is the master session on none vine pages
*  Removed "Deburau Development Fork" from branding text.
   Be aware that you have to reinstall the script and remove the old one

##### [2024-11-04] - Version 0.11.0
*  Make it possible to edit the MaxItemsPerPage variable. Change contributed by Olum-hack.
*  Bumped version number from 0.10.9.0.1.deburau.18 to 0.11.0

##### [2024-10-09] - Version 0.10.9.0.1.deburau.18
* Every five minues AVE performs a fast scan. That means, potluck and last_chance are scanned and then
  encore until three consecutive pages without new products are found.

##### [2024-09-30] - Version 0.10.9.0.1.deburau.17
* Not Seen Max Count is configurable in AVE settings

##### [2024-09-19] - Version 0.10.9.0.1.deburau.16
* The database cleanup now happens right after a complete scan is finished. Prior to this change,
  the cleanup was performed after waiting for three hours, just before a new scan was started
* Add missing SECONDS_PER_WEEK to globals.js, fixes database cleanup not working.

  After the upgrade, it needs six completed background scans until old entries get deleted. Each
  scan needs about one to two hours plus three hours delay until the next scan starts. This sums
  up to one to two days until cleaning up old entries effectivly starts

##### [2024-09-18] - Version 0.10.9.0.1.deburau.15
* An alert notification is show after product data import finished
* Restart background scan after import finished

##### [2024-09-16] - Version 0.10.9.0.1.deburau.14
* Desktop notifications for products with keyword matches now open the Amazon product page

##### [2024-09-14] - Version 0.10.9.0.1.deburau.13
* Included pull request #41 from DeMoehn from original repo

##### [2024-09-09] - Version 0.10.9.0.1.deburau.12
* Multiple desktop notification keywords can be entered seperated by new lines
* BREAKING CHANGE: Database Import now clears the database prior to importing new data
* Command for database merging is removed

##### [2024-09-08] - Version 0.10.9.0.1.deburau.11
* When the enter key is pressed in the search bar, the search is executed immediately instead of waiting for the input timeout 
* The search bar input delay was increased to 500 milliseconds

##### [2024-09-03] - Version 0.10.9.0.1.deburau.10
* New command **DATABASE MERGE +++** in AVE Settings. It reads a database export and merges it into the existing database.
  New entrires are added, existing entries are overwritten. This differs from **DATABASE IMPORT <<<**, where existing entries are skipped.

##### [2024-08-28] - Version 0.10.9.0.1.deburau.9
* Defaults for **BackGroundScanDelayPerPage** and **BackGroundScannerRandomness** set to 6000

##### [2024-08-28] - Version 0.10.9.0.1.deburau.8
* When upgrading from a former database version, a check for duplicate ASINs is performed. This check fails for newly created databases with the error message
  `Something was going wrong while init database` and `DB_HANDLER.#getStore: Database Object is not defined`
  Now this check is only performed for upgrading existing databases

##### [2024-08-19] - Version 0.10.9.0.1.deburau.7
* The field "id" is used as thè primary key of the IndexedDB database. Unfortunatly it may change over
  time. This often ruslts in errors like this, because the data_asin stays constant even if the id changes.:
  `vine-items:1 Uncaught (in promise) DB_HANDLER.add(): ConstraintError: Unable to add key to index 'data_asin': at least one key does not satisfy the uniqueness requirements.`
  Now it tries to get the object first with the ID an if not found, try with the ASIN

##### [2024-08-16] - Version 0.10.9.0.1.deburau.6
* Search Bar Input Delay is now configurable

##### [2024-08-16] - Version 0.10.9.0.1.deburau.5
* Recently my IP address was temporarely blocked several times by amazon, visiting the vine site 
  returned status 503. So I raised the default for "Background Scan Per Page Min Delay(Milliseconds)"
  to 10.000 and the maximal possible value to 20.000

##### [2024-08-15] - Version 0.10.9.0.1.deburau.4
* Use ESLint and fix errors in requestProductDetails

##### [2024-08-05] - Version 0.10.9.0.1.deburau.3
* Incorporated changes from Olum (see further down)

##### [2024-08-05] - Version 0.10.9.0.1.deburau.2
* Enhancements
  - Mark all seen now only updates new products, not all products
  - Desktop notifications for products with keyword matches now open the
    Amazon product page
    
##### [2024-08-05] - Version 0.10.9.0.1.deburau.1
* Enhancements
  - isNew and isFav are now indexed. Since IndexedDB does not support 
	booleans as index, the type was changed to integer 0 and 1
* New Features
  - Desktop Notification Highlight Keywords can now be JavaScript regular
    expressions. If a keyword has the form _/\<regular expression\>/\<flags\>_,
	it is treated as a regular expression. For instance, if you want get
	notified for new SSD products, you can use the keyword _/\bssd\b/_
	and get only notified for products with "ssd" in the description, but not
	the word "crossdressed"
* Bugfixes
  - notifications are only sent once per product. Fixes #18

### Changelog Olum
##### [2024-08-04] - Version O_5
* Anzeige wann das Produkt das letzte Mal vom Scanner gefunden wurde
  
##### [2024-06-28] - Version O_4
* Background sanner stops for 3 hours after full scan
* Background sanner starts at page 0 after 10 hours
* Show status of background scanner active page / max page
* New Button for "Mark all as seen" -> Enable Button Mark all as seen
  
### Changelog Orginal
[https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer](https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer)
##### [28.06.2024] - Version 0.10.9.0.1
* Little Bugfix to work with an external Partner

##### [28.06.2024] - Version 0.10.9
* Added ability to Share Vine Items, that opens directly on Vine

##### [23.05.2024] - Version 0.10.8.8
* Disabled the Manual Scan due to Bugs

##### [12.05.2024] - Version 0.10.8.7
* Changed minimum required Symbols in Search Field from 3 to 2

##### [09.05.2024] - Version 0.10.8.6
* Changed some Code due to @require loading in Violentmonkey

##### [09.05.2024] - Version 0.10.8.5
* Changed functionality of the "mark as read" Button on the bottom of the Page https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/issues/28

##### [09.05.2024] - Version 0.10.8.4
* Added external Resource to Fix Amazon Loading Bug

##### [18.03.2024] - Version 0.10.8.3
* Merged https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/pull/31 (Changed Resource to readable GitHub Source)

##### [18.03.2024] - Version 0.10.8.2
* Added: Added Closing Button on Branding on hover. Fixing https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/issues/19

##### [25.02.2024] - Version 0.10.8.1
* Bugfix: Disabled the Tax Scan due to issues fetching the value

##### [22.02.2024] - Version 0.10.8
* Bugfix: Next Page Button is now diasbled on last page, also changed the Text to make it more comapct (maybe changeable in the Settings later)

##### [14.02.2024] - Version 0.10.7
* Added: Ability to hide Amazon Categories
* Bugfix: Object "Skip to Main Content" Button in Navbar was not hidden

##### [13.02.2024] - Version 0.10.6
* Added: Ability to hide Amazon Navbar

##### [10.02.2024] - Version 0.10.5
* Added: DarkMode (AVE Settings Menu)

##### [10.12.2023] - Version 0.10.4
* Added: Support for amazon.co.uk
* Change: Changed website detection to be able to handle double dot domain names like amazon.co.uk

##### [28.01.2024] - Version 0.10.3.8
* BugFix: Fixed Bug where only lower letters would work in the SearchBar
* BugFix: Outdated Products didn't increase the notSeenCounter while Database Cleanup
* BugFix: Products got removed by db cleanup because the timespamp check was wrong
* BugFix: LastSeen Timestanp got not saved if Product was existing in Database

##### [11.12.2023] - Version 0.10.3.1
* Update TaxValue in Tile after opend details

##### [10.12.2023] - Version 0.10.3
* Added: Show of TaxInfoPrize inside Tileview
* BugFix: Fixed the bug that Backgroundscan didn´t request Taxdata correctly
* Added: Faster Product Removement if querry returns 'ITEM_NOT_IN_ENROLLMENT' except Favorites
* BugFix: Backgroundscan didn´t restore last state and begun at 0 each time

##### [09.12.2023] - Version 0.10.2.1
* BugFix: Fixed Endlessloop when changing from empty Potluck page to AVE internal page

##### [08.12.2023] - Version 0.10.2
* BugFix: Multiple Querrys after pressing More Details Button
* Improved reliability of Databae Cleanup
* PutLuck Products get removed from Database after one day now
* Added more Master Slave Session detection handling
* Added dead Sessions removement

##### [08.12.2023] - Version 0.10.0

* Changed DB_HANDLER from Callbacks to Promises
* BugFix: Tile Processing was faster then tile loading from Amazon => Added delayloop until all tiles are loaded
* Changed Tile Processor to Promises to increase reliability
* Added Button Colors to Usersettings
* Added the possibility to delete the database (USERSETTINGS)
* Added the possibility to export the database (USERSETTINGS)
* Added the possibility to import the database (USERSETTINGS)
* First Implementation of a Session Detection - Distinguishable by the branding in the bottom left
* Background Scan will not start if Session is not the Master Session
* BugFix: addTileEventhandlers() tryed to place favStar EventHandler to early, not we will wait until Star is there.
* Performance Improvement: Only search for keywords on New Products if there is at least one configured
* User Settings Menu. Schow Name of Setting as tooltip if noe description is set.

##### [06.12.2023] - Version 0.9.0

* Improved Search function to allow multiple keywords
* More improvemnts in the background for faster datahandling, renamed a few variables to fit to new shorthand name AVE, etc.
* Added Usersettings Page, and did a lot of stuff related to this.
* Added Back to Top Button on all subpages.

##### [04.12.2023] - Version 0.8.0

* Added Desktop Notifications
* Added the All Products Button for infinite scroll thru all the vine products
* The New Products Button shows the amount of new products
* Added new Button to left Side to set ALL Products to !isNew
* Added Indicators (left bottom corner) who shows Database aktivity, Database cleanup and Backgroundscan aktivity
* Added more Randomness for Backgroundscanner. Default Delay (4S) + 0-4S Per Dataquerry from Amazon
* Changed Database function for querry all entrys to increse the performance of this function
* Added "controlled delay" (Observer) to be safe for querry product tile elements (sometimes the parser was to fast and tryed to read not existing elements)
* Added function to querry product details from amazon and merge it with product database element
* Added Product Details Fetch to Backgroundscan
* a few little bugfixes

##### [01.12.2023] - Version 0.7.1

* A lot of Stuff will work, lets call it the initial version

##### [24.11.2023] - Version 0.1

* Start of this Project

