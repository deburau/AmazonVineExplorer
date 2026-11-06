# Release 0.17.0 – Checkliste

> **VERÖFFENTLICHT am 2026-11-06.** Die Entwicklung läuft danach auf dem Branch
> `dev-0.18.0` mit der Version `0.17.0.1`.

Diese Datei enthält den Stand des Release 0.17.0 und alles, was beim Veröffentlichen
zu tun war. Sie liegt im Repository, damit der Ablauf auch nach einer Verdichtung des
Chats nachvollziehbar bleibt.

## Stand

| Punkt | Stand |
|---|---|
| Branch | `dev-0.17.0` (in `main` gemergt) |
| Version im User-Script | `0.17.0` |
| Release-Commit | `chore(release): prepare the version 0.17.0` (`16692b8`) auf `dev-0.17.0` |
| `main` | aktualisiert (Merge-Commit `e34488d`, `Merge branch 'dev-0.17.0' into main`) |
| Datenbank | Version 5 (unverändert – kein neues Feld) |
| Changelog | ein Eintrag für 0.17.0 (er war ein Eintrag für alle Patch-Versionen 0.16.0.4 bis 0.16.0.15) |
| Verifikationen | 20 Skripte (`npm run verify`), alle grün; `npm run check` grün |

## Inhalt des Releases

Der Inhalt steht im Changelog-Eintrag `##### [2026-11-06] - Version 0.17.0` in
`README.md` und in Kurzform in `docs/STAND.md`. Die wichtigsten Punkte:

* **Turbo-Scan:** die virtuelle Kategorie **„Alle Produkte"** am Ende der Liste – als
  letzter Schritt einer Runde lädt sie die normale erste Produktseite
* **Gotify:** einstellbare **Priorität** (`GotifyPriority`, 0–10, Standard 5) unter einer
  eigenen Überschrift „Gotify", ein Button für eine **Testnachricht** und die
  Keyword-Bedingung **`gotifyPriority=<n>`** (nur `=`, jede Abkürzung wie bei `price`
  und `category`), die die Priorität der Treffer dieses Keywords setzt
* **Issue #32:** mit der Einstellung „Kategorien deaktivieren" bleiben die Buttons
  „Seite als gesehen markieren", „Alle als gesehen markieren" und „Zum Seitenanfang"
  erhalten: die Seitenleiste wird zu einer **schmalen Spalte (24 px)** mit **um 90°
  gedrehten** Buttons, die zusätzlich beim Scrollen als Block oben haften

## Schritt 1: Release-Commit auf dem Entwicklungsbranch

```bash
cd /home/wf/AmazonVineExplorer
# In VineExplorer.user.js die Version auf 0.17.0 setzen
# In README.md die Ueberschrift des Changelog-Eintrags auf "Version 0.17.0" aendern
# In docs/STAND.md die Zeilen der Tests des Zyklus auf "bestaetigt" setzen
git commit -m "chore(release): prepare the version 0.17.0"
git push origin dev-0.17.0
```

## Schritt 2: `main` aktualisieren (erst nach ausdrücklicher Freigabe)

```bash
cd /home/wf/AmazonVineExplorer
git checkout main
git merge --no-ff dev-0.17.0 -m "Merge branch 'dev-0.17.0' into main"
npm run check && npm run verify
git push origin main
```

`main` ist die ausgelieferte Version – der Push ist eine Veröffentlichung und
braucht eine ausdrückliche Freigabe (siehe `AGENTS.md`).

Kontrolle nach dem Push:

```bash
curl -sS https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/VineExplorer.user.js | grep -m1 "@version"
# => // @version      0.17.0
```

## Schritt 3: Projektdoku nachziehen

```bash
# HANDOVER.md: Branch dev-0.17.0 -> dev-0.18.0, Release 0.17.0, neuer Merge-Commit
# docs/STAND.md:  Version 0.17.0 als veröffentlicht markieren
git commit -m "docs(handover): update the state after the release of 0.17.0"
git push origin main
```

## Schritt 4: Neuer Entwicklungsbranch

```bash
git checkout -b dev-0.18.0 main
```

Danach in `VineExplorer.user.js` die Version auf `0.17.0.1` setzen und einen
Changelog-Eintrag `##### [YYYY-MM-DD] - Version 0.17.0.1` anlegen:

> The development continues on the branch `dev-0.18.0`, the version was raised
> to prepare the next release.

```bash
git commit -m "chore(release): raise the version to 0.17.0.1"
git push origin dev-0.18.0
```

## Was das Release **nicht** enthält

* **Issue #32 ist am 2026-11-06 geschlossen** (`state_reason: completed`) – der Kommentar
  nennt die Änderungen, das Schließen brauchte einen GitHub-Token (die API akzeptiert
  den SSH-Schlüssel nicht).
* Die Vorsorge gegen eine Kontosperre und die Reduktion der Schreib-/Loglast bleiben
  entschieden bzw. zurückgestellt (siehe `docs/STAND.md`, „Entschieden / zurückgestellt").
