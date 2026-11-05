# Analyse: zu viele Detail-Requests (Kontosperre durch Amazon)

> **Stand 2026-11-03.** Anlass: Amazon hat den Zugriff in einem Browser
> (IP/Konto) vorübergehend gesperrt, nachdem in der Konsole massenhaft
> `AVE: The details of … are already loaded.` auftauchte.
>
> **Der Maintainer hat entschieden, vorerst keine Maßnahme umzusetzen.** Diese
> Datei hält die Analyse und die Vorschläge fest, damit nichts verloren geht.

## Ergebnis in Kurzform

Die Meldung selbst ist **harmlos** – sie kommt aus `loadProductDetails()` und
bedeutet, dass **kein Request** gemacht wird (die Details liegen schon in der
Datenbank). Sie ist der **Indikator** dafür, wie oft dieser Pfad lief.

Die Sperre ist mit hoher Wahrscheinlichkeit die Folge der **Menge an
Detail-Requests**, die aus diesem Pfad entsteht. Die neue Scan-Schleife ist
**nicht** die Ursache (`verify_scan.js` zeigt die identische Schrittfolge wie
vorher).

## Die Aufrufkette

```
Scan-Seite gefunden (alle BackGroundScanDelayPerPage + Zufall)
  → database.add(neues Produkt)
    → 250 ms entprellt: ave-new-product-added + ave-database-changed
      → processNewItems()   (in dieser Analyse noch updateNewProductsBtn() genannt)
        → searchKeywordsInProducts(database.getNewEntries())   ← ALLE isNew-Produkte
          → Keyword passt?
            → Keyword hat Preisbedingungen?
              → loadProductDetails(prod)                        ← REQUEST (falls nicht geladen)
              → loadProductDetailsIfEnabled(prod)               ← bei EnableAutoMarkFavorite
```

## Die Verstärker

| # | Verstärker | Wirkung |
|---|---|---|
| 1 | Die Suche läuft nach **jeder** Scan-Seite und dabei über **alle** neuen Einträge, nicht nur über die neu hinzugekommenen | die ganze Liste wird im Takt des Scans (2,5 s) durchgeprüft |
| 2 | Ein Keyword mit **Preisbedingung** lädt die Details **unabhängig** von `EnableDetailsOnFavorite` (so gewollt) | jedes Keyword-Match erzeugt einen Request |
| 3 | `hasProductDetails()` liefert `false`, solange `getTaxPrices(prod)` leer ist. Liefert Amazon keinen `taxValue` (oder scheitert ein Request), passiert das bei **jedem** Suchlauf erneut | **Rückschleife**: dasselbe Produkt alle 2,5 s |
| 4 | Die Queue ist **unbegrenzt** – die Suche schiebt schneller nach, als die Queue abarbeitet (1 Request je ~1,5 s Produkt / ~0,5 s Variante) | Rückstau wächst, Dauerlast von ~2.400–4.000 Requests/h |
| 5 | Dazu **1.440 Scan-Seiten/h** (bei 2000/1000 ms) | in Summe mehrere tausend Requests/h auf dieselbe IP |

Nach einer Sperre scheitern die Requests → `hasProductDetails` bleibt `false` →
**Rückkopplung**, die immer weiter feuert. Das erklärt, warum es nach dem
Auftreten der Sperre nicht von selbst aufhörte.

## Was NICHT die Ursache ist

* Die Konsolenmeldung selbst (kein Request).
* Die neue Schleife aus `docs/SCAN-LOOP.md`: `verify_scan.js` bestätigt für alle
  7 Szenarien die **identische** Schrittfolge (gleiche Seitenaufrufe, gleiche
  localStorage-Zugriffe).
* Der Takt des Fast-Scans nach der Umstellung auf `FastScanIntervalSeconds`
  (er läuft jetzt **seltener** als vorher, nicht häufiger).

