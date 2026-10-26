# Übergabe auf ein neues System (Ubuntu / Proxmox LXC)

Kurzfassung: **Alles, was den Projektstand betrifft, liegt in Git.** Auf dem neuen System
reicht ein `git clone` – der Stand ist danach identisch.

---

## 1. Projektstand übernehmen

```bash
git clone https://github.com/deburau/AmazonVineExplorer.git
cd AmazonVineExplorer
git checkout dev-0-13.0          # der Arbeits-Branch
npm install                       # nur für ESLint nötig (node_modules ist ignoriert)
```

Kontrolle:

```bash
git log --oneline -1              # erwartet: 23cddfd docs(agents): document how screenshots are shared
grep "@version" VineExplorer.user.js   # erwartet: 0.12.1.22
npx eslint .                      # erwartet: keine Ausgabe
```

### Was **nicht** in Git liegt (und auch nicht muss)

| Datei | Warum | Verlust beim Wechsel? |
|---|---|---|
| `node_modules/` | ist in `.gitignore` | nein, `npm install` |
| `package-lock.json` | ist in `.gitignore` | nein |
| `.unotes/` (Screenshots) | ist in `.gitignore` | nur alte Screenshots |
| Browser-Profil / Tampermonkey | liegt im Browser | **ja** – siehe Abschnitt 4 |

---

## 2. Git-Konfiguration auf dem neuen System

Remotes sind im Repo gespeichert, die Zugangsdaten nicht:

```bash
git remote -v    # erwartet: origin (deburau) + upstream (Amazon-Vine-Explorer)
```

Für Pushes wird ein Token benötigt. Seitenverwaltung → *Developer settings* →
*Personal access tokens* (Scope `repo`) → dann:

```bash
git config --global credential.helper store   # oder 'cache' / einen Secret-Manager nutzen
```

Beim ersten Push nach dem Wechsel fragt Git nach Benutzername und Passwort:
- Benutzername: der GitHub-Benutzername
- Passwort: das **Token** (nicht das GitHub-Passwort)

> Alternativ (empfohlen, especially on a headless LXC): SSH-Key anlegen und den
> Public Key als Deploy Key bzw. als SSH-Key beim GitHub-Konto hinterlegen, danach
> `git remote set-url origin git@github.com:deburau/AmazonVineExplorer.git`.

### Branches

| Branch | Zweck | Push erlaubt? |
|---|---|---|
| `dev-0-13.0` | aktuelle Entwicklung | **ja**, ohne Nachfrage |
| `main` | veröffentlichte Version für die Nutzer | **nur auf ausdrückliche Anforderung** |
| `dev-0.11.x` | alte Entwicklungsstände | nach Absprache |

`main` ist auf `379193c` und **darf nicht** angefasst werden, solange das nicht
ausdrücklich vereinbart wurde.

---

## 3. pi (Agent) auf dem neuen System

Der Arbeitsstand des Agenten steckt in zwei Dingen: den **Regeln** (im Repo, wandern
mit) und dem **Chat-Verlauf** (lokal).

### 3.1 Installation

```bash
npm install -g @earendil-works/pi-coding-agent
pi --version
```

Modellliste aktualisieren (nötig, damit `/model` die Modelle kennt):

```bash
pi update --models
```

Zugangsdaten (`~/.pi/agent/auth.json`) und Modell-Einstellungen
(`~/.pi/agent/settings.json`) sind **nicht** im Repo. Auf dem neuen System:

### 3.1 Anmeldung (API-Key)

Innerhalb von pi geht das am einfachsten über den Slash-Befehl:

```
/login openrouter
```

pi zeigt die verfügbaren Methoden (OAuth-Geräte-Flow oder API-Key) und speichert das
Ergebnis in `~/.pi/agent/auth.json`.

> **Headless LXC:** Wenn beim OAuth-Flow der Callback nicht im lokalen Browser
> aufgeht, kopiert pi eine Redirect-URL bzw. einen Autorisierungscode in die
> Anzeige – den einfach in pi wieder einfügen.

Alternativ per Umgebungsvariable (praktisch in Docker/Proxmox):

```bash
export OPENROUTER_API_KEY="sk-or-..."
```

### 3.2 Modell-Defaults

`pi config` ist **nicht** dafür zuständig (der Befehl verwaltet Pi-Packages).
Die Defaults stehen in `~/.pi/agent/settings.json` und werden von Hand editiert:

```bash
mkdir -p ~/.pi/agent
cat > ~/.pi/agent/settings.json <<'EOF'
{
  "defaultProvider": "openrouter",
  "defaultModel": "moonshotai/kimi-k2.6"
}
EOF
```

Alternativ nur für einen Start: `pi --provider openrouter --model moonshotai/kimi-k2.6`

