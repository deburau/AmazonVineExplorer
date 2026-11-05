# Release 0.16.0 – Checkliste

> **VERÖFFENTLICHT am 2026-11-05.** Die Entwicklung läuft danach auf dem Branch
> `dev-0.17.0` mit der Version `0.16.0.1`.

Diese Datei enthält den Stand des Release 0.16.0 und alles, was beim Veröffentlichen
zu tun war. Sie liegt im Repository, damit der Ablauf auch nach einer Verdichtung des
Chats nachvollziehbar bleibt.

## Stand

| Punkt | Stand |
|---|---|
| Branch | `dev-0.16.0` (in `main` gemergt) |
| Version im User-Script | `0.16.0` |
| Release-Commit | `chore(release): prepare the version 0.16.0` auf `dev-0.16.0` |
| `main` | aktualisiert (Merge-Commit `chore(release): merge the version 0.16.0`) |
| Datenbank | Version 5 (die Version 4 aus dem Release 0.15.0 + die Preise der Varianten) |
| Changelog | ein Eintrag für 0.16.0 (er war ein Eintrag für alle Patch-Versionen 0.15.0.x) |

## Inhalt des Releases

Der Inhalt steht im Changelog-Eintrag `##### [2026-11-05] - Version 0.16.0` in
`README.md` und in Kurzform in `docs/STAND.md`. Die wichtigsten Punkte:

* Preise der Varianten (Spannen auf den Tiles, alle Preise in der Datenbank)
* Bedingungen in den Keywords: Preise **und** Kategorien, gleiche Operatoren,
  Abkürzungen der Feldnamen, verbatim-Strings in doppelten Anführungszeichen
* Gruppen von Trefferzeilen in den Benachrichtigungen (Desktop und Gotify)
* Die Suche mit denselben Bedingungen
* Turbo-Scan, eigener Fast-Scan-Takt, Neustart-Button, gruppierte Einstellungen
* Die Kategorienliste wird im Hintergrund geladen und gepflegt
* **Warnung:** die Preisbedingungen können bei unspezifischen Keywords zu einer
  Sperre des Kontos führen (siehe den Abschnitt „Too many requests can block your
  account" in `README.md`)

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
