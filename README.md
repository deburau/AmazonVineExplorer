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

##### [2026-11-03] - Version 0.15.0.20

* Fix: the search for the keywords only checks the products that were just added to the database now. Before, it checked all new products after every scanned page, so the price details of a product were requested again and again, which made Amazon block the account for a while. Every product is checked once, so its details are requested at most once.

##### [2026-11-03] - Version 0.15.0.18

* New: the fast scan has its own interval now, it is the new setting "Fast scan interval" (default 5 minutes). Before, the interval was derived from the delay per page of the background scan: the fast scan waited 15 pages before it started again. A shorter delay per page therefore made it run much more often, about every 40 seconds with a delay of 2000/1000 milliseconds.

##### [2026-11-02] - Version 0.15.0.16

* New: the tiles of the products with variations show the range from the lowest to the highest price of the variations, the currency is shown once at the end of the range. Products without variations show their price as before, products without a known price show no price as before.
* New: the prices of all variations are stored in the database. The products of an older version keep their prices, they do not have to be requested from Amazon again.
* New: the delay between the requests for the variations of a product is the setting `VariationRequestDelay` (default 500 milliseconds). The real delay is random between 50 percent and 150 percent of the value, so that the requests are not sent in a fixed rhythm. The setting is in the settings menu with the other numeric values.
* New: the pause between two products of the queue of the price details is the setting `ProductDetailsRequestDelay` (default 1500 milliseconds). The real pause is random between 50 percent and 150 percent of the value. It is not the delay of the background scan, that one is set with the settings "Background Scan Min. Delay per Page" and "Background Scan Randomness per Page". A low value can lead to a temporary block of the account by Amazon, so the value can be increased if that happens.
* New: the keywords of the notification can contain price conditions, e.g. `toaster [price >= 10] [price < 20]`. The product has to match the keyword and the price conditions, a keyword that only has price conditions never matches. The operators are `=` and `==` (one of the prices is equal), `!=` and `<>` (none of the prices is equal), `<` and `<=` (the lowest price is lower), `>` and `>=` (the highest price is higher). The price can use the dot or the comma as the decimal separator, so that it does not depend on the language of the user. A thousand separator is not allowed, the input is normalized if possible.
* The prices for the price conditions are only loaded, after the keyword of the configuration matched the description of the product. They are loaded independently of the setting `EnableDetailsOnFavorite`, because the conditions can not be checked without the prices. If the price conditions do not match, the product is not notified and not marked as favorite, so that it is checked again at the next scan.
* The notification of a keyword match is sent after the prices of the product were loaded, so that the price is known, when the notification arrives.
* Fix: the script did not start, if the database was created with an older version of AVE. The check for duplicated ASINs used a part of the database that does not exist while the database is upgraded.

##### [2026-11-01] - Version 0.15.0

