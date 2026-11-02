# Turbo-Scan – Konzept

> **Stand 2026-11-02: Konzept, noch nicht implementiert.** Die Entscheidungen
> sind getroffen, die Umsetzung beginnt mit Schritt 1. Diese Datei liegt im
> Repository, damit die Messwerte und die Begründungen nach einer Verdichtung
> des Chats nicht verloren gehen.

## Ziel

Wertvolle Produkte sind oft schon **nach wenigen Minuten** vergriffen. Der
bestehende Background-Scan läuft einmal komplett über alle Seiten (~1 h) und der
Fast-Scan erkennt zwar schnell neue Produkte, kennt aber keine Kategorie.

Der **Turbo-Scan** beobachtet deshalb eine kleine, vom Benutzer konfigurierte
Menge von Kategorien und lädt für diese regelmäßig (Default: alle 30 Sekunden)
die **erste Seite**:

```
alle TurboScanIntervalSeconds:
  für jede konfigurierte Kategorie:
     Seite 1 laden            ?queue=encore&pn=<id>[&cn=<id>&page=1
     Tiles parsen             → neue Produkte werden wie gewohnt gespeichert
     → DB-Schreiben löst die Keyword-Suche aus → Benachrichtigung
     → Preise werden NICHT geladen (Regel bleibt: nur Keyword-Match oder „Weitere Details“)
```

Bei 1–2 Kategorien kostet das wenig und findet neue Produkte in diesen
Kategorien **innerhalb von 30 Sekunden**.

## Entscheidungen (mit dem Maintainer abgestimmt)

1. **Konfiguration als Textliste** (wie die Keywords-Einstellung), **mit
   Unterkategorien**. Namen **oder** Nummern; der Maintainer tendiert zu
   Nummern, weil sie stabil sind.
2. Der Turbo-Scan läuft **immer** – unabhängig davon, ob der Background-Scan
   eingeschaltet ist. Nur in der **Master-Session**.
3. **Keine Erweiterung des Produkts und der Match-Logik um Kategorien.** Nach
   dem Turbo-Scan wird die Kategorie nicht mehr gebraucht, sie dient nur zum
   Bauen der URL. Damit entfallen:
   - kein neues Feld im Produkt
   - keine neue Datenbank-Version, keine Migration
   - keine Kategorie-Bedingung in der Keyword-Suche

## Messwerte (amazon.de, am 2026-11-02 im Browser ermittelt)

| Größe | Wert |
|---|---|
| Produkte pro Seite | **36** |
| Hauptkategorien (`pn`) | **24**, zusammen 48.659 Produkte |
| Unterkategorien (`cn`) | **246**, zusammen dieselben 48.659 Produkte |
| Seiten: eine ungefilterte Liste | `ceil(48659/36)` = **1.352** |
| Seiten: über die 24 Hauptkategorien | **1.363** (+11) |
| Seiten: über die 246 Unterkategorien | **1.497** (+134) |

Daraus die Scan-Zeiten mit den Parametern des Maintainers
(`BackGroundScanDelayPerPage = 2000`, `BackGroundScannerRandomness = 1000` →
2,0 s + 0–1 s = **~2,5 s pro Seite**):

| Sweep | Seiten | Dauer | Zusatz pro Zyklus |
|---|---|---|---|
| Hauptkategorien, Seite 1 | 24 | ~60 s | +1,6 % |
| Unterkategorien, Seite 1 | 246 | ~10,3 min | +16,6 % |
| Haupt-Scan über alle Unterkategorien | 1.497 | **~62 min** | — |

Der Fast-Scan-Intervall mit diesen Parametern:
`(2000 + 1000/2) × 15 / 1000` = **37,5 s** (Minimum 30 s).

### Kosten des Turbo-Scans

| Turbo-Kategorien | Seiten/Stunde | Anteil am Haupt-Scan (1.440/h) |
|---|---|---|
| 1 | 120 | +8 % |
| 2 | 240 | +17 % |
| 5 | 600 | +42 % |

## Erkenntnisse über die Kategorie-Struktur

* Die Kategorien stehen als Baum in **`#vvp-browse-nodes-container`**:
  `div.parent-node` und `div.child-node`, jeweils mit einem Link
  ```
  /vine/vine-items?queue=all_items&pn=10925031            → Hauptkategorie
  /vine/vine-items?queue=all_items&pn=10925031&cn=87837030 → Unterkategorie
  ```
  Der Text des Knotens enthält **Name und Produktzahl**, z. B. `Garten (1249)`.
* **`pn`** = Hauptkategorie, **`cn`** = Unterkategorie. Der Baum ist
  serverseitig gerendert (die Links stehen schon im HTML).
