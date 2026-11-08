# Stand des Projekts

Dieser Stand liegt im Repository, damit er nach einer Verdichtung des Chats
nicht verloren geht. Bei Fragen zuerst hier und in `git log` nachschauen.

## Aktueller Stand

| Punkt | Stand |
|---|---|
| Branch | `dev-0.18.0` (gepusht, aus `main` angelegt) |
| Version im User-Script | `0.17.0.6` (in Entwicklung, Release 0.18.0 vorbereitet) |
| Letztes Release | **0.17.0** (auf `main`, veröffentlicht, Merge-Commit `e34488d`, Doku-Commit `5f7ea82`) |
| Lint / Formatierung | 0 Errors, 0 Warnings (`npm run check`) |
| Verifikationen | alle 21 erfolgreich (`npm run verify`) |
| RAM-Verbrauch | **ok** – der Fix ist bestätigt, keine Messung mehr nötig |

## Bestätigte Tests (vom Maintainer im Browser)

| Version | Feature | Stand |
|---|---|---|
| 0.14.0.2 | Sprachsegment der URL (Firefox) | bestätigt |
| 0.15.0 | Keyword in der Benachrichtigung, Bilder (Issue #68) | bestätigt |
| 0.15.0.36 | gruppiertes Einstellungsmenü | bestätigt |
| 0.15.0.37 | Preissuche in der Suchleiste | bestätigt |
| 0.15.0.40 | Bedingungen ohne Klammern | bestätigt |
| 0.15.0.38 / 0.15.0.39 | Kategoriebedingungen, Unterkategoriename beim Turbo-Scan | bestätigt |
| 0.15.0.41 | Zeilen der Benachrichtigung (Keyword/Preis/Kategorie) | bestätigt |
| 0.15.0.44 | Neues Keyword oben in der Liste | ohne Befund |
| 0.15.0.45 / 0.15.0.46 | Abkürzungen der Bedingungen (jede Verkürzung) | ohne Befund |
| 0.15.0.47 | Verbatim-Strings in doppelten Anführungszeichen | ohne Befund |
| 0.15.0.48 | Kategoriename wird beim Speichern vervollständigt | ohne Befund |
| 0.15.0.49 / 0.15.0.50 | Vollständige Kategorienliste im Hintergrund (Wartezeit wie der Scan) | ohne Befund |
| 0.15.0.51 / 0.15.0.52 | Kategorie-Operatoren wie beim Preis, eine Kategorie je Produkt | ohne Befund |
| 0.15.0.54 | Trefferzeilen in Gotify stehen vor der Beschreibung | ohne Befund |
| 0.15.0.56 | Debug-Meldung mit Zählern (`EVENT - database changed …`) | ohne Befund |
| 0.15.0.57 | Umbenennung `processNewItems()` | ohne Befund |
| 0.16.0.2 | Virtuelle Kategorie „Alle Produkte“ im Turbo-Scan | bestätigt |
| 0.16.0.5 | Einstellbare Priorität der Gotify-Nachrichten + Testnachricht-Button | bestätigt |
| 0.16.0.6 | Buttons bleiben bei deaktivierten Kategorien (gedreht, Issue #32) | bestätigt |
| 0.16.0.7 | Korrektur: die Drehung trifft die echten Button-Elemente (`span.a-button`) | bestätigt |
| 0.16.0.8 | Korrektur: schmalere Spalte (30 px) und links am Rand (kein Padding von Amazon) | bestätigt |
| 0.16.0.9 | Korrektur: `#ave-left-buttons` ist 240 px breit (Amazon `.parent-node`) – Breite auf die Spalte begrenzt | bestätigt |
| 0.16.0.10 | Der Wrapper `#vvp-filter-container` (98 px) wird ebenfalls schmal | bestätigt |
| 0.16.0.11 | Korrektur: Spalte 24 px, Zeilenhöhe 1.2 (Amazon-Line-height war die Breite), Schrift 12 px, Padding 8px 1px | bestätigt |
| 0.16.0.12 | Korrektur: Button auf die Breite der Spalte begrenzt (`width: 100%`, `overflow: hidden`) | verworfen (Text wurde abgeschnitten) |
| 0.16.0.13 | Eigene Buttons für die schmale Spalte (`createVerticalButton()`, Klasse `ave-vertical-button`) | bestätigt |
| 0.16.0.14 | Mehr Abstand neben dem Text (`padding: 8px 4px`), Buttons bleiben beim Scrollen oben | bestätigt |
| 0.16.0.15 | Korrektur: beim Scrollen wird die **ganze Spalte** festgehängt, nicht die einzelnen hohen Buttons (sie überlappten sich) | bestätigt |
| 0.17.0.2 / 0.17.0.4 | Detailansicht öffnet sich beim Klick auf eine Desktop-Benachrichtigung (Brave) | bestätigt (2026-11-08) |
| 0.17.0.3 | Gruppe „Desktop-Benachrichtigung“ (Schalter + Keywords, Überschrift ausgeblendet) | bestätigt (2026-11-08) |
| 0.17.0.5 | Test-Button „Testnachricht senden“ in der Gruppe | bestätigt (2026-11-08, „test positiv“) |

**„ohne Befund”** heißt: der Maintainer hat die ausgelieferte **0.16.0** im Browser
benutzt und dabei am 2026-11-05 keine Auffälligkeit und keinen Fehler gefunden.
Einzelne Features wurden dafür nicht abgehakt getestet.

## Entschieden / zurückgestellt

Diese Punkte wurden besprochen und bewusst **nicht** umgesetzt – sie sollen nicht
wieder vorgeschlagen werden:

| Punkt | Entscheidung |
|---|---|
| Schreib- und Loglast reduzieren (`ts_lastSeen` nur einmal pro Minute schreiben, Aufruf-Spuren erst ab `DebugLevel > 5`) | **entfällt** (Entscheidung des Maintainers, 2026-11-06) |
| Vorsorge gegen Kontosperre (Notbremse/Queue-Limit für die Detail-Requests aus `docs/ANALYSE-DETAILS-REQUESTS.md`) | **auf unbestimmte Zeit zurückgestellt** (2026-11-06) |

## Was in dieser Session gemacht wurde

### Release 0.13.0 (auf `main` veröffentlicht)

* **RAM-Fix**: Der Background-Scan benutzte ein einziges Iframe für alle
  gescannten Seiten. Das Frame sammelte eine Session-History mit einem Eintrag
  pro Navigation, und der Renderer hielt die Dokumente im Speicher. Das Wachstum
  von ~270 MB/h ist weg. Das Iframe wird jetzt pro Seite neu erzeugt und
  danach wieder entfernt.
* **URL-Bug**: Eine Vine-Seite mit Trailing Slash (`…/vine/vine-items/`) hat alle
  relativen Links von Amazon kaputt gemacht.
* **Session, Datenbank, Produkte**: 4 weitere echte Fehler behoben.
* **Refactoring**: Scan, Fast-Scan, DB-Helfer, Settings-UI und `init()` in
  Einzel-Funktionen zerlegt, jeweils maschinell verifiziert.
* **Tooling**: Prettier, ESLint ohne Warnungen, 5 Verifikations-Skripte
  versioniert, `npm run verify` und `npm run verify:baseline`.
* **Docs**: Alle Kommentare englisch, mit JSDoc. `AGENTS.md` und `HANDOVER.md`
  aktualisiert.

### Feature: Preisdetails beim Favorisieren (0.13.0.2 bis 0.13.0.6)

* Neue Einstellung `EnableDetailsOnFavorite` (Standard: an). Die Preisdetails
  werden geladen, wenn ein Produkt als Favorit markiert wird – per Stern-Klick
  oder automatisch durch ein Keyword-Match.
* Die Requests laufen über eine **Queue** (1,5 s Abstand), weil Amazon den
  Account temporär sperrt, wenn zu viele Requests in kurzer Zeit kommen. Der
  Button "Weitere Details" läuft jetzt ebenfalls über die Queue.
* Ein Produkt mit **Parent-ASIN** (Varianten) hat keinen eigenen Preis. Es
  werden **alle** Varianten abgefragt, der Preis ist der **höchste** der
  Varianten. Die Datenpunkte aller Varianten landen in `data_childs`.
* **Regression-Bug gefunden und behoben** (`c4f9e57`): Die Recommendation-ID
  enthält ein `#` als Trennzeichen. Bei einer Anfrage wurde es nicht URL-encodiert
  (`replace(/#/g, '#')` statt `'%23'`), dadurch kam nur der Teil vor dem `#`
  beim Server an ("No recommendation found for recommendation id"). Der Bug
  besteht seit dem Commit `5858238` (Februar) und erklärt, warum "Weitere
  Details" bei Produkten mit Varianten nie funktioniert hat.
* `updateTileStyle()` aktualisiert jetzt **alle** Tiles eines Produkts (ein
  Produkt kann in mehreren Listen stehen) und schreibt den Preis als Ganzes
  (mit Währung und 2 Nachkommastellen).
* `loadSettings()`: `EnableDetailsOnFavorite` ist für jeden Wert außer `false`
  an. Ein kaputter Wert im gespeicherten Settings-Stand schaltet die Funktion
  nicht mehr still ab.

### Tooltips der Einstellungen (0.13.0.7 bis 0.13.0.9)

* Die **Tooltips waren kaputt**: Der Commit `abca4ae` hatte die CSS-Kommentare
  von `/* */` auf `//` umgestellt. In CSS ist `//` kein Kommentar — der Browser
  verwirft die ganze Regel ohne Fehlermeldung. Damit waren **alle** Regeln der
  Tooltips verloren. Der Wächter `scripts/check_css_syntax.js` verhindert das.
* Die Tooltips wurden neu formuliert (de + en): sie beschreiben die **Wirkung**
  der Einstellung, nennen die **Einheit** der Zahlenfelder und erklären, was der
  Wert **0** bewirkt. Die Texte bleiben kurz, weil der Tooltip nur 160 Pixel
  breit ist (~20 Zeichen pro Zeile, Maximum 6 Zeilen).
* `translate()` benutzte den **Fallback des Aufrufers nicht**: `t()` gibt den
  Schlüssel zurück, wenn eine Übersetzung fehlt. Neu ist `lookupTranslation()`.

### Toter Code (0.13.0.10 bis 0.13.0.12)

* Der **Auto Scan** (`startAutoScan()`, `handleAutoScan()`,
  `showAutoScanScreen()`, `updateAutoScanScreenText()`, `aveUrlWithPage()`,
  `PAGE_LOAD_TIMESTAMP` und vier Variablen) wurde entfernt. Das Flag
  `AVE_INIT_AUTO_SCAN` wurde in der **gesamten Historie nie auf `true` gesetzt**
  — der Button, der es gesetzt hat, war schon lange auskommentiert. Der
  Background Scan macht dieselbe Arbeit und hat eine eigene Cleanup-Stage.
* `markAllCurrentDatabaseProductsAsSeen()` bleibt erhalten: Es wird vom
  Verifikationsskript `verify_db_helpers.js` getestet.
* Die Einstellung `BtnColorUpdateDB` wurde entfernt: Sie gehörte zum
  auskommentierten „Update Database"-Button und hatte keine Wirkung.
* Der Schlüssel `NewItemsNotificationRepititionMinutes` war in den
  Beschreibungen mit einem `i` weniger geschrieben, dadurch wurde die
  Beschreibung nie gefunden. Der Wächter `scripts/check_settings_keys.js`
  prüft jetzt alle Schlüssel.

### Release 0.14.0 (auf `main` veröffentlicht)

* Das **Feature „Preisdetails beim Favorisieren"** ist fertig: Der Preis wird
  geladen, wenn ein Produkt als Favorit markiert wird (Stern oder Keyword-Match).
  Abschaltbar über `EnableDetailsOnFavorite`, Queue mit 1,5 s Abstand, nicht
  während des Scans. Bei Produkten mit Parent-ASIN werden alle Varianten
  abgefragt, der Preis ist der höchste.
* Der **Recommendation-ID-Fehler** (`replace(/#/g, '#')` statt `'%23'`) wurde
  behoben. Er bestand seit Februar und ist der Grund, warum „Weitere Details"
  bei Varianten-Produkten nie funktioniert hat.
* Die **Tooltips** der Einstellungen funktionieren wieder (CSS-Kommentar `//`),
  sind neu formuliert (de + en) und 320 px breit.
* Der **tote Auto-Scan** (nie ausführbar) und die Einstellung `BtnColorUpdateDB`
  wurden entfernt.
* Zwei **Wächter-Skripte** schützen vor Wiederholungen:
  `scripts/check_css_syntax.js` und `scripts/check_settings_keys.js`.
* Der Changelog der Versionen 0.13.0.1 bis 0.13.0.13 ist in **einem** Eintrag
  für die Version 0.14.0 zusammengefasst (Merge-Commit `5146428`).

### Release 0.15.0 (auf `main` veröffentlicht)

* Die **Erkennung der Vine-Seiten** unterstützt jetzt das Sprachsegment in der
  URL, das Firefox setzt (`/-/de/vine/vine-items`). Vorher war das Script auf
  diesen Seiten **gar nicht aktiv** und der Infinite Scroll sowie der
  Background-Scan brachen mit einem Fehler ab.
* Die **Desktop-Benachrichtigung** zeigt das auslösende Keyword jetzt **vor**
  der Beschreibung des Produktes, übersetzt als „Treffer" (de) bzw. „Match" (en).
  Damit ist **Issue #68** erledigt.
* Die **Bilder der Benachrichtigungen** kommen aus dem richtigen Repository
  (`deburau/AmazonVineExplorer`) statt aus einem alten Fork.
* Der neue Wächter `scripts/verify/verify_site_detection.js` prüft die Erkennung
  gegen 16 verschiedene URLs.

Das Release ist veröffentlicht (Merge-Commit `75bb04b`). Issue #68 ist mit dem
Release erledigt und wurde geschlossen.

### Feature: Preise der Varianten (Release 0.16.0)

* Die Produkte haben eine neue Spalte `data_estimated_tax_prices` mit der Liste
  der Preise **aller** Varianten. Produkte ohne Varianten haben dort ein Array
  mit einem Element. Das Feld `data_estimated_tax_prize` wird **nicht mehr
  geschrieben** (es bleibt bis zu einem späteren Release in der Datenbank).
* Die **Datenbank hat die Version 5**. Der Upgrade migriert die vorhandenen
  Produkte: der Preis des Produkts wird aus `data_estimated_tax_prize`
  übernommen, die Preise der Varianten aus den Varianten (`data_childs`). Die
  Produkte müssen also **nicht** neu bei Amazon angefragt werden.
* Der **Upgrade-Pfad wurde repariert**: Die Duplikat-Prüfung für den
  ASIN-Index benutzte das Datenbank-Objekt, das während des Upgrades noch nicht
  existiert (Ausnahme → das Upgrade bricht ab). Die Prüfung läuft jetzt im
  Cursor der Upgrade-Transaktion und prüft die **ASINs** statt der IDs.
* Die **Tiles** zeigen den Bereich vom kleinsten bis zum größten Preis
  („12,34 - 25,00 €"), die Währung steht einmal am Ende. Ohne Variantenpreise
  bleibt es wie bisher (ein Preis bzw. „--.--"). Die Preise werden **nur** aus
  `data_estimated_tax_prices` gelesen.
* neuer Wächter `scripts/verify/verify_tax_prizes.js` (12 Fälle: Migration und
  Anzeige), `verify_details_on_favorite.js` prüft zusätzlich die gespeicherten
  Variantenpreise.

### Beschleunigung der Preisdetails (Release 0.16.0)

* Die Verzögerung zwischen den Requests der Preisdetails war fest **1500 ms**.
  Bei einem Produkt mit 20 Varianten dauerte das Nachladen deshalb rund
  **30 Sekunden** (19 × 1,5 s + Request-Zeit), das Tile wurde erst am Ende
  aktualisiert.
* Die Verzögerung **zwischen den Varianten** ist jetzt die Einstellung
  **`VariationRequestDelay`** (Default **500 ms**). Der echte Abstand ist
  **zufällig zwischen 50 % und 150 %** des Werts, damit die Requests nicht in
  einem festen Rhythmus kommen. 20 Varianten brauchen damit ca. 3 s.
  Die Einstellung steht im Menü bei den anderen Zahlenwerten (oben sind nur
  die Toggles).
* Die Verzögerung **zwischen den Produkten** der Queue ist jetzt die Einstellung
  **`ProductDetailsRequestDelay`** (Default **1500 ms**), ebenfalls mit ±50 %
  Zufall. Die Requests laufen während des Scans also nicht schneller als
  vorher. Das ist **nicht** die Verzögerung des Background Scans (die kommt aus
  `BackGroundScanDelayPerPage`).
* Risiko: Ein zu kleiner Wert kann zu einer temporären Sperre des Accounts
  durch Amazon führen. Der Wert ist darum bis 10.000 ms einstellbar.
* neuer Wächter `scripts/verify/verify_request_delay.js` (11 Fälle).

### Reihenfolge beim Keyword-Treffer (Release 0.16.0)

* Die Benachrichtigung bei einem Keyword-Treffer wird jetzt **nach** dem Laden
  der Preise gesendet: **Produkt matcht Keyword → Preise abfragen → Desktop-
  und/oder Gotify-Benachrichtigung**. Vorher kam die Benachrichtigung sofort,
  die Preise wurden danach im Hintergrund geladen.
* Die Preise werden nur für die Produkte geladen, die **automatisch als Favorit
  markiert** werden (`EnableAutoMarkFavorite`). Ohne Auto-Favorit gibt es keine
  Preisanfrage und die Benachrichtigung geht sofort raus.
* `checkKeywordsForProduct()` und `searchKeywordsInProducts()` sind deshalb
  **asynchron** geworden, `processNewItems()` wartet auf die Suche.
* Das Produkt wird **vor** dem Laden der Preise gespeichert (`isNotified = 1`),
  damit es bei einem zweiten Suchlauf nicht doppelt benachrichtigt wird.

### Preisbedingungen in den Keywords (Release 0.16.0)

* Ein Keyword kann **Preisbedingungen** enthalten:
  `toaster [price >= 10] [price < 20]`
* Der Ablauf ist: **Keyword-Match → Preise abrufen → Preis-Match → Aktionen**.
  Eine Preisbedingung **ohne** Keyword matcht nie. Die Preise werden **erst
  nach einem erfolgreichen Keyword-Match** geladen – passt das Keyword nicht,
  wird kein einziger Request für die Preise gemacht (wird von
  `verify_details_on_favorite.js` geprüft).
* Die Preise werden für die **Preisbedingungen unabhängig** von der Einstellung
  `EnableDetailsOnFavorite` geladen (die Bedingung kann sonst nicht geprüft
  werden). Die Einstellung entscheidet nur, ob die Preise bei einem Keyword
  **ohne** Preisbedingung geladen werden (Auto-Favorit). Der Benutzer kann
  die Preise immer über „Weitere Details“ laden.
* Operatoren: `=`/`==` (ein Preis ist gleich), `!=`/`<>` (kein Preis ist gleich),
  `<`/`<=` (der kleinste Preis ist kleiner), `>`/`>=` (der größte Preis ist
  größer).
* Die Zahl darf nur ein Trennzeichen (`.` oder `,`) haben. Sind beide
  vorhanden, ist das letzte das Dezimaltrennzeichen, die anderen sind
  Tausendertrennzeichen und werden entfernt.
* Passt die Preisbedingung nicht, wird das Produkt **nicht** benachrichtigt und
  **nicht** als Favorit markiert – es wird beim nächsten Scan erneut geprüft.
* Neue Funktionen: `normalizePriceInput()`, `parsePriceCondition()`,
  `parseKeywordConfig()`, `matchPriceConditions()`, `loadProductDetails()`.
* **Vollständige Kategorienliste im Hintergrund** (0.15.0.49):
  `loadCategoryListInBackground()` prüft über `isCategoryCacheComplete()`, ob die
  Hauptkategorien **und** die Unterkategorien aller Hauptkategorien frisch (24 h)
  vorliegen; sonst werden die Seiten nacheinander **mit der Wartezeit des
  Hintergrund-Scans** (`getScanDelay()` = `BackGroundScanDelayPerPage` + Zufall)
  geladen – eine eigene Konstante gibt es dafür nicht mehr (0.15.0.50). Aufruf am Ende von
  `completeDelayedInit()` und danach alle
  `CATEGORY_LOAD_CHECK_INTERVAL_SECONDS` (30 min). **Vorrang vor dem Scan**: in
  `scanLoop()` wird vor jedem Schritt `isCategoryListLoadRunning()` geprüft (Merker
  `AVE_CATEGORY_LOAD_IS_RUNNING` mit 5-Minuten-Timeout, damit ein geschlossener Tab
  nicht blockt) – der Scan wartet also. Während des Ladens steht die Meldung unten
  links (`showCategoryLoadScreen()` auf dem Element des Scan-Bildschirms, i18n
  `notifications.loadingCategories`). Jede Liste wird sofort in den Cache
  geschrieben, ein Abbruch verliert nichts. Wächter
  `scripts/verify/verify_category_load.js` (25 Fälle mit gemockten
  Kategoriefunktionen, `delay` und local storage).
* **Kategoriename beim Speichern vervollständigt**: `aveExpandCategoryNames(text,
  names)` ersetzt den getippten Teil durch den ganzen Namen aus der Kategorieliste
  (`aveGetCategoryNames()`), gespeichert wird `category~"Lebensmittel & Getränke"`.
  Die Namen kommen aus `getVineCategoryParents()` (lädt die Liste höchstens einmal,
  24 h Cache) und aus den **bereits gecachten** Unterkategorien
  (`readCategoryCache().children`) – für ein Keyword ohne Kategoriebedingung wird
  nichts geladen (der change-Handler ist dafür `async`).
* **Kategorie-Operatoren wie beim Preis** (0.15.0.51): `parseCategoryCondition()`
  liest `<wort><operator><name>` mit `=`, `==`, `!=`, `<>`, `<`, `<=`, `>`, `>=`;
  `matchCategoryConditions()` prüft **einen** Namen: **ein Produkt hat genau eine
  Kategorie** (0.15.0.52). Ist der Text der Seite ein Pfad („Haupt > Unter", siehe
  `getPageCategoryText()` / `getCategoryTextById()`), ist der **letzte** Name die
  Kategorie des Produkts – kein min/max mehr, die Operatoren wirken direkt wie beim
  Preis. Das `~` der
  älteren Versionen ist **kein Operator mehr** (eine solche Bedingung wird ein
  normaler Text, der nichts matcht) – im `aveExpandCategoryNames()` werden nur noch
  `=`, `==`, `!=`, `<>` vervollständigt, weil `<`/`>` eine Alphabet-Grenze und kein
  Name sind.
* **Verbatim-Strings**: ein Teil eines Keywords in **doppelten
  Anführungszeichen** wird genau so gesucht (mit Leerzeichen), z. B. `"kaffee
  bohnen"`; ohne Anführungszeichen müssen wie bisher nur alle Wörter irgendwo
  vorkommen (`a b` passt auf `a x b`, `"a b"` nicht). Zerlegt von
  `aveSplitQuotedWords()` (Anführungszeichen bleiben im Wort), verglichen mit
  `aveUnquoteKeywordPart()` in `matchesKeyword()`. Für Kategorienamen gilt es
  ebenso (`category~"kaffee tee"` – der Parser entfernt die Anführungszeichen),
  und in der Suche werden die Wörter ohne Anführungszeichen an `database.query()`
  gegeben, weil dessen `includes()` genau die Verbatim-Semantik hat.
* **Abkürzungen der Bedingungen**: **jede Verkürzung** der Feldnamen, also
  `p`/`pr`/`pri`/`pric`/`price` und `c`/`ca`/`cat`/…/`category`. Geprüft von
  `aveIsConditionWord(word, field)` (nutzt `String.startsWith()`); die Parser
  `parsePriceCondition()`/`parseCategoryCondition()` lesen den Feldnamen als Wort
  (`^([a-z]+)…`) und prüfen ihn damit, ebenso der Schnelltest und die
  Ungültig-Prüfung in `parseKeywordConfig()`. Eine Verkürzung mit falschem
  Operator (z. B. `ca>=10`) macht das Keyword ungültig, `preis>=10` bleibt Text.
* **Abkürzungen der Bedingungen** (ursprünglich 0.15.0.45, nur `p`/`pr` und `c`/`cat`): `p`/`pr` für `price`, `c`/`cat` für
  `category` (z. B. `kaffee p>=10 c~getränke`). Erkannt von `parsePriceCondition()`
  und `parseCategoryCondition()` (Regex mit Alternativen) **und** vom Schnelltest
  in `parseKeywordConfig()` (dort stand vorher ein `includes('price')`, das die
  Abkürzungen ignoriert hätte). Beim Speichern schreibt
  `aveExpandKeywordAbbreviations()` das ganze Wort in die Einstellung, damit die
  Liste immer `price>=10` zeigt – die Abkürzung wird nur direkt vor einem Operator
  bzw. der Tilde ersetzt, `preis>=10` bleibt also ein Text.
* **Neue Keywords** in den Einstellungen stehen **oben** in der Liste
  (`SETTINGS[dat.key].unshift(...)` im change-Handler von
  `createSettingsKeywordsElement()`), damit sie direkt unter dem Eingabefeld
  sichtbar sind. Beim Aufbau der Einstellungen sortiert dieselbe Funktion die
  Liste weiterhin alphabetisch – nach dem Neuladen gilt also wieder die Sortierung.
  Wächter `scripts/verify/verify_keyword_order.js` (10 Fälle, mit einem kleinen
  DOM-Mock: Sortierung beim Aufbau, neues Keyword oben, Reihenfolge mehrerer
  Eingaben, keine Dubletten, Feld `index` der Zeilen).
* Bedingungen stehen **ohne Klammern** und sind immer ein **eigenes Wort**
  (`price>=10`, `price >= 10`, `price<5`, `category~getränke`). Die Leerzeichen
  um den Operator sind optional (ein Tokenizer liest 1–3 Wörter,
  `parseKeywordConfig()`), `[price=0]` ist dagegen **Text** (die Klammern sind
  auf einer deutschen Tastatur AltGr-Kombinationen und waren in einer
  Remote-Sitzung nicht tippbar). Der Name einer Kategorie ist **ein** Wort
  (`category~kaffee tee` → Kategorie "kaffee" + Text "tee").
* **Umbenennung** (0.15.0.57): `updateNewProductsBtn()` heißt jetzt
  `processNewItems()` – der Name beschreibt die Arbeit an den neuen Einträgen
  (Abzeichen, Seitentitel, Meldungen, Keyword-Suche), nicht den Knopf. Ebenso
  tragen die Logzeilen wieder den Namen ihrer eigenen Funktion
  (`matchesKeyword()`, `checkKeywordsForProduct()`, `matchesPriceConditions()`,
  `searchKeywordsInProducts()`); vorher stand dort überall
  `updateNewProductsBtn():`. Die Wächter `verify_new_items.js` (führt je
  Seite den passenden Namen aus) und `verify_init.js` (beide Namen schreiben
  dasselbe Etikett) bleiben „identisch".
* **Meldung des Datenbank-Events** (0.15.0.56): `DB_HANDLER.#fireDataChangedEvent()`
  zählt die Schreibvorgänge und die neuen Produkte des Entprellfensters (250 ms) und
  gibt sie als `detail` mit `ave-database-changed` mit (`ave_eventhandler.emit(name,
  detail)` → `CustomEvent`); der Zuhörer loggt
  `EVENT - database changed (12 writes, 1 new product)` bei `DebugLevel > 1`. Die
  Zähler werden **vor** dem Feuern zurückgesetzt, damit die Schreibvorgänge eines
  Zuhörers zum nächsten Fenster gehören.
* Die Benachrichtigungen (**Desktop und Gotify**) nennen den Grund des Treffers
  in **bis zu drei Zeilen vor der Beschreibung des Produkts** (0.15.0.55; in der
  Gotify-Nachricht stehen sie damit an derselben Stelle wie in der
  Desktop-Benachrichtigung): `Keyword-Treffer: <keyword>`,
  `Preis-Treffer: <Preis des Produkts, bei Varianten die Spanne>` und
  `Kategorie-Treffer: <Name der Kategorie>`. Eine Zeile nur, wenn es die Art des
  Treffers gab. Gebildet von `formatMatchLines()` (i18n `notifications`:
  `keywordMatch`, `priceMatch`, `categoryMatch`, de/en).
* Wächter `scripts/verify/verify_keyword_conditions.js` (173 Fälle: Preise,
  Kategorien, die Priorität der Gotify-Nachricht, das Parsen und die Vergleiche,
  Klammern als Text), `verify_gotify_priority.js` (23 Fälle: die Anfrage an den
  Server und die Priorität der Nachricht), `verify_search.js` (21 Fälle) und
  `verify_match_lines.js` (10 Fälle: die Zeilen der Benachrichtigung; zwei
  Textprüfungen zusätzlich in `verify_new_items.js`).
* **Kategoriebedingungen** in den Keywords (`category~getränke`):
  `parseCategoryCondition()` + `matchCategoryConditions()` (Teilstring, klein
  geschrieben, alle Bedingungen müssen passen). Es muss ein **Keyword oder eine
  Kategorie** angegeben sein (nur Preis bleibt ungültig). Die Kategorie eines
  Produkts wird **nicht** in der DB gespeichert, sondern beim Parsen aus der
  Seite gelesen (`getPageCategoryText()`, der `selectedNode` im Sidebar) und an
  die Suche **mitgegeben** (`productsToCheckForKeywords` enthält jetzt
  `{prod, categoryText}`). Ein Produkt, das schon in der DB ist und später auf
  einer Kategorieseite gesehen wird (z. B. durch den Turbo-Scan), wird **einmal**
  nachgeprüft (`categoryCheckedProducts` + `hasCategoryCondition()`), sonst
  würde eine Kategoriesuche nie greifen. Der Turbo-Scan kennt die Nummern seiner
  Kategorie und gibt die **Namen** an den Scanner (`getCategoryTextById()`, aus
  dem Kategorie-Cache): bei einer Unterkategorie `"Haupt > Unter"`, damit beide
  Namen matchen (`backGroundTileScanner(url, cb, { categoryText })`). Die **Suche** (Suchleiste) kann
  Kategorien nicht prüfen (`searchProducts()` warnt und liefert nichts).
* Die **Suche** (Suchleiste) kann dieselben **Preisbedingungen** benutzen wie die
  Keywords (`searchProducts()` in der Hauptdatei): `kaffee [price >= 10]`, aber
  auch **nur** nach dem Preis (`[price < 5]`, dann werden alle Produkte mit
  bekanntem Preis geprüft, `database.getAll()`). Produkte **ohne** bekannten
  Preis erfüllen keine Bedingung und sind nicht im Ergebnis. Eine ungültige
  Bedingung (`[price > abc]`) liefert kein Ergebnis (Warnung in der Konsole).
  Wächter: `scripts/verify/verify_search.js` (16 Fälle).
* Ein Keyword mit **mehreren Wörtern** matcht, wenn **alle Wörter** im Text
  vorkommen (Reihenfolge und Abstand egal, `matchesKeyword()`). Vorher waren die
  Wörter eine Phrase (direkt hintereinander in dieser Reihenfolge). Ein Regex
  wie `/toaster/i` gilt weiter wie geschrieben.
* Ein Keyword, dessen Preisbedingung **zwischen** zwei Wörtern steht
  (`toaster [price > 100] white`), wurde vorher zum Suchtext `toaster   white`
  (drei Leerzeichen) und fand damit nie etwas. Der Leerraum um die Bedingung
  verschwindet jetzt mit ihr (`parseKeywordConfig()`).

### Turbo-Scan (das Konzept, umgesetzt in 0.15.0.32)

**Nächster geplanter Schritt.** Ziel: neue Produkte in einer kleinen, vom
Benutzer gewählten Menge von Kategorien **innerhalb von Sekunden** finden
(wertvolle Produkte sind oft nach wenigen Minuten vergriffen).

* Eine eigene Schleife lädt in konfigurierbarem Takt (Default **30 s**) die
  **erste Seite** jeder konfigurierten Kategorie und parst die Tiles wie
  gewohnt.
* **Entscheidungen:** Textliste (wie die Keywords) **mit Unterkategorien** –
  Tendenz zu Nummern statt Namen; der Turbo-Scan läuft **immer** (unabhängig
  vom Background-Scan), nur in der Master-Session.
* **Kein** neues Produktfeld, **keine** DB-Migration, **keine**
  Kategorie-Bedingung in der Keyword-Suche – die Kategorie dient nur zum Bauen
  der URL.
* Der bestehende Scan (Haupt-/Fast-Scan) wird **nicht** umgebaut, damit
  `verify_scan.js` gültig bleibt.
* Kosten: 1 Kategorie = 120 Seiten/h = **+8 %** auf den Haupt-Scan,
  2 Kategorien = 240 Seiten/h = **+17 %**.
* Alle Messwerte, die Kategorie-Struktur (`pn`/`cn`, Sidebar-DOM) und die
  Begründung, warum der Fast-Scan das nicht leisten kann: **`docs/TURBO-SCAN.md`**.
* **Stand der Umsetzung:** Eigene Kategorie-Einstellung `TurboScanCategories`
  mit Checkboxen (Unterkategorien werden beim Aufklappen geladen, bereits
  gewählte Hauptkategorien öffnen sich von selbst), `EnableTurboScan` und
  `TurboScanIntervalSeconds` stehen in den Einstellungen. Das Lesen der
  Kategorien: `getVineCategoryParents()` / `getVineCategoryChildren()`. Sie
  lesen die Kategorien **zuerst aus dem DOM der aktuellen Seite** (die sind dort
  immer vorhanden, bevor `createProductSite()` den Container leert) → **kein
  Request**; nur wenn die Seite sie nicht hat bzw. der Cache leer ist, wird die
  Seite per `fetch` im Hintergrund geladen. Cache in `AVE_CATEGORY_CACHE`,
  Wächter `verify_category_tree.js` (24 Fälle) und
  `verify_settings_categories.js` (32 Fälle).
* **Turbo-Scan ist umgesetzt** (0.15.0.32):
  **Kein Seiten-Hash:** Ein Zwischenstand (0.15.0.33) hat das Parsen der Tiles
  übersprungen, wenn ein Hash der Produkt-Ids gleich blieb. Das war **nicht** die
  Ursache der Langsamkeit (die Pause zwischen den Seiten ist es) und wurde
  wieder entfernt (0.15.0.34).
  `isTurboScanDue()` (Einstellung an + Kategorien vorhanden + Wartezeit bzw.
  laufende Runde) und `scanStepTurbo()` (eine Kategorie-Seite pro Schritt,
  `?queue=all_items&pn=<pn>&cn=<cn>&page=1`, Rotationszähler
  `AVE_TURBO_SCAN_CATEGORY_INDEX`, Rundenende setzt `AVE_TURBO_SCAN_LAST_TIME`).
  Der Schritt läuft **in derselben Schleife** wie der Background-Scan (Priorität
  Turbo vor BG, eine Seite pro Schritt) und benutzt `backGroundTileScanner()` –
  dadurch werden neue Produkte gespeichert und die Keyword-Suche läuft wie
  gewohnt. Die Schleife startet, wenn **einer** der beiden Scans an ist.
  Wächter: `scripts/verify/verify_turbo_scan.js` (34 Fälle).
* **Virtuelle Kategorie „Alle Produkte“** im Turbo-Scan (0.16.0.2): die Liste der
  Kategorien in den Einstellungen endet mit dem Eintrag `TURBO_SCAN_ALL_CATEGORY_ID`
  (`'all'`, Label aus i18n `settings.turboScanAllItems`, de „Alle Produkte“). Ist er
  angehakt, lädt `scanStepTurbo()` als **letzten Schritt einer Runde** die normale
  erste Produktseite (`?queue=all_items&pn=&cn=&page=1`, wie der Background-Scan) –
  `parseTurboScanCategory('all')` liefert dafür leere Nummern und
  `getTurboScanCategories()` hängt den Eintrag **immer ans Ende**, egal wo er in
  `SETTINGS.TurboScanCategories` steht. Die Zeile hat keinen Pfeil
  (`toggleSettingsCategoryChildren()` kehrt für sie sofort zurück), damit sie wie eine
  Hauptkategorie aussieht.
* **Buttons bleiben bei deaktivierten Kategorien** (0.16.0.6, Issue #32): `DisableCategories`
  blendet die Seitenleiste `#vvp-browse-nodes-container` nicht mehr aus, sondern macht sie
  zu einer **schmalen Spalte** (46 px). Das CSS aus `getVerticalButtonsCss()` blendet alles
  darin aus **außer** `#ave-left-buttons` (dem Container der drei Buttons) und dreht die
  Buttons (`writing-mode: vertical-rl` + `transform: rotate(180deg)`, Stil aus
  `getLeftSideButtonStyle()`); `addVerticalButtonsStyle()` hängt das CSS einmal in den Kopf
  der Seite. `window.onscroll` hängt die Buttons in **beiden** Modi oben fest, damit sie beim
  Scrollen sichtbar bleiben (seit 0.16.0.14; vorher waren sie in der schmalen Spalte aus dem
  Fluss genommen). **Seit 0.16.0.15** wird in der schmalen Spalte nicht jeder einzelne Button
  festgehängt (die Abstände 5/40/75 px sind für die flachen Buttons gedacht, die hohen
  gedrehten Buttons überlappten sich damit), sondern der Container `#ave-left-buttons` – die
  Buttons behalten so ihre Reihenfolge und ihren Abstand (`gap: 4px`).
  Wächter: `scripts/verify/verify_left_side_buttons.js` (40 Fälle).

  **Nachtrag 0.16.0.7:** `createButton()` erzeugt **keinen `<button>`**, sondern
  `<span class="a-button">` mit inneren Spans – der Selektor `#ave-left-buttons button`
  traf nichts, darum waren die Buttons weiter waagerecht. Das CSS zielt jetzt auf
  `.a-button`, `.a-button-inner` und `.a-button-text`; der Wächter prüft zusätzlich, dass
  das CSS zu den Klassen passt, die `createButton()` setzt.

  **Nachtrag 0.16.0.8:** Die Spalte ist nur noch **30 px** breit und das Padding der
  Seitenleiste ist auf 0 gesetzt (`padding`, `margin-left`, `box-sizing`), damit die Buttons
  am **linken Rand** stehen statt in die Produktspalte zu ragen. Das Padding der gedrehten
  Buttons ist auf `10px 1px` verkleinert.

  **Nachtrag 0.16.0.9:** Der Container `#ave-left-buttons` trägt die Klasse `parent-node`
  von Amazon und war damit **240 px breit**; `align-items: center` zentrierte die Buttons
  darin und schob sie nach rechts (Messung im Browser: `width: 240px`, `rect.left: 37.33`).
  `width`/`max-width: 100%` begrenzen ihn jetzt auf die Breite der Spalte, das Padding, der
  Rand und der Hintergrund von `parent-node` sind auf 0 bzw. `none` gesetzt.

  **Nachtrag 0.16.0.10:** Der Wrapper der Seitenleiste `#vvp-filter-container` (in der
  Messung 98 px, AVE benutzt ihn nicht) wird auf 30 px gesetzt, damit die Produkte auch
  diesen Platz bekommen.

  **Nachtrag 0.16.0.11:** Die Spalte ist nur noch **24 px** breit. In senkrechter Schrift
  ist die **Zeilenhöhe** die Breite des Kastens – Amazons `.a-button-text` bringt eine große
  mit, darum ist `line-height: 1.2 !important` (plus `font-size: 12px` und Padding
  `8px 1px`) gesetzt; sonst wären die Buttons trotz schmaler Spalte breit.

  **Nachtrag 0.16.0.12:** Der Button (`.a-button`) **und** sein Innenkasten (`.a-button-inner`)
  bekommen `width`/`max-width: 100%` mit `box-sizing: border-box`, und der Container
  `#ave-left-buttons` bekommt `overflow: hidden`. Damit ist der Button **auf die Breite der
  Spalte begrenzt** (Messung: Spalte 37–61 px, Produktspalte beginnt bei 61 px) – breiter
  als 24 px kann er nicht mehr werden, also kann er kein Produkt mehr überdecken.

  **Nachtrag 0.16.0.13 (der harte Schnitt):** Das Herumdoktern an Amazons Button-Markup
  (`.a-button`, `width`, `line-height`, `overflow`) hat den Text abgeschnitten. Die Buttons
  der schmalen Spalte werden jetzt **komplett eigen** gebaut: `createVerticalButton()`
  erzeugt ein schlichtes `div` mit der Klasse `ave-vertical-button` (id bleibt
  `ave-btn-allseen` usw., Handler unverändert), das CSS dreht und formatiert nur dieses div.
  Die normalen Buttons in der Kategorie-Leiste benutzen weiter `createButton()` mit dem
  Amazon-Markup. Wächter prüfen zusätzlich, dass das CSS **kein** `.a-button` mehr nennt und
  dass `addLeftSideButtons()` beide Wege benutzt.
* **Einstellbare Priorität der Gotify-Nachrichten** (0.16.0.5): die Gotify-Settings
  stehen unter der eigenen Überschrift `TITLE_GOTIFY`, das neue Feld
  `GotifyPriority` (Typ `number`, 0–10, Standard **5**) steht unter dem
  Anwendungstoken. Ein Keyword kann mit `gotifyPriority=<n>` eine eigene Priorität
  für seine Treffer setzen (`parseGotifyPriorityCondition()`, jede Abkürzung wie bei
  `price`/`category`; der Operator ist `=` und nichts anderes – die Priorität wird
  zugewiesen und nicht verglichen, `gotifyPriority==8` ist daher ungültig –,
  gespeichert wird das ganze Wort über
  `aveExpandKeywordAbbreviations()`); ohne Angabe gilt die Einstellung
  (`getGotifyPriority()`, Werte außerhalb 0–10 fallen auf den Standard zurück).
  `gotifyNotification(message, prod, priority)` schreibt sie in den Payload. Unter der
  Priorität steht der Button `BUTTON_GOTIFY_TEST` („Testnachricht senden"):
  `sendGotifyTestMessage()` schickt eine Testnachricht **mit der Priorität der
  Einstellung** und ohne Produkt (kein Ziel, kein Bild); ohne Adresse oder Token ist er
  grau (`btnEnabled`) und schickt nichts.
  Wächter: `scripts/verify/verify_gotify_priority.js` (36 Fälle) und die
  `gotifyPriority`-Fälle in `verify_keyword_conditions.js`.
* **Umbau der Steuerung:** eine einzige Schleife mit Prioritäten
  (Turbo → Fast → BG → Cleanup, Verzögerung vorne) – Plan, Risiken und die
  Verifikationsstrategie stehen in **`docs/SCAN-LOOP.md`**. **Schritte 1 und 2
  sind umgesetzt** (die Schleife läuft, verhält sich aber noch wie vorher).
  Rückfallpunkt: Tag `pre-scan-loop` = `aa68425`.
* Der **Takt des Fast-Scans** war aus der Wartezeit pro Seite berechnet
  (15 Seitentakte) und wurde deshalb mit einem schnelleren Background-Scan
  immer kürzer (bei 2000/1000 ms nur ~40 s). Er ist jetzt die Einstellung
  `FastScanIntervalSeconds` (Default **300 s**), Wächter
  `scripts/verify/verify_fast_scan_interval.js`.

### Analyse: Kontosperre durch zu viele Detail-Requests (offen)

Am 2026-11-03 hat Amazon den Zugriff in einem Browser vorübergehend gesperrt,
nachdem massenhaft `AVE: The details of … are already loaded.` in der Konsole
auftauchte. Die Meldung selbst ist harmlos (kein Request), sie zeigt aber, wie
oft der Pfad lief.

* Ursache (mit hoher Wahrscheinlichkeit): **Menge an Detail-Requests**. Die
  Keyword-Suche läuft nach jeder Scan-Seite über **alle** neuen Einträge, jeder
  Keyword-Treffer mit Preisbedingung lädt die Details (unabhängig von
  `EnableDetailsOnFavorite`), und wenn ein Produkt nie einen Preis bekommt,
  wird es **bei jedem Suchlauf erneut** angefragt → Rückschleife + Dauerlast.
* **Nicht** die Ursache: die neue Schleife (`verify_scan.js` zeigt die identische
  Schrittfolge) und der neue Fast-Scan-Takt (läuft seltener als vorher).
* **Umgesetzt (0.15.0.20):** Der Keyword-Match läuft nur noch für Produkte, die
  **gerade neu** in die Datenbank kamen (`addProductToKeywordSearch()` an den
  beiden `database.add()`-Stellen, `productsToCheckForKeywords` wird von
  `processNewItems()` an die Suche übergeben). Jedes Produkt wird also
  **einmal** geprüft – und da die Details nur nach einem Keyword-Match geholt
  werden, werden sie **höchstens einmal pro Produkt** angefragt.
  **Keine DB-Änderung nötig** (ein zwischenzeitlicher Merker im Produkt wurde
  wieder entfernt).
* Analyse, die restlichen Vorschläge (Notbremse, Queue-Limit, leises Log, Suche
  drosseln) und Meßhinweise stehen in **`docs/ANALYSE-DETAILS-REQUESTS.md`**.

### Fix: Detailansicht aus einer Benachrichtigung (0.17.0.2 und 0.17.0.4)

Die Zeile im Template des versteckten Buttons war abgeschnitten. Statt
`class="a-button-input" type="submit" aria-labelledby="a-autoid-0-announce">`
endete sie mit `class="a-butt[...]`, das `<input>` war also **nie geschlossen**.
Den Rest hat der Browser selbst repariert: der folgende
`<span class="a-button-text">` wurde in den Input-Tag hineingezogen und war
kein eigenes Element mehr. Der Fehler steckte seit dem Commit `3641acf`
(2025-06-09) auch in **`main`** (Release 0.17.0) und war der **einzige**
`[...]`-Treffer im gesamten Repository.

Der Button ist jetzt wieder vollständig und entspricht dem Button eines Tiles:
`aria-labelledby` zeigt auf `a-autoid-0-announce` (die ID der span daneben),
nicht auf das nicht vorhandene `a-autoid-2-announce`.

**Der Klick wartet außerdem 1000 ms** statt 500 ms, nachdem der Body da ist
(`VineExplorer.user.js`, der äußere `setTimeout` über
`aveShareElementTmp.querySelector('input').click()`). Das ist die Taktung, mit
der die Detailansicht aus einer Benachrichtigung oder einem Teilen-Link geöffnet
wird. **Kein** Verifikationsskript läuft über diesen Abschnitt (er liegt im
Top-Level-IIFE, nicht in einer extrahierten Funktion).

**Bestätigt (2026-11-08):** „in Brave kam meistens das Popup nicht bei click auf
Desktop-Benachrichtigung, jetzt funktioniert es“. Damit ist der abgeschnittene
`class`-Wert die belegte Ursache des Symptoms.

Der Grund für die Sekunde steht als `// NOTE:` im Code: das Fenster mit den
Details öffnete sich in Brave meistens nicht, wenn der Klick auf den Button zu
früh kam.

### Test-Button der Desktop-Benachrichtigungen (0.17.0.5 und 0.17.0.6)

Unter dem Schalter steht `BUTTON_DESKTOP_TEST` („Testnachricht senden", englisch
„Send a test message", Hintergrund `rgb(0, 160, 255)` wie beim Gotify-Button) mit
`btnClick: () => sendDesktopTestMessage()`. Der Button hat **kein** `btnEnabled`,
ist also immer aktiv – der Test soll auch bei ausgeschaltetem Schalter möglich
sein. **Bestätigt (2026-11-08):** „test positiv".

**Die Testnachricht nutzt das neueste Produkt der Datenbank** (0.17.0.6):
`getNewestProductOfDatabase()` liest sie über `database.getAll()` und nimmt das
Produkt mit dem **höchsten `ts_lastSeen`** (also das Produkt, das der letzte Scan
zuletzt gesehen hat). Damit sind Text, Bild und Klickziel so wie bei einer echten
Nachricht:

* **Text:** die Testzeile, danach `description_full` – die Testzeile steht also
dort, wo sonst die Trefferzeilen (Keyword/Preis/Kategorie) stehen. Sie lautet
„Testnachricht von Amazon Vine Explorer <Version> – dies ist kein echter Treffer"
(i18n `notifications.desktopTestMessage`), damit niemand sie für einen Treffer
hält.

* **Bild:** `fixProductImageUrl(data_img_url)`, ohne Produkt oder ohne Bild das
Standardbild `vine_logo_notification_image.png`.
* **Klick:** `getProductTargetUrl(prod)` – **dieselbe Funktion**, die auch die
echte Desktop-Nachricht benutzt (vorher stand die Adresse dort zweimal im Code).
Sie baut `${origin}/vine/vine-items?vine-data=<JSON>` mit `asin`,
`isParentAsin`, `recommendationId` und `tax`. Ohne Produkt hat der Klick kein
Ziel.
* **`requireInteraction: true`:** die Nachricht bleibt stehen, bis der Nutzer sie
schließt (wie die echten Nachrichten der Keywords).

**Wichtig (die Nutzeraktion):** der Klick auf den Button ist die Aktion, die
Chrome und Brave für `Notification.requestPermission()` verlangen. Die Anfrage
startet deshalb **vor dem ersten `await`**: `sendDesktopTestMessage()` ist `async`
(es lädt das Produkt), die Berechtigung wird aber zu Beginn synchron angefragt –
sonst wäre die Geste weg und die Anfrage würde still ignoriert. Bei „denied"
bricht die Funktion mit einer Warnung in der Konsole ab.

**Wächter:** `scripts/verify/verify_desktop_notification.js` (Feature-Test, 47
Fälle) prüft das Ziel, das neueste Produkt, den Text, das Bild, das
`requireInteraction`, den Klick und die drei Fälle der Berechtigung
(erlaubt/gefragt/abgelehnt) sowie den Fall ohne `Notification`-Objekt. Damit sind
es **21 Verifikationen**.

### Einstellungs-Gruppe „Desktop-Benachrichtigung“ (0.17.0.3)

Der Schalter „Desktop-Benachrichtigungen aktivieren“ stand zwischen den anderen
Schaltern von „Amazon Vine“, die Keywords standen am Ende der Gruppe. Beide haben
jetzt eine eigene Gruppe (`TITLE_DESKTOP_NOTIFICATIONS`, der Fallback-Name in
`globals.js` ist `Desktop notifications`), die **direkt über der Gotify-Gruppe**
steht – an der Stelle, an der die Keywords schon standen. In `globals.js` folgen
dafür Titel-Define, `EnableDesktopNotifikation` und `DesktopNotifikationKeywords`
aufeinander; die Reihenfolge der Defines ist die Reihenfolge im Menü.

Die Überschrift der Keywords stand doppelt (Gruppentitel **und** `<h4>` des
Wrappers) und ist ausgeblendet: `.ave-keyword-wrapper h4 { display: none; }`,
dazu `margin: 0 0 25px` statt `25px 0`. **Das `<h4>` bleibt im DOM**, weil
`scripts/verify/verify_settings_ui.js` das erzeugte DOM des Typs `keywords`
gegen die Baseline `1e6b6e9` vergleicht – ein Entfernen aus
`createSettingsKeywordsElement()` würde den Vergleich brechen. Die
i18n-Schlüssel `TITLE_DESKTOP_NOTIFICATIONS` stehen in allen vier Blöcken
(`settingsLabels`/`settingsDescriptions` × `de`/`en`).

**Nebenbefund, hier mitkorrigiert:** der Abschnitt „Einstellungen“ weiter unten
nannte **71** Einträge, tatsächlich waren es schon **74** (inzwischen **76**, der
Test-Button ist dazugekommen), und die Menüliste dort stammte aus der Zeit vor
der Gotify-Gruppe (0.16.0).

**Bestätigt (2026-11-08):** „1. funktioniert“ – die Gruppe, der Schalter und die
ausgeblendete Überschrift der Keywords. `npm run check` und `npm run verify`
(20/20) sind grün.

## Wichtige Dateien

| Datei | Inhalt |
|---|---|
| `VineExplorer.user.js` | Hauptdatei, alle Funktionen |
| `globals.js` | Konstanten, Settings, Session-Management |
| `scripts/verify/` | Verifikationsskripte für die Refactorings und die Features |
| `vine_logo*.png` (Wurzel) | Projekt-Logos. Sie bleiben **im Wurzelverzeichnis**: die veröffentlichten Versionen laden `main/vine_logo.png` und `main/vine_logo_notification_image.png` zur Laufzeit, ein Umzug würde bei noch nicht aktualisierten Clients ein fehlendes Benachrichtigungssymbol erzeugen (Raw-URLs leiten nicht weiter). |
| `scripts/check_css_syntax.js` | prüft die CSS auf Kommentare mit falscher Syntax |
| `scripts/check_settings_keys.js` | prüft die Schlüssel der Einstellungen und dass alle Text-Kategorien in jeder Sprache die gleichen Schlüssel haben |
| `scripts/check_state_keys.js` | prüft, dass jeder localStorage-Schlüssel in `AVE_LOCAL_STORAGE_KEYS` steht |
| `scripts/verify/baselines.json` | Git-Stand, gegen den verglichen wird |
| `scripts/verify/lib/verify_helpers.js` | Gemeinsame Helfer der Skripte |
| `.unotes/` | Lokale Testskripte (nicht versioniert) |
| `docs/TURBO-SCAN.md` | Konzept des Turbo-Scans (Messwerte, Entscheidungen, offene Punkte) |
| `docs/SCAN-LOOP.md` | Plan für die eine Schleife mit Prioritäten (Turbo/Fast/BG/Cleanup) |
| `docs/ANALYSE-DETAILS-REQUESTS.md` | Analyse der zu vielen Detail-Requests (Kontosperre) |
| `AGENTS.md` | Arbeitsregeln für AI-Sessions |
| `HANDOVER.md` | Umzug auf ein anderes System |

## Wie man mit den Verifikationen arbeitet

```bash
# Vor einem Refactoring: den aktuellen Stand als Baseline einfrieren
npm run verify:baseline

# ... Refactoring ...

# Danach: vergleichen
npm run verify
```

`npm run verify` startet alle Skripte unter `scripts/verify/`. Ein neues Skript
gehört in `scripts/verify/` und nutzt `lib/verify_helpers.js`.

### Die 21 Verifikationen

**Baseline-Vergleiche** prüfen, dass ein Refactoring das Verhalten **nicht** ändert
(alt ↔ neu, gleiche Nebenwirkungen). **Feature-Tests** prüfen das aktuelle Verhalten
gegen erwartete Werte.

| Skript | Art | Umfang |
|---|---|---|
| `verify_scan.js` | Baseline | die local-storage-Zugriffe des Scans in 7 Szenarien |
| `verify_db_helpers.js` | Baseline | die DB-Zugriffe von `cleanUpDatabase()` und dem Markieren |
| `verify_settings_ui.js` | Baseline | das erzeugte DOM aller 9 Einstellungstypen |
| `verify_new_items.js` | Baseline | Benachrichtigungen, Abzeichen und Seitentitel von `processNewItems()` |
| `verify_init.js` | Baseline | DOM und Aufrufe der Seiten-Initialisierung (31 Schritte) |
| `verify_details_on_favorite.js` | Baseline | die Requests der Preisdetails beim Favorisieren |
| `verify_settings_categories.js` | Feature | die Kategorieauswahl des Turbo-Scans inkl. „Alle Produkte" (32 Fälle) |
| `verify_site_detection.js` | Feature | die Erkennung der Vine-Seiten (16 URLs) |
| `verify_search.js` | Feature | die Suche in der Suchleiste (21 Fälle) |
| `verify_keyword_conditions.js` | Feature | das Parsen und Vergleichen der Bedingungen inkl. `gotifyPriority` (173 Fälle) |
| `verify_gotify_priority.js` | Feature | die Priorität der Gotify-Nachrichten und die Testnachricht (36 Fälle) |
| `verify_desktop_notification.js` | Feature | die Desktop-Benachrichtigungen und ihre Testnachricht (47 Fälle) |
| `verify_left_side_buttons.js` | Feature | die Buttons der linken Seite in der schmalen Spalte (40 Fälle) |
| `verify_keyword_order.js` | Feature | die Reihenfolge der Keywords (22 Fälle) |
| `verify_match_lines.js` | Feature | die Trefferzeilen der Benachrichtigung (10 Fälle) |
| `verify_category_load.js` | Feature | das Hintergrundladen der Kategorien (26 Fälle) |
| `verify_category_tree.js` | Feature | das Parsen des Kategoriebaums (24 Fälle) |
| `verify_tax_prizes.js` | Feature | die Migration der Variantenpreise (14 Fälle) |
| `verify_turbo_scan.js` | Feature | den Turbo-Scan (34 Fälle) |
| `verify_fast_scan_interval.js` | Feature | den Takt des Fast-Scans (15 Fälle) |
| `verify_request_delay.js` | Feature | die Wartezeiten der Detail-Requests (20 Fälle) |

## Werkzeuge

| Befehl | Wirkung |
|---|---|
| `npm run check` | Prettier + ESLint + CSS-Check + Schlüssel-Check + State-Check (muss immer grün sein) |
| `npm run verify` | alle Verifikationen |
| `npm run verify:baseline` | Baseline einfrieren |
| `npm run format` | Quellen formatieren |

## Branch-Regeln

* `main` wird an die Nutzer ausgeliefert → **niemals** ohne ausdrückliche
  Anfrage pushen
* `dev-*` darf ohne Nachfrage gepusht werden
* Commits: `type(scope): Beschreibung`, z. B. `fix(scan): ...`
* Version im User-Script + Changelog in `README.md` bei jeder Änderung

## Einstellungen (76)

**Hinweis:** Gezählt sind alle Einträge von `SETTINGS_USERCONFIG_DEFINES`,
inklusive der zehn Titel-Defines. Die Zahl steht hier, weil
`scripts/check_settings_keys.js` sie ausgibt (`Einstellungen: 76`).

Aufbau des Menüs (Reihenfolge in `globals.js` = Reihenfolge im Menü):

1. **Amazon Vine** (`TITLE_AMAZON_VINE`): Sprache (`UI_LANGUAGE`), alle Schalter
   außer denen der Desktop-Benachrichtigungen (u. a. `EnableFullWidth`,
   `DarkMode`, `DisableCategories`, `EnableBtnAll`, `EnablePaginationTop`,
   `EnableInfiniteScrollLiveQuerry`, `EnableInfiniteSpinnerFix`)
2. **Desktop-Benachrichtigung** (`TITLE_DESKTOP_NOTIFICATIONS`, seit 0.17.0.3):
   `EnableDesktopNotifikation`, Button „Testnachricht senden",
   `DesktopNotifikationKeywords`
3. **Gotify** (`TITLE_GOTIFY`): `GotifyUrl`, `GotifyToken`, `GotifyPriority`,
   Button „Testnachricht senden"
4. **Background-Scan** (`TITLE_BACKGROUND_SCAN`): `EnableBackgroundScan`,
   Button „Neuen Background Scan starten", `BackGroundScanDelayPerPage`,
   `BackGroundScannerRandomness`
5. **Fast-Scan** (`TITLE_FAST_SCAN`): `EnableFastScan`,
   `FastScanIntervalSeconds`
6. **Turbo-Scan** (`TITLE_TURBO`): `EnableTurboScan`,
   `TurboScanIntervalSeconds`, `TurboScanCategories`
7. **Wartezeiten und Grenzen** (`TITLE_DELAYS`): `DesktopNotifikationDelay`,
   `SearchBarInputDelay`, `IdlePeriodAfterScan`, `HoursBeforeCleanup`,
   `MaxItemsPerPage`, die Schwellwerte der Benachrichtigungen
8. **Farben und Styles** (`TITLE_COLORS`), **Amazon Shopping**
   (`TITLE_SHOPPING`), **Entwickler und Tester** (`TITLE_DEV`)
