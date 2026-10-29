# Stand des Projekts

Dieser Stand liegt im Repository, damit er nach einer Verdichtung des Chats
nicht verloren geht. Bei Fragen zuerst hier und in `git log` nachschauen.

## Aktueller Stand

| Punkt | Stand |
|---|---|
| Branch | `dev-0.14.0` (gepusht, HEAD = `d949dda`) |
| Version im User-Script | `0.13.0.12` |
| Letztes Release | `0.13.0` (auf `main`, veröffentlicht) |
| Lint / Formatierung | 0 Errors, 0 Warnings (`npm run check`) |
| Verifikationen | alle 6 erfolgreich (`npm run verify`) |
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

## Wichtige Dateien

| Datei | Inhalt |
|---|---|
| `VineExplorer.user.js` (~4400 Zeilen) | Hauptdatei, alle Funktionen |
| `globals.js` | Konstanten, Settings, Session-Management |
| `scripts/verify/` | 6 Verifikationsskripte für die Refactorings |
| `scripts/check_css_syntax.js` | prüft die CSS auf Kommentare mit falscher Syntax |
| `scripts/check_settings_keys.js` | prüft die Schlüssel der Einstellungen und der Übersetzungen |
| `scripts/verify/baselines.json` | Git-Stand, gegen den verglichen wird |
| `scripts/verify/lib/verify_helpers.js` | Gemeinsame Helfer der Skripte |
| `.unotes/` | Lokale Testskripte (nicht versioniert) |
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
| `npm run check` | Prettier + ESLint + CSS-Check + Schlüssel-Check (muss immer grün sein) |
| `npm run verify` | alle Verifikationen |
| `npm run verify:baseline` | Baseline einfrieren |
| `npm run format` | Quellen formatieren |

## Branch-Regeln

* `main` wird an die Nutzer ausgeliefert → **niemals** ohne ausdrückliche
  Anfrage pushen
* `dev-*` darf ohne Nachfrage gepusht werden
* Commits: `type(scope): Beschreibung`, z. B. `fix(scan): ...`
* Version im User-Script + Changelog in `README.md` bei jeder Änderung