## Vorschläge (offen, priorisiert)

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| 1 | ~~Versuchs-Merker je Produkt~~ **ERLEDIGT in 0.15.0.20, anders als geplant:** Der Keyword-Match läuft nur noch für Produkte, die **gerade neu** in die Datenbank kamen (`addProductToKeywordSearch()` + `productsToCheckForKeywords`). Jedes Produkt wird einmal geprüft, und da die Details nur nach einem Keyword-Match geholt werden, werden sie höchstens einmal pro Produkt angefragt. **Keine DB-Änderung** – ein zwischenzeitlicher Merker im Produkt (`detailsRequested`) wurde auf Wunsch des Maintainers wieder entfernt. | durchbricht die Rückschleife aus Punkt 3 – **wichtigster Hebel**, umgesetzt | klein |
| 2 | **Notbremse**: nach N Fehlern in Folge die Queue leeren und die Details für X Minuten pausieren | verhindert, dass eine Sperre eskaliert | klein |
| 3 | **Queue begrenzen** (z. B. max. 50 offene Einträge, weitere verwerfen) | kein unbegrenzter Rückstau, begrenzter Speicher | klein |
| 4 | **Suche nur über noch nicht geprüfte Produkte** (Merker im Speicher) | viel weniger CPU und Aufrufe; ändert die Suchsemantik (ein dauerhaft preisloses Produkt wird nicht mehr automatisch nachgeprüft) | mittel |
| 5 | **Log leise**: „already loaded" nur bei `DebugLevel > 1` | Konsole bleibt benutzbar | trivial |
| 6 | **Suche drosseln**: höchstens 1× alle N Sekunden statt bei jeder Scan-Seite | weniger Verstärkung; Benachrichtigungen kommen etwas später | klein |

Empfehlung des vorbereitenden Agents: **1 + 2 + 3 + 5** als ein Commit
(Absicherung, keine Semantikänderung), danach 4 und 6 als zweiter Schritt mit
eigener Verifikation.

**Stand:** Maßnahme **1** ist umgesetzt (0.15.0.20), allerdings **an der Suche**
statt über einen Merker im Produkt – die Details sind damit ohne DB-Änderung auf
höchstens einen Request pro Produkt begrenzt. Die Maßnahmen 2, 3, 5 und 6 sind
weiterhin offen, Maßnahme 4 („Suche nur über ungeprüfte Produkte") ist damit
erledigt, sogar in der strengeren Form „nur die neu hinzugekommenen Produkte".

## Verifikation der umgesetzten Maßnahme

* `verify_new_products_btn.js`, neues Paar von Szenarien:
  * „Nur neue Produkte werden geprüft: das Produkt wurde gerade hinzugefügt" →
    Benachrichtigung, ein Detail-Request.
  * „Produkte, die schon in der Datenbank sind, werden nicht geprüft" → **keine**
    Benachrichtigung und **kein** Detail-Request, obwohl das Produkt zum Keyword
    passt und in der Liste der neuen Einträge steht.
* Gegenprobe: mit der alten Suche (`searchKeywordsInProducts(prodArr)` statt der
  Liste der neuen Produkte) meldet die Verifikation „unexpected notification".
* `verify_details_on_favorite.js` bleibt unverändert gültig (die Suche ruft
  `checkKeywordsForProduct` weiterhin nur bei einem Treffer auf).

## Sofortmaßnahmen für den Benutzer

* Preisbedingungen aus den Keywords entfernen (dann gibt es keine automatischen
  Detail-Requests mehr) **oder** `EnableBackgroundScan` ausschalten.
* Bis die Sperre abgelaufen ist, die Vine-Seiten in dem Browser nicht weiter
  benutzen.

## So lässt sich die Last messen

* **DevTools → Netzwerk**, Filter `recommendations`: die Anzahl der Anfragen und
  die Dauer des Ausschlags zeigen die Last direkt.
* Im Skript-Log (Debuglevel > 1) zeigt `requestProductDetails(): …` jeden
  Detail-Request, `scanLoop(): Scantime: …` jede Scan-Seite.
* Verhältnis als Faustregel: Scan-Seiten ≈ `1 / (BackGroundScanDelayPerPage +
  Zufall/2)` pro Sekunde; Detail-Requests ≈ `1 / ProductDetailsRequestDelay` pro
  Sekunde, **solange die Queue gefüllt ist**.
