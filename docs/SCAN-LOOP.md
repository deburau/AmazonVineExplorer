# Umbau: eine Schleife für alle Scans

> **Stand 2026-11-02: Schritt 1 und 2 sind umgesetzt.** Die Schleife läuft,
> verhält sich aber noch genau wie die alte Kette (durch `verify_scan.js`
> bestätigt: alle 7 Szenarien sind identisch). Turbo, Fast-Entkopplung und
> Cleanup-Schritt folgen (Schritte 3–6).
>
> **Rückfallpunkt:** Tag `pre-scan-loop` = Commit `aa68425` (Stand vor dem
> Umbau, auf `origin` gepusht).

## Zielstruktur

Eine **einzige** Schleife. Jeder Durchlauf wartet die eingestellte Zeit des
Background-Scans und macht dann **genau einen Schritt** – **egal welcher Scan**,
es wird pro Durchlauf **höchstens eine Seite** abgerufen.

```
while (true):
    wenn die Schleife nicht mehr laufen soll → return
    warte (BackGroundScanDelayPerPage + Zufall)          ← Einstellung des BG-Scans

    wenn Turbo-Scan fällig    → Turbo-Schritt    (eine Kategorie-Seite) → weiter
    wenn Fast-Scan fällig     → Fast-Schritt     (eine Seite)           → weiter
    wenn BG-Scan fällig       → BG-Schritt       (eine Seite)           → weiter
    wenn Cleanup fällig       → Cleanup          (DB-Durchlauf, keine Seite) → weiter
    sonst: nichts tun (Idle-Phase)
```

Die Reihenfolge ist die **Priorität**: Turbo ist zeitkritisch, danach der
Fast-Scan, der BG-Scan ist der Normalfall, das Cleanup der Lückenfüller.

## Entscheidungen (mit dem Maintainer abgestimmt)

| Nr | Entscheidung |
|---|---|
| 1 | **Eine Seite pro Durchlauf** – auch beim Turbo-Scan (nicht die ganze Rotation in einem Schritt). Der Turbo-Schritt rückt mit einem Rotationszähler durch die konfigurierten Kategorien. |
| 2 | Das **Cleanup ist zeitbasiert** (`HoursBeforeCleanup`), läuft aber **nur**, wenn der BG-Scan seine letzte Seite verarbeitet hat und auf den nächsten Start wartet (Idle-Phase). |
| 3 | Der **Fast-Scan wird entkoppelt**: eigener Seitenzähler, er verbiegt die Position des BG-Scans nicht mehr. Damit entfallen `AVE_LAST_BACKGROUND_SCAN_STAGE`, `AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT` und der Rückstell-Zweig. |
| 4 | Die **Wartezeit ist der BG-Delay** (`BackGroundScanDelayPerPage` + Zufall), wie bisher. |
| 5 | **Robustheit:** Eine Ausnahme in einer Scan-Art darf die Schleife **nicht** beenden – jeder Schritt läuft in einem eigenen `try`/`catch`, danach geht die Schleife weiter. |

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
  alte Position und lässt dieselbe Schleife von vorne laufen.
* Das **Cleanup** hängt als Stage 3 im Zyklus (einmal pro kompletter Runde).

## Soll-Zustand

```js
function initScanLoop() {                       // ersetzt initBackgroundScan()
    // Guards wie heute: läuft schon / aus / nicht Master / keine Vine-URL
    // Zustand anlegen, Screen anzeigen, Storage initialisieren
    scanLoop();                                 // Schleife starten
}

async function scanLoop() {
    ScanLoopIsRunning = true;
    while (ScanLoopIsRunning) {
        await delay(getScanDelay());            // BackGroundScanDelayPerPage + Zufall

        if (!isScanLoopActive()) break;         // Master verloren / abgeschaltet

        try {
            if (isTurboScanDue())           await scanStepTurbo();
            else if (isFastScanDue())       await scanStepFast();
            else if (isBackgroundScanDue()) await scanStepBackground();
            else if (isCleanupDue())        await scanStepCleanup();
            // sonst: nichts fällig (Idle-Phase) → nächster Durchlauf
        } catch (error) {
            // Die Schleife läuft weiter, egal was eine Scan-Art wirft.
            console.error(`scanLoop(): the step failed: ${error?.message || error}`);
        }
    }
}
```

* **`while`-Schleife statt Rekursion:** kein Stack-Wachstum, einfacher zu lesen.
  `stopBackgroundScan()` setzt nur `ScanLoopIsRunning = false` und entfernt ein
  eventuell hängendes Scan-Iframe; der laufende `await delay()` läuft noch aus.
* Jeder Schritt **wirft nie** – das `try`/`catch` liegt in der Schleife, damit
  **kein** Schritt vergessen werden kann.

### Die „soll laufen?"-Tests