* Die Kategorien-Liste zeigt **alle 24 Hauptkategorien**, aber die
  Unterkategorien **nur der ausgewählten** Kategorie.
* `?queue=encore&pn=<id>&page=1` funktioniert und filtert korrekt (im Browser
  geprüft: die Seite zeigt Garten-Produkte, links ist „Garten" markiert).
  Der Haupt-Scan arbeitet heute mit `queue=encore`, die Sidebar-Links mit
  `queue=all_items` – beide sind nutzbar.
* AVE **leert** den Container auf seinen eigenen Unterseiten
  (`createProductSite()`/`createInfiniteScrollSite()`: `innerHTML = ''`), auf
  den normalen Vine-Seiten bleibt er intakt. Im Scan-Iframe läuft AVE nicht
  (`@noframes`), dort ist er immer vollständig.
* Beispielwerte: Küche, Haushalt & Wohnen 13.599 · Fashion 6.481 ·
  Elektronik & Foto 4.712 · Garten 1.249 · Kosmetik 902 · Bücher 15 ·
  DVD & Blu-ray 6 · Stores 3.

## Warum kein Kategorie-Scan im Haupt-/Fast-Scan

* **Fast-Scan:** Er ist kein eigener Leser, sondern **derselbe Loop von vorne**
  (`prepareFastScan()` setzt Stage/Page auf 0, `stopFastScan()` stellt sie
  wieder her). Er läuft mit diesen Parametern **alle ~37,5 s**. Ein Sweep über
  die Kategorien (24 Seiten = 60 s, 246 Seiten = 10,3 min) passt in diesen Takt
  nicht – der Haupt-Scan würde verhungern.
* **Haupt-Scan über Kategorien:** kostet +134 Seiten, liefert die Kategorie aber
  **nicht zum Zeitpunkt des Drops** (der Scan braucht ~62 min pro Runde).
  Für zeitkritische Produkte ist das zu spät.
* Der Turbo-Scan ist deshalb der richtige Ort: er beobachtet genau die
  Kategorien, die den Benutzer interessieren, und zwar im Sekundenbereich.

## Umsetzungsschritte

1. **Einstellungen** in `globals.js` + Übersetzungen in `i18n.js`:
   - `EnableTurboScan` (bool, Default: aus)
   - `TurboScanCategories` (Textliste, ein Eintrag pro Zeile)
   - `TurboScanIntervalSeconds` (number, Default 30, Minimum 10)
2. **Kategorie-Eintrag auflösen:** Nummer direkt (`10925031` bzw. `10925031/87837030`),
   Name über die Sidebar der geladenen Seite. Offen: siehe unten.
3. **Die Schleife:** `initTurboScan()`, `turboScanLoop()` mit einer
   Timeout-Kette (kein Overlap), Warten wenn der Background-Scan gerade lädt.
4. **Eigenes Iframe:** `createScanIframe()` bekommt eine id, damit der
   Turbo-Scan und der Background-Scan nicht denselben Frame verwenden.
5. **Verifikation:** neues `scripts/verify/verify_turbo_scan.js` – Intervall,
   kein Overlap, Auflösen der Einträge (Nummer/Name/Unterkategorie),
   eigene iframe-id, keine Preisabfrage.
6. **Doku:** Changelog-Eintrag, `docs/STAND.md`, `AGENTS.md` (falls neue
   Konventionen entstehen).

## Offene Punkte

* **Namen auflösen kostet einen Request:** Die Unterkategorien stehen nur für
  die *ausgewählte* Hauptkategorie im DOM. Ein Eintrag wie
  `Garten > Gartendeko` braucht daher einmalig einen Seitenaufruf der
  Hauptkategorie, um die `cn`-Nummer zu finden. Bei **Nummern**
  (`10925031/87837030`) entfällt das komplett – das spricht für Nummern.
* **Komfort:** Vorschlag zur Aufnahme in die Liste: die **URL aus der
  Adresszeile** einfügen (`...?queue=all_items&pn=10925031&cn=87837030`), AVE
  zieht `pn`/`cn` heraus. Dann muss man keine Nummern von Hand suchen.
* **Takt und Anzahl** der Kategorien sind frei konfigurierbar; sinnvoll sind
  1–2 Kategorien (siehe Kostentabelle).
* Amazon-Rate-Limit: Der Turbo-Scan erzeugt zusätzliche Seitenaufrufe. Die
  Einstellungen für die Verzögerungen (`BackGroundScanDelayPerPage`,
  `BackGroundScannerRandomness`) gelten auch hier.
