# Umbau: eine Schleife für alle Scans

> **Stand 2026-11-02: nur geplant, nicht implementiert.** Der Maintainer hat die
> Zielstruktur vorgegeben. Diese Datei hält den Plan, die Risiken und die offenen
> Entscheidungen fest, damit nichts verloren geht.

## Zielstruktur

Eine **einzige, unendliche Schleife**. Pro Durchlauf wird genau **ein** Schritt
gemacht, danach beginnt die Schleife von vorne. Die Reihenfolge ist die
Priorität:

```
loop:
    warte (BackGroundScanDelayPerPage + Zufall)      ← Einstellung des BG-Scans
    wenn Turbo-Scan fällig    → Turbo-Schritt    → weiter
    wenn Fast-Scan fällig     → Fast-Schritt     → weiter
    wenn BG-Scan fällig       → BG-Schritt       → weiter
    wenn DB-Cleanup fällig    → Cleanup          → weiter
```

* **Ein Schritt ist eine Seite** (bzw. beim Turbo eine Kategorie-Seite) – nicht
  eine ganze Stage. Nur so bleibt die Schleife fein genug, damit der 30-Sekunden-
  Takt des Turbo-Scans nicht von einem langen BG-Schritt verdrängt wird.
* Der Turbo-Scan hat die **höchste** Priorität: er ist zeitkritisch.
* Der BG-Scan ist der **Normalfall** (die Wartezeit der Schleife ist seine
  Einstellung), Cleanup der **Lückenfüller**.

## Ist-Zustand (heute)

* `initBackgroundScan()` prüft vier Bedingungen (läuft schon / aus / nicht
  Master / keine Vine-URL), setzt `BackGroundScanIsRunning = true`, startet einen
  einmaligen 250-ms-`setInterval` und daraus
  `setTimeout(backgroundScanLoop, BackGroundScanDelayPerPage)`.
* `backgroundScanLoop()` → `prepareFastScan()` → `prepareScanIteration()` →
  `switch (state.stage)` → Stage-Funktion → `backGroundTileScanner()` →
  `backgroundScanFinished()` → `setTimeout(backgroundScanLoop, delay)`.
  Die Verzögerung liegt also **hinten** in der Kette.
* Der **Fast-Scan hat keine eigene Schleife.** `prepareFastScan()` setzt mitten
  im Lauf `AVE_BACKGROUND_SCAN_STAGE = 0` und `_PAGE_CURRENT = 0`, merkt sich die
  alte Position in `AVE_LAST_BACKGROUND_SCAN_*` und lässt dieselbe Schleife von
  vorne laufen. `stopFastScan()` stellt die Position wieder her.
* Das **Cleanup** hängt als Stage 3 im Zyklus, läuft also einmal pro kompletter
  Runde. `cleanUpDatabase()` setzt `AVE_CLEANUP_LAST_TIME` am Ende.

## Soll-Zustand

```js
function initScanLoop() {                       // ersetzt initBackgroundScan()
    // Guards wie heute: läuft schon / aus / nicht Master / keine Vine-URL
    // state anlegen, Screen anzeigen, Storage initialisieren
    scanLoop();                                  // Kette starten
}

async function scanLoop() {
    if (!isScanLoopActive()) return;             // Master verloren / abgeschaltet
    await delay(getScanDelay());                 // BackGroundScanDelayPerPage + Zufall

    if (isTurboScanDue())      { await scanStepTurbo();      return scanLoop(); }
    if (isFastScanDue())       { await scanStepFast();       return scanLoop(); }
    if (isBackgroundScanDue()) { await scanStepBackground(); return scanLoop(); }
    if (isCleanupDue())        { await scanStepCleanup();    return scanLoop(); }

    scanLoop();                                  // nichts fällig (z.B. Idle-Phase)
}
```

### Die „soll laufen?"-Tests

