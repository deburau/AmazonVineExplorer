# Release 0.15.0 – Checkliste

Diese Datei enthält den fertigen Stand des Release 0.15.0 und alles, was noch
zu tun ist, wenn `main` gepusht werden soll. Sie liegt im Repository, damit der
Rest auch nach einer Verdichtung des Chats nicht verloren geht.

## Stand

| Punkt | Stand |
|---|---|
| Branch | `dev-0.15.0` |
| Version im User-Script | `0.15.0` |
| Release-Commit | `chore(release): prepare the version 0.15.0` |
| `main` | **noch nicht aktualisiert** (steht auf dem Release 0.14.0) |
| Issue #68 | **noch offen**, der Kommentar ist vorbereitet, aber noch nicht geschrieben |

## Inhalt des Releases

* **Erkennung der Vine-Seiten mit Sprachsegment** (Firefox):
  `https://www.amazon.de/-/de/vine/vine-items` wurde vorher nicht als
  Vine-Seite erkannt, das Script blieb inaktiv und Infinite Scroll und
  Background Scan brachen mit einem Fehler ab.
* **Keyword in der Desktop-Benachrichtigung**, vor der Beschreibung des
  Produktes, übersetzt als „Treffer" (de) bzw. „Match" (en).
  Damit ist **Issue #68** erledigt.
* **Bilder der Benachrichtigungen** aus dem richtigen Repository
  (`deburau/AmazonVineExplorer`) statt aus einem alten Fork.
* **Neuer Wächter** `scripts/verify/verify_site_detection.js` (16 Fälle).

## Schritt 1: `main` aktualisieren (erst nach ausdrücklicher Freigabe)

```bash
cd /home/wf/AmazonVineExplorer
git checkout main
git merge --no-ff dev-0.15.0 -m "Merge branch 'dev-0.15.0' into main"
npm run check && npm run verify
git push origin main
```

`main` ist die ausgelieferte Version – der Push ist eine Veröffentlichung und
braucht eine ausdrückliche Freigabe (siehe `AGENTS.md`).

## Schritt 2: Projektdoku nachziehen

```bash
# HANDOVER.md: Branch dev-0.15.0 -> dev-0.16.0, Version 0.14.0 -> 0.15.0
# docs/STAND.md:  Release 0.15.0 als veröffentlicht markieren
git commit -m "docs(handover): update the state after the release of 0.15.0"
git push origin main
```

## Schritt 3: Neuer Entwicklungsbranch

```bash
git checkout -b dev-0.16.0 main
```

Danach in `VineExplorer.user.js` die Version auf `0.15.0.1` setzen und einen
Changelog-Eintrag `##### [YYYY-MM-DD] - Version 0.15.0.1` anlegen:

> The development continues on the branch `dev-0.16.0`, the version was raised
> to prepare the next release.

```bash
git commit -m "chore(release): raise the version to 0.15.0.1"
git push origin dev-0.16.0
```

## Schritt 4: Issue #68 kommentieren und schließen

Erst **nach** dem Push von `main` ausführen, weil der Kommentar auf das
veröffentlichte Release verweist.

### Kommentartext

```text
Thanks for the idea, and sorry for the delay!

The keyword is now shown in the desktop notification of a keyword match. It is shown *before* the description of the product, because the keyword is the reason for the notification.

I did not add a separate `keyword` parameter to `desktopNotifikation()`. The text is built at the call site in `checkKeywordsForProduct()` and translated, so the notification says "Treffer" in German and "Match" in English:

- German: `Treffer: <keyword>` followed by the description of the product
- English: `Match: <keyword>` followed by the description of the product

This is part of the release 0.15.0.

Thanks!
```

### Kommentieren und schließen

Am einfachsten über die Web-Oberfläche:

1. https://github.com/deburau/AmazonVineExplorer/issues/68 öffnen
2. Den Kommentartext in das Kommentarfeld einfügen und absenden
3. Oben rechts auf **Close issue** klicken

Alternativ über die API (dafür wird ein Token mit dem Scope `repo` gebraucht):

```bash
TOKEN=<github-token>
REPO=deburau/AmazonVineExplorer

# Kommentar schreiben
curl -X POST -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/repos/$REPO/issues/68/comments \
     -d "$(python3 - <<'PY'
import json
print(json.dumps({"body": open('/tmp/issue-68-comment.md').read()}))
PY
)"

# Issue schließen
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/repos/$REPO/issues/68 \
     -d '{"state": "closed"}'
```

Der Kommentartext liegt für den API-Weg zusätzlich in diesem Dokument unter
„Kommentartext" ab.