| Test | Inhalt |
|---|---|
| `isTurboScanDue()` | `EnableTurboScan` **und** die letzte Rotation ist abgeschlossen **und** `now - AVE_TURBO_SCAN_LAST_TIME >= TurboScanIntervalSeconds * 1000` |
| `isFastScanDue()` | wie heute in `prepareFastScan()`, aber ohne Seiteneffekte: genug Zeit seit `AVE_FAST_SCAN_LAST_TIME`, `stage > 0`, `pageMax > 0`, nicht in den ersten 5 % der Seiten |
| `isBackgroundScanDue()` | **nicht** in der Idle-Phase: `stage < 4` **oder** Idle-Zeit abgelaufen (`IdlePeriodAfterScan`) |
| `isCleanupDue()` | `now - AVE_CLEANUP_LAST_TIME >= HoursBeforeCleanup * 3600` **und** der BG-Scan ist in der Idle-Phase (`stage == 4`, Idle-Zeit noch nicht abgelaufen) |

### Die Schritte

| Schritt | Inhalt |
|---|---|
| `scanStepTurbo()` | **zuerst ein Dummy** (Zeitstempel + Log). Später: **eine** Seite (`page=1`) der nächsten Kategorie aus `TurboScanCategories`; der Rotationszähler rückt weiter und springt am Ende auf 0 zurück, dabei wird `AVE_TURBO_SCAN_LAST_TIME` gesetzt. |
| `scanStepFast()` | eine Seite von `queue=encore&pn=&cn=&page=<AVE_FAST_SCAN_PAGE>`, eigener Trefferzähler; Abbruch wie bei `shouldStopFastScan()` (kein Fortschritt / nichts gefunden / Stage vorbei) |
| `scanStepBackground()` | die heutige Logik: eine Seite der aktuellen Stage, Position in `AVE_BACKGROUND_SCAN_STAGE`/`_PAGE_CURRENT` |
| `scanStepCleanup()` | `cleanUpDatabase()` |

### Zustand (localStorage)

| Schlüssel | Bedeutung |
|---|---|
| `AVE_BACKGROUND_SCAN_STAGE`, `_PAGE_CURRENT`, `_PAGE_MAX` | Position und Seitengesamt des BG-Scans (wie heute) |
| `AVE_BACKGROUND_SCAN_LAST_TIME` | Ende der letzten Runde, Basis für Idle und 10-h-Reset |
| `AVE_FAST_SCAN_IS_RUNNING`, `AVE_FAST_SCAN_LAST_TIME`, `AVE_FAST_SCAN_PREVIOUS_NEW_COUNTS` | Fast-Scan (wie heute) |
| `AVE_FAST_SCAN_PAGE` | **neu:** eigener Seitenzähler des Fast-Scans |
| `AVE_TURBO_SCAN_LAST_TIME` | **neu:** Ende der letzten Turbo-Rotation |
| `AVE_TURBO_SCAN_CATEGORY_INDEX` | **neu:** Rotationszähler über `TurboScanCategories` |
| `AVE_CLEANUP_LAST_TIME` | wie heute |
| ~~`AVE_LAST_BACKGROUND_SCAN_STAGE` / `_PAGE_CURRENT`~~ | **entfallen** (Entscheidung 3) |

## Robustheit (Entscheidung 5)

| Maßnahme | Wirkung |
|---|---|
| `try`/`catch` um **jeden** Schritt in der Schleife | eine Ausnahme beendet die Schleife nicht |
| Der Schritt-Vertrag: **nie werfen**, nur Zustand in `localStorage` ändern | `try`/`catch` bleibt die letzte Absicherung |
| `backGroundTileScanner()` behält den Poll-Deckel (300 × 100 ms = 30 s) und ruft danach trotzdem `cb()` | eine Seite, die nie fertig lädt, blockiert die Schleife nicht |
| `withTimeout(promise, ms)` um `cleanUpDatabase()` | ein hängender DB-Zugriff blockiert die Schleife nicht |
| `delay()` kann nicht werfen | die Wartezeit ist kein Fehlerfall |
| `updateBackgroundScanScreenText()` prüft das Element | eine fehlende Anzeige ist kein Fehler |
| Der `await delay()` am Schleifenanfang **begrenzt die Wiederholrate** | eine dauerhaft fehlschlagende Scan-Art erzeugt keine Endlosschleife ohne Pause |
| Zähler für aufeinanderfolgende Fehler je Schritt (optional) | nach N Fehlern den Schritt für eine Weile überspringen |

## Was erhalten bleiben muss

