# Release 0.18.0 – Checkliste

> **VERÖFFENTLICHT am 2026-11-08.** Die Entwicklung läuft danach auf dem Branch
> `dev-0.19.0` mit der Version `0.18.0.1`.

Diese Datei enthält den Stand des Release 0.18.0 und alles, was beim Veröffentlichen
zu tun war. Sie liegt im Repository, damit der Ablauf auch nach einer Verdichtung des
Chats nachvollziehbar bleibt.

## Stand

| Punkt | Stand |
|---|---|
| Branch | `dev-0.18.0` (in `main` gemergt) |
| Version im User-Script | `0.18.0` |
| Release-Commit | `chore(release): prepare the version 0.18.0` (`4ae6a8b`) auf `dev-0.18.0` |
| `main` | aktualisiert (Merge-Commit `e0a9439`, `Merge branch 'dev-0.18.0' into main`) |
| Doku-Commit | `docs(handover): update the state after the release of 0.18.0` (der Commit mit dieser Datei) |
| Datenbank | Version 5 (unverändert – kein neues Feld) |
| Einstellungen | 76 (`scripts/check_settings_keys.js`) |
| Changelog | **ein** Eintrag für 0.18.0; er ersetzt die Einträge der Patch-Versionen `0.17.0.1` bis `0.17.0.8` |
| Verifikationen | 21 Skripte (`npm run verify`), alle grün; `npm run check` grün (0 Warnungen) |

## Inhalt des Releases

Der Inhalt steht im Changelog-Eintrag `##### [2026-11-08] - Version 0.18.0` in
`README.md` und in Kurzform in `docs/STAND.md`. Die wichtigsten Punkte:

* **Detailansicht aus einer Benachrichtigung (Fix):** der versteckte „Weitere
  Details"-Button hatte seit dem Commit `3641acf` (2025-06-09) ein abgeschnittenes
  `class`-Attribut (`class="a-butt[...]`), das `<input>` war nie geschlossen und der
  Browser musste den Tag selbst reparieren. In Brave kam das Fenster mit den Details
  beim Klick auf eine Desktop-Benachrichtigung deshalb meistens nicht. Der Button ist
  vollständig und die Wartezeit vor dem Klick beträgt **1 s** statt 0,5 s.
* **Eigene Gruppe „Desktop-Benachrichtigung"** (`TITLE_DESKTOP_NOTIFICATIONS`, in
  `globals.js` direkt über der Gotify-Gruppe) mit dem Schalter
  `EnableDesktopNotifikation` und `DesktopNotifikationKeywords`; die Überschrift der
  Keywords ist per CSS ausgeblendet (`display: none`), das `<h4>` bleibt im DOM, weil
  `verify_settings_ui.js` das erzeugte DOM gegen die Baseline `1e6b6e9` vergleicht.
* **Test-Button „Testnachricht senden"** (`BUTTON_DESKTOP_TEST`) in dieser Gruppe: der
  Klick ist die Nutzeraktion für `Notification.requestPermission()`, die Nachricht
  nutzt das neueste Produkt der Datenbank (`getNewestProductOfDatabase()`, höchstes
  `ts_lastSeen`) mit Bild und Klickziel (`getProductTargetUrl()`).
* **Gotify:** die Testnachricht zeigt dasselbe wie die Desktop-Testnachricht (Bild als
  Markdown-Link, Testzeile an der Stelle der Trefferzeilen, Beschreibung), und die
  Nachrichten öffnen die `vine-data`-Adresse wie die Desktop-Nachrichten statt der
  Produktseite.
* **Wächter:** `scripts/verify/verify_desktop_notification.js` ist neu (47 Fälle),
  `scripts/verify/verify_gotify_priority.js` hat 44 Fälle.

## Schritt 1: Release-Commit auf dem Entwicklungsbranch

```bash
cd /home/wf/AmazonVineExplorer
# In VineExplorer.user.js die Version auf 0.18.0 setzen
# In README.md die Eintraege 0.17.0.1 bis 0.17.0.8 zu EINEM Eintrag 0.18.0 zusammenfassen
# In docs/STAND.md die Zeilen der Tests des Zyklus auf "bestaetigt" setzen
git commit -m "chore(release): prepare the version 0.18.0"
git push origin dev-0.18.0
```

## Schritt 2: `main` aktualisieren (erst nach ausdrücklicher Freigabe)

```bash
cd /home/wf/AmazonVineExplorer
git checkout main
git merge --no-ff dev-0.18.0 -m "Merge branch 'dev-0.18.0' into main"
npm run check && npm run verify
git push origin main
```

`main` ist die ausgelieferte Version – der Push ist eine Veröffentlichung und
braucht eine ausdrückliche Freigabe (siehe `AGENTS.md`).

Kontrolle nach dem Push:

```bash
curl -sS https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/VineExplorer.user.js | grep -m1 "@version"
# => // @version      0.18.0
```

## Schritt 3: Projektdoku nachziehen

```bash
# HANDOVER.md: Branch dev-0.18.0 -> dev-0.19.0, Release 0.18.0, neuer Merge-Commit
# docs/STAND.md:  Version 0.18.0 als veröffentlicht markieren
# docs/RELEASE-0.18.0.md: diese Datei
git commit -m "docs(handover): update the state after the release of 0.18.0"
git push origin main
```

## Schritt 4: Neuer Entwicklungsbranch

```bash
git checkout -b dev-0.19.0 main
```

Danach in `VineExplorer.user.js` die Version auf `0.18.0.1` setzen und einen
Changelog-Eintrag `##### [YYYY-MM-DD] - Version 0.18.0.1` anlegen:

> The development continues on the branch `dev-0.19.0`, the version was raised
> to prepare the next release.

```bash
git commit -m "chore(release): raise the version to 0.18.0.1"
git push origin dev-0.19.0
```

## Was das Release **nicht** enthält

* Die Vorsorge gegen eine Kontosperre (zu viele Detail-Requests) und die Reduktion der
  Schreib-/Loglast bleiben **entschieden bzw. zurückgestellt** (siehe `docs/STAND.md`,
  „Entschieden / zurückgestellt").
* `fixProductImageUrl()` ist weiterhin **nicht** null-sicher; die neuen Aufrufstellen
  prüfen `data_img_url` selbst. Ein eigener kleiner Fix steht noch aus.
* Der frühere Befund „in Brave kam trotz `granted` keine Desktop-Nachricht an" ist
  **erledigt** (die Nachrichten kommen an), die genaue Ursache wurde aber nicht mehr
  nachgestellt.
