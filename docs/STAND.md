# Stand des Projekts

Dieser Stand liegt im Repository, damit er nach einer Verdichtung des Chats
nicht verloren geht. Bei Fragen zuerst hier und in `git log` nachschauen.

## Aktueller Stand

| Punkt | Stand |
|---|---|
| Branch | `dev-0.16.0` (gepusht, aus `main` angelegt) |
| Version im User-Script | `0.15.0.30` (in Entwicklung, Release 0.16.0 vorbereitet) |
| Letztes Release | **0.15.0** (auf `main`, veröffentlicht, Merge-Commit `75bb04b`) |
| Lint / Formatierung | 0 Errors, 0 Warnings (`npm run check`) |
| Verifikationen | alle 10 erfolgreich (`npm run verify`) |
| RAM-Verbrauch | **ok** – der Fix ist bestätigt, keine Messung mehr nötig |

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
  **asynchron** geworden, `updateNewProductsBtn()` wartet auf die Suche.
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
* neuer Wächter `scripts/verify/verify_price_conditions.js` (50 Fälle).
* Ein Keyword mit **mehreren Wörtern** matcht, wenn **alle Wörter** im Text
  vorkommen (Reihenfolge und Abstand egal, `matchesKeyword()`). Vorher waren die
  Wörter eine Phrase (direkt hintereinander in dieser Reihenfolge). Ein Regex
  wie `/toaster/i` gilt weiter wie geschrieben.
* Ein Keyword, dessen Preisbedingung **zwischen** zwei Wörtern steht
  (`toaster [price > 100] white`), wurde vorher zum Suchtext `toaster   white`
  (drei Leerzeichen) und fand damit nie etwas. Der Leerraum um die Bedingung
  verschwindet jetzt mit ihr (`parseKeywordConfig()`).

### Turbo-Scan (Konzept, noch nicht implementiert)

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
  `verify_settings_categories.js` (20 Fälle). **Der Turbo-Scan selbst fehlt noch** – die
  Einstellungen haben bis dahin keine Wirkung, darum gibt es noch keinen
  Changelog-Eintrag.
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
  `updateNewProductsBtn()` an die Suche übergeben). Jedes Produkt wird also
  **einmal** geprüft – und da die Details nur nach einem Keyword-Match geholt
  werden, werden sie **höchstens einmal pro Produkt** angefragt.
  **Keine DB-Änderung nötig** (ein zwischenzeitlicher Merker im Produkt wurde
  wieder entfernt).
* Analyse, die restlichen Vorschläge (Notbremse, Queue-Limit, leises Log, Suche
  drosseln) und Meßhinweise stehen in **`docs/ANALYSE-DETAILS-REQUESTS.md`**.

## Wichtige Dateien

| Datei | Inhalt |
|---|---|
| `VineExplorer.user.js` (~4900 Zeilen) | Hauptdatei, alle Funktionen |
| `globals.js` | Konstanten, Settings, Session-Management |
| `scripts/verify/` | 10 Verifikationsskripte für die Refactorings und die Features |
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