| Test | Inhalt |
|---|---|
| `isTurboScanDue()` | `EnableTurboScan` **und** `now - AVE_TURBO_SCAN_LAST_TIME >= TurboScanIntervalSeconds * 1000` |
| `isFastScanDue()` | wie heute in `prepareFastScan()`, aber ohne Seiteneffekte: genug Zeit seit `AVE_FAST_SCAN_LAST_TIME`, `stage > 0`, `pageMax > 0`, nicht in den ersten 5 % der Seiten |
| `isBackgroundScanDue()` | **nicht** in der Idle-Phase: `stage < 4` **oder** Idle-Zeit abgelaufen (`IdlePeriodAfterScan`) – dann übernimmt der BG-Schritt wieder |
| `isCleanupDue()` | `now - AVE_CLEANUP_LAST_TIME >= HoursBeforeCleanup * 3600` (heute: einmal pro Runde) |

Die Idle-Phase ist damit der **Lückenfüller-Slot**: während der BG-Scan wartet,
kann das Cleanup laufen.

### Die Schritte

| Schritt | Inhalt | Neu/Geändert |
|---|---|---|
| `scanStepTurbo()` | **zuerst ein Dummy** (nur Zeitstempel + Log), später: Seite 1 der konfigurierten Kategorien laden | neu |
| `scanStepFast()` | **eigener** Seitenzähler `AVE_FAST_SCAN_PAGE`, `queue=encore&pn=&cn=&page=N`, eigene Trefferzählung; Abbruch wie bei `shouldStopFastScan()` | umgebaut |
| `scanStepBackground()` | die heutige Logik: eine Seite der aktuellen Stage (0 potluck, 1 encore, 2 übersprungen, 4 idle), Position in `AVE_BACKGROUND_SCAN_STAGE`/`_PAGE_CURRENT` | unverändert im Kern |
| `scanStepCleanup()` | `cleanUpDatabase()` | unverändert |

**Wichtigster Vereinfachungseffekt:** Weil der Fast-Scan einen **eigenen**
Seitenzähler bekommt, muss er die Position des BG-Scans nicht mehr verbiegen.
`AVE_LAST_BACKGROUND_SCAN_STAGE`, `AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT` und
das Zurückstellen in `stopFastScan()` **entfallen**.

### Vergleich heute → neu

| Heute | Neu |
|---|---|
| Verzögerung **hinten** in der Kette | Verzögerung **vorne** in der Schleife |
| `prepareFastScan()` mit Seiteneffekten mitten im Loop | `isFastScanDue()` fragenlos, `scanStepFast()` macht die Arbeit |
| Fast-Scan verbiegt die BG-Position | Fast-Scan hat eigenen Zähler |
| Cleanup = Stage 3 einmal pro Runde | `isCleanupDue()` + `scanStepCleanup()` |
| ein `switch (state.stage)` als Verteiler | Priorisierungsliste |
| Turbo-Scan nicht vorhanden | `scanStepTurbo()` als Dummy, später echt |

## Was erhalten bleiben muss

* **Iframe pro Seite** und Entfernen danach (RAM-Fix – darf nicht verloren gehen)
* Master-/Session-Gating: nur in der Master-Tab, `stopBackgroundScan()` beim
  Rollenverlust