> `defaultModel` muss die **exakte** Modell-ID aus `/model` sein. Mit
> `pi update --models` wird die Modellliste aktualisiert; `/model` zeigt sie an.

### 3.2 Chat-Verlauf mitnehmen (optional, aber empfohlen)

Der laufende Chat liegt in:

```
~/.pi/agent/sessions/--d--Projekte-AmazonVineExplorer--/
```

Diesen Ordner auf das neue System kopieren. Beim Fortsetzen in einem Verzeichnis
mit demselben Pfad erkennt pi die Session wieder:

```bash
# Alt -> Neu (Beispiel)
rsync -av ~/.pi/agent/sessions/ ~/.pi/agent/sessions/
```

Danach im neuen Verzeichnis `pi` starten und die Session auswählen.

> **Wichtig:** Auch wenn der Chatverlauf fehlt, ist die Zusammenarbeit **voll
> funktionsfähig**. Der komplette Projektstand, alle Regeln, die Push-Regeln und
> der Arbeitsstand der einzelnen Fixes stehen in `AGENTS.md` und `README.md`
> (Changelog) im Repository.

### 3.3 Was `AGENTS.md` dem Agenten mitgibt

Die Datei wird von pi beim Start automatisch geladen und enthält:
- Projektübersicht, Technologie-Stack, Befehle
- **Git-Regeln**: `dev-*` pushen ja, `main` nur auf Anforderung
- **Versionierung**: jede sichtbare Änderung → neue `@version` + Changelog-Eintrag
- **Arbeitsweise**: immer **eine** Änderung pro Schritt, vom Maintainer testen lassen
- **Screenshots**: Pfad pasten, Agent liest die Datei mit dem `read`-Tool
- Code-Konventionen, Fehlerbehandlungsmuster, Checklisten

---

## 4. Browser / Tampermonkey (nur für die Tests nötig)

Das Userscript wird **nicht** aus dem Repo installiert, sondern aus dem Raw-Link des
Branches, in dem entwickelt wird:

```
https://raw.githubusercontent.com/deburau/AmazonVineExplorer/dev-0-13.0/VineExplorer.user.js
```

> Der `@updateURL` im Script zeigt bewusst auf `main`. Das Script aktualisiert sich
> also nicht automatisch vom Dev-Branch – gut, so werden die anderen Nutzer nicht
> beeinträchtigt. Für Tests muss der Dev-Branch manuell installiert werden.

Tampermonkey auf dem neuen Browser installieren und das Script von obiger URL
importieren. Achtung: Tampermonkey installiert `@require`-Dateien **relativ zum
Script** – deshalb funktioniert nur die Installation über den Raw-Link, nicht per
Copy-Paste (steht auch so im README).

### Datenbank der Nutzer

Die AVE-Datenbank (IndexedDB) und die Einstellungen (GM-Storage) liegen im
**Browserprofil** des jeweiligen Systems. Auf einem neuen System ist die DB leer.

Für einen realistischen Test des Background-Scans wird eine gefüllte DB gebraucht:
--exportierten Datenbestand über **AVE Einstellungen → DATABSE EXPORT >>>** sichern
- auf dem neuen System über **DATABSE IMPORT <<<** wieder einspielen

Ohne Import läuft der Scan ebenfalls, sieht aber eine leere DB (der erste Scan
füllt sie dann mit ~36 Produkten der ersten Seite).

---

## 5. Empfohlene Reihenfolge auf dem neuen System

1. `git clone` + `git checkout dev-0-13.0` + `npm install`
2. `npx eslint .` → muss ohne Ausgabe durchlaufen
3. `git log --oneline -1` → `23cddfd`
4. pi installieren + Modell/Key konfigurieren
5. (optional) `~/.pi/agent/sessions/` kopieren, um den Chat fortzusetzen
6. Browser + Tampermonkey + Script aus dem Dev-Branch installieren
7. optional: DB-Export/-Import für realistische Tests

Danach kann direkt mit dem nächsten Schritt weitergearbeitet werden. Der offene
Punkt war: **Schritt 1 des async-Refactors** (Hot Path / Scan) – siehe
`README.md` (Changelog) für die bereits erledigten Fixes.

---

## 6. Kurzstatus zum Zeitpunkt der Übergabe

| Punkt | Stand |
|---|---|
| Branch | `dev-0-13.0` |
| Letzter Commit | `23cddfd` docs(agents): document how screenshots are shared |
| Version | `0.12.1.22` |
| `origin/dev-0-13.0` | identisch mit lokal |
| `main` | `379193c` – **unverändert** |
| Arbeitsverzeichnis | sauber, keine offenen Änderungen |
| Tests | manuell (Browser), kein Test-Framework |