* **Iframe pro Seite** und Entfernen danach (RAM-Fix – darf nicht verloren gehen)
* Master-/Session-Gating, `stopBackgroundScan()` beim Rollenverlust
* Reset nach `> 600 min` (10 h) und die Idle-Phase (`IdlePeriodAfterScan`)
* `AVE_BACKGROUND_SCAN_IS_RUNNING` als „Storage ist initialisiert"-Merker
  (wird heute nie auf `false` gesetzt – **nicht** als „läuft gerade" verwenden)
* Die Screen-Texte, `lastScanPaginationData`, die Drop-Benachrichtigung
  (`notifyAboutProductDrop` mit Schwelle und Wiederholungsintervall)
* DB-Schreibvorgänge → `ave-database-changed` (250 ms entprellt) → Keyword-Suche;
  daran wird **nichts** geändert

## Verifikation (wichtigster Punkt)

`verify_scan.js` vergleicht heute die **Folge der localStorage-Zugriffe** der
alten und der neuen Schleife und erwartet „identisch". Nach diesem Umbau ist das
**nicht mehr möglich**, weil sich die Schleifenform selbst ändert (neue Keys,
andere Reihenfolge der Abfragen).

Vorgehen deshalb in zwei Klassen:

1. **Unverändert verifizierbar (Refactoring):** die einzelnen Schritte und Tests
   – `scanStepBackground()` gegen `scanStageZero/Encore/Idle`, `isFastScanDue()`
   gegen `prepareFastScan()`, `shouldStopFastScan()`. Hier gilt weiter
   „alt und neu müssen identisch sein".
2. **Bewusste Verhaltensänderung (Umbau):** die Schleife selbst. `verify_scan.js`
   wird zu einer **Szenario-Tabelle** umgeschrieben: nicht mehr „alt vs. neu",
   sondern erwartete **Folge der Schritte** (z. B. „Turbo fällig → nur Turbo",
   „BG in Idle → Cleanup kommt dran", „Fast fällig → BG steht still", „Delay
   liegt vor dem Schritt", „Schritt wirft → nächster Durchlauf läuft trotzdem").
   Die Baseline wird dafür neu gesetzt.

## Umsetzungsschritte (je ein Commit, je eine Verifikation)

1. ~~**Vorbereitung ohne Verhaltensänderung:** `getScanDelay()` (Zufall) und die
   „soll laufen?"-Tests als reine Funktionen herausziehen, `prepareFastScan()`
   darauf umbauen. Baseline bleibt gültig.~~ **erledigt** (`getScanDelay()`,
   `getFastScanState()`, `startFastScan()`, `prepareFastScan()` nutzt sie).
2. ~~**Die Schleife einführen:** `scanLoop()` mit Verzögerung vorne, Prioritäten
   und `try`/`catch`, aber **nur** mit BG + Fast + Cleanup (wie heute, ohne
   Turbo).~~ **erledigt** (`scanLoop()` + `scanStepBackground()`,
   `ScanLoopGeneration` gegen doppelt gestartete Schleifen, `scanStepDone` als
   Rückmeldung der Schritte, `try`/`catch` in der Schleife). `verify_scan.js`
   treibt jetzt beide Versionen an (gemockter `delay` + Microtask-Drain) und
   vergleicht weiterhin Schritt für Schritt: **alle 7 Szenarien sind identisch**.
3. **Fast-Scan entkoppeln:** eigener Zähler `AVE_FAST_SCAN_PAGE`, die
   Rückstellung entfernen. Verifikation: die BG-Position ändert sich während
   eines Fast-Scans nicht mehr.
4. **Cleanup als Schritt:** `isCleanupDue()` (zeitbasiert + Idle-Phase) und
   `scanStepCleanup()` mit `withTimeout`. Verifikation: Cleanup läuft nur in der
   Idle-Phase und höchstens einmal je `HoursBeforeCleanup`.
5. **Turbo-Scan als Dummy:** Einstellungen (`EnableTurboScan`,
   `TurboScanCategories`, `TurboScanIntervalSeconds`), `isTurboScanDue()`,
   Rotationszähler und `scanStepTurbo()` ohne Wirkung. Verifikation: Priorität,
   Takt und Rotation, ohne dass eine Seite geladen wird.
6. **Turbo-Scan echt umsetzen** (siehe `docs/TURBO-SCAN.md`).

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Der BG-Scan wird langsamer, wenn Turbo/Fast oft fällig sind | Anteile messen (Turbo +8 % je Kategorie, Fast ~3 %); die Priorisierung ist gewollt |
| Eine Ausnahme beendet die Schleife doch | `try`/`catch` **in** der Schleife (nicht in den Schritten), Szenario „Schritt wirft" im Verifikationsskript |
| `while`-Schleife lässt sich nicht sofort stoppen | `ScanLoopIsRunning` im Schleifenkopf; das laufende `await delay()` läuft noch aus (max. eine Wartezeit) |
| Positionsverlust bei Reload | Position weiter in `localStorage`, inklusive der neuen Turbo-Schlüssel |