* Reset nach `> 600 min` (10 h) und die Idle-Phase (`IdlePeriodAfterScan`)
* `AVE_BACKGROUND_SCAN_IS_RUNNING` als „Storage ist initialisiert"-Merker
  (wird heute nie auf `false` gesetzt – **nicht** als „läuft gerade" verwenden)
* Die Screen-Texte (`showBackgroundScanScreen`, `updateBackgroundScanScreenText`)
* `lastScanPaginationData` (Seitenzahl für Stage 1)
* Die Drop-Benachrichtigung (`notifyAboutProductDrop`, Schwelle und
  Wiederholungsintervall)
* DB-Schreibvorgänge → `ave-database-changed` (250 ms entprellt) → Keyword-Suche;
  daran wird **nichts** geändert

## Verifikation (wichtigster Punkt)

`verify_scan.js` vergleicht heute die **Folge der localStorage-Zugriffe** der
alten und der neuen Schleife und erwartet „identisch". Das ist nach diesem Umbau
**nicht mehr möglich**, weil sich die Schleifenform selbst ändert (neue Keys,
andere Reihenfolge der Abfragen).

Vorgehen deshalb in zwei Klassen:

1. **Unverändert verifizierbar (Refactoring):** die einzelnen Schritte und Tests
   – `scanStepBackground()` gegen `scanStageZero/Encore/Idle`,
   `isFastScanDue()` gegen `prepareFastScan()`, `shouldStopFastScan()`.
   Hier gilt weiter „alt und neu müssen identisch sein".
2. **Bewusste Verhaltensänderung (Umbau):** die Schleife selbst. Dafür wird
   `verify_scan.js` neu geschrieben: nicht mehr „alt vs. neu", sondern
   **erwartete Reihenfolge der Schritte** gegen eine Tabelle von Szenarien
   (z.B. „Turbo fällig → nur Turbo", „BG in Idle → Cleanup kommt dran",
   „Fast fällig → BG steht still", „Delay liegt vor dem Schritt").
   Die Baseline wird dafür neu gesetzt und die Änderung im Dokument
   „Verhalten" festgehalten.

## Umsetzungsschritte (je ein Commit, je eine Verifikation)

1. **Vorbereitung ohne Verhaltensänderung:** `getScanDelay()` (Zufall) und die
   „soll laufen?"-Tests als reine Funktionen herausziehen, `prepareFastScan()`
   darauf umbauen. Baseline bleibt gültig.
2. **Die Schleife einführen:** `scanLoop()` mit Verzögerung vorne und der
   Prioritätenliste, aber **nur** mit BG + Fast + Cleanup (wie heute, ohne
   Turbo). `verify_scan.js` auf die neue Form umschreiben (Klassen 1 und 2).
3. **Fast-Scan entkoppeln:** eigener Zähler, `stopFastScan()`-Rückstellung
   entfernen. Verifikation: die BG-Position ändert sich während eines Fast-Scans
   nicht mehr.
4. **Cleanup als Schritt:** `isCleanupDue()` + `scanStepCleanup()`, Idle-Phase
   als Slot. Verifikation: Cleanup läuft genau einmal je `HoursBeforeCleanup`.
5. **Turbo-Scan als Dummy:** Einstellungen (`EnableTurboScan`,
   `TurboScanCategories`, `TurboScanIntervalSeconds`), `isTurboScanDue()`,
   `scanStepTurbo()` ohne Wirkung. Verifikation: Priorität und Takt, ohne dass
   eine Seite geladen wird.
6. **Turbo-Scan echt umsetzen** (siehe `docs/TURBO-SCAN.md`), inklusive
   eigenem iframe oder Sperre gegen den BG-Schritt.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Der BG-Scan wird langsamer, wenn Turbo/Fast oft fällig sind | Anteile messen (Turbo +8 % je Kategorie, Fast ~3 %); Priorisierung ist gewollt |
| Endlose Rekursion (`return scanLoop()`) statt einer Iteration | bewusst `setTimeout`-Kette behalten oder Rekursion im Tail-Position belassen; Test auf Stack-Tiefe |
| Verifikationslücke, weil „identisch" nicht mehr prüfbar ist | Szenario-Tabelle wie oben, inkl. Negativtests |
| Zwei Seitenaufrufe gleichzeitig (Turbo + BG) | Turbo-Schritt lädt **innerhalb** der Schleife; damit ist immer nur eine Seite offen → kein zweites iframe nötig |
| Positionsverlust bei Reload | Position weiter in `localStorage`, inkl. neuem `AVE_TURBO_SCAN_LAST_TIME` |

## Offene Entscheidungen

1. **Turbo-Schritt = alle Kategorien oder eine pro Durchlauf?**
   Empfehlung: **eine Rotation** (alle konfigurierten Kategorien) als ein
   Schritt, weil das Intervall pro Rotation definiert ist.
2. **Cleanup-Takt:** weiter „einmal pro Runde" oder zeitbasiert über
   `HoursBeforeCleanup`? Empfehlung: zeitbasiert, damit es im Idle-Slot läuft.
3. **Fast-Scan entkoppeln** (eigener Zähler) – ja/nein? Empfehlung: ja, es
   entfernt drei localStorage-Schlüssel und den Rückstell-Zweig.
4. **Wartezeit = BG-Delay** (wie beschrieben) oder `min(BG-Delay, Zeit bis zum
   nächsten fälligen Schritt)`? Empfehlung: BG-Delay, wie gewünscht – dann ist
   der Turbo-Takt auf ± eine Seite genau.