* New: the keyword is now shown in the desktop notification of a keyword match. It is shown before the description of the product, because it is the reason for the notification. The word "key" is replaced by "Treffer" in German and by "Match" in English. (Fix for issue #68)
* Fix: the userscript was not activated on the Vine pages of Firefox. Firefox puts the language of the browser into the URL, e.g. "https://www.amazon.de/-/de/vine/vine-items" or "https://www.amazon.de/-/en/vine/vine-items". The detection of the Vine pages expected the path "/vine/" directly after the domain, so the script did not recognize the page and stayed inactive. The language segment is now ignored by the detection.
* Fix: the pages of the infinite scroll and of the background scan are not loaded at all if the URL contains the language segment. The base URL of the Vine pages was searched with a pattern that did not allow the segment, so the search returned nothing and the script stopped with an error. The base URL is now searched with a helper function that returns null instead of throwing an error, if no Vine URL is found.
* The images of the desktop notifications were loaded from an old fork of the project and from a branch that does not exist any more. They are now loaded from the main branch of the repository of the project.

##### [2026-10-29] - Version 0.14.0

* New: the price of a product is loaded from the Vine API, when the product is marked as favorite. That happens when you click on the star and also when a new product is marked as favorite automatically, because of a keyword match. The new setting "Load the price details when a product is marked as favorite" turns this on and off, it is on by default. The prices are not loaded during the scan, because Amazon blocks the account temporarily, if too many requests are made in a short time. The requests are made one after the other, with a pause of 1.5 seconds.
* New: the button "more details" waits now for the requests of the other products, so that all the requests are made one after the other.
* Fix: the price of the products with variants was not loaded at all. The request to Amazon failed with "No recommendation found for recommendation id".
* Fix: the products with variants show now the price of their most expensive variant.
* Fix: the price is shown on the tile with the currency and with two decimal places. Before, only the placeholder was replaced by the raw number.
* Fix: all the tiles of a product are updated, when the price arrives. A product can be shown in more than one list, e.g. in the list of the new entries and in the list of all products.
* Fix: a single product with an error does not stop the loading of the prices of the other products anymore.
* Fix: the console showed "null" instead of the error message, if a request failed.
* Fix: the tooltips of the settings are shown again. They were all lost, because a comment in the CSS of the settings menu hid the rules of the tooltips.
* Fix: if a translation is missing, the text of the setting is shown instead of the name of the translation key.
* Fix: the loading of the prices stays switched on, even if the stored setting has an unexpected value.
* Fix: the tooltip of the setting for the waiting time between the notifications showed the name of the setting instead of its description.
* The tooltips of the settings were rewritten in German and English. They now describe the effect of the setting, name the unit of the number fields and explain what the value 0 does. They are 320 pixels wide, so that the text is mostly on one line and a long word, e.g. a URL, is not cut off.
* The auto scan and its setting were removed. The auto scan could never be executed, the background scan does the same job.
* The setting for the color of the "Update Database" button was removed. The button belonged to the auto scan and had no effect.

##### [2026-10-28] - Version 0.13.0

* Fix: the background scan used about 270 MB of memory per hour, until the browser ran out of memory. The scanned pages are released now after every page, that reduces the memory usage by about 670 MB (measured).
* Fix: the links of the navigation and of the pagination did not work on the Vine pages that were opened with a trailing slash, they led to an error page.
* Fix: clicking on a product that was removed from the Vine enrollment caused an error and stopped the script.
* Fix: the branding turned red for up to 10 seconds after a click inside the same tab. The logo keeps its color now.
* Fix: the background scan stopped with an error, if the list of the sessions was missing.
* Fix: the database could stop working, if a write to it failed. The cleanup does not hang anymore, the symbol of the running cleanup disappears in every case and the products that could not be processed are reported on every page instead of being lost silently.
* Fix: the search for the keywords was done after every update of a product, which made the background scan unnecessarily slow. It is done now only, if a new product was really added.
* Fix: the background scan read sometimes the page of the previous scan, so that the last page of a scan was skipped. It waits for the requested page now, and a single broken product can no longer stop the scan.
* Fix: a nearly white button of the navigation bar does not glare anymore in the dark mode and the text of the buttons in the navigation bar is always readable.
* Fix: the "all products" button had the same id as the "favorites" button, so that the wrong button was highlighted, when the favorites were opened.
* Fix: the button "mark all as seen" updates the tiles of the current page right away, so that the "new" frame disappears without a reload. The pagination does not get stuck anymore.
* Fix: the settings were silently ignored, if they were stored as a JSON string. The reset of the settings removes the state of AVE too now, so that AVE behaves like after a fresh installation.
* Fix: the helpers of AVE (e.g. addBranding) were lost in the browser console.
* Fix: if an other tab takes over the master role, the background scan of this tab is stopped, so that only one tab scans. A tab in the background does not lose its session anymore, because the browser throttles its timers. A tab on a shopping page does not take over the master role anymore, the background scan crashed there.
* Fix: the branding is not shown on the pages that are not Vine pages anymore and it is not red there, because there is no master and no slave on those pages.
* Fix: the script does not run in frames anymore (e.g. in the hidden iframe of the background scan) and the error "AmazonVineExplorer: running inside a frame - aborted" is not shown anymore.
* Fix: the warnings in the console about missing elements of the page are not shown anymore. The badges of a product are optional, they are only waited for 3 seconds.

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

