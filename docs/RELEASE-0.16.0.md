# Release 0.16.0 – Checkliste

> **VORBEREITET am 2026-11-02.** Das Release 0.16.0 ist noch nicht
> veröffentlicht. Die Entwicklung läuft auf `dev-0.16.0` mit der Version
> `0.15.0.16`, `main` steht noch auf dem Release 0.15.0. Für die
> Veröffentlichung wird die ausdrückliche Freigabe des Maintainers gebraucht
> (siehe `AGENTS.md`).

Diese Datei enthält den fertigen Stand des Release 0.16.0 und alles, was noch
zu tun ist, wenn `main` gepusht werden soll. Sie liegt im Repository, damit
der Rest auch nach einer Verdichtung des Chats nicht verloren geht.

## Stand

| Punkt | Stand |
|---|---|
| Branch | `dev-0.16.0` |
| Version im User-Script | `0.15.0.16` (wird beim Release auf `0.16.0` gesetzt) |
| Release-Commit | **noch nicht erstellt** (`chore(release): prepare the version 0.16.0`) |
| `main` | **noch nicht aktualisiert** (steht auf dem Release 0.15.0) |
| Datenbank | Version 5 (die Version 4 aus dem Release 0.15.0 + 1) |
| Changelog | ein Eintrag für die Patch-Versionen 0.15.0.x, er wird beim Release zum Eintrag für 0.16.0 |

## Inhalt des Releases

* **Preise der Varianten**: Die Preise aller Varianten stehen in der Spalte
  `data_estimated_tax_prices`, die Tiles zeigen den Bereich vom kleinsten bis
  zum größten Preis. Die vorhandenen Preise bleiben beim Upgrade erhalten.
* **Preisbedingungen in den Keywords**: Ein Keyword kann Bedingungen enthalten,
  z. B. `toaster price>=10 price<20`. Die Preise werden erst geladen,
  wenn das Keyword gematcht hat.
* **Schnellere Preisdetails**: Die Wartezeit zwischen den Varianten-Requests
  (`VariationRequestDelay`, Default 500 ms) und zwischen den Produkten der
  Queue (`ProductDetailsRequestDelay`, Default 1500 ms) sind einstellbar.
* **Benachrichtigung nach den Preisen**: Die Benachrichtigung bei einem
  Keyword-Treffer kommt erst, wenn die Preise geladen sind.
* **Fix**: Das Script startete nicht mit einer Datenbank, die mit einer
  älteren Version von AVE angelegt wurde.

## Schritt 1: Release-Commit auf dem Entwicklungsbranch

```bash
cd /home/wf/AmazonVineExplorer
# In VineExplorer.user.js die Version auf 0.16.0 setzen
# In README.md die Ueberschrift des Changelog-Eintrags auf "Version 0.16.0" aendern
git commit -m "chore(release): prepare the version 0.16.0"
git push origin dev-0.16.0
```

## Schritt 2: `main` aktualisieren (erst nach ausdrücklicher Freigabe)

```bash
cd /home/wf/AmazonVineExplorer
git checkout main
git merge --no-ff dev-0.16.0 -m "Merge branch 'dev-0.16.0' into main"
npm run check && npm run verify
git push origin main
```

`main` ist die ausgelieferte Version – der Push ist eine Veröffentlichung und
braucht eine ausdrückliche Freigabe (siehe `AGENTS.md`).

## Schritt 3: Projektdoku nachziehen

```bash
# HANDOVER.md: Branch dev-0.16.0 -> dev-0.17.0, Version 0.15.0 -> 0.16.0
# docs/STAND.md:  Release 0.16.0 als veröffentlicht markieren
git commit -m "docs(handover): update the state after the release of 0.16.0"
git push origin main
```

## Schritt 4: Neuer Entwicklungsbranch

```bash
git checkout -b dev-0.17.0 main
```

Danach in `VineExplorer.user.js` die Version auf `0.16.0.1` setzen und einen
Changelog-Eintrag `##### [YYYY-MM-DD] - Version 0.16.0.1` anlegen:

> The development continues on the branch `dev-0.17.0`, the version was raised
> to prepare the next release.

```bash
git commit -m "chore(release): raise the version to 0.16.0.1"
git push origin dev-0.17.0
```
