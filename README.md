# knifflor

Kniffel-Zählblock. Jede Spalte ist ein Spiel, Summen rechnet die App selbst,
der Spielstand liegt als JSON im `localStorage` des Browsers.

## Aufbau

    site/     die fertige App - das ist das Deployment-Artefakt
    src/      Flask, nur als lokaler Vorschauserver

`site/` ist reines HTML/CSS/JS ohne Build-Schritt. Bootstrap liegt mit im
Verzeichnis, es gibt keine externen Requests. Alle Pfade sind relativ, die
App läuft also auch in einem Unterverzeichnis.

## Lokal ansehen

    .venv\Scripts\python.exe -m knifflor

Läuft auf http://127.0.0.1:5000. Über `KNIFFLOR_HOST` und `KNIFFLOR_PORT`
anpassbar.

Auf `localhost` und `127.0.0.1` registriert sich der Service Worker
absichtlich **nicht**, und ein bereits installierter wird beim nächsten
Aufruf samt Caches abgeräumt. Sonst würde er beim Entwickeln aus dem Cache
ausliefern und jede Änderung verstecken.

Die PWA lokal testen geht mit `?sw=1`:

    http://127.0.0.1:5000/?sw=1

Danach einmal ohne den Parameter aufrufen, um wieder aufzuräumen.

Vom Handy über die LAN-IP gibt es ohnehin keinen Service Worker - der
braucht HTTPS oder `localhost`. Die App funktioniert dort, nur ohne
Offline-Modus.

## Deployen

Den Inhalt von `site/` hochladen. Mehr ist es nicht.

- **Cloudflare Pages / Netlify**: Repo verbinden, Build-Befehl leer lassen,
  Publish-Verzeichnis `site`.
- **GitHub Pages**: `site/` als Quelle wählen.
- **Beliebiger Webserver**: Verzeichnis ausliefern.

HTTPS ist Pflicht, sonst gibt es keinen Service Worker und keine
Installation auf dem Startbildschirm. Alle genannten Hoster liefern das
automatisch mit.

### GitHub Pages

`.github/workflows/pages.yml` veröffentlicht `site/` bei jedem Push auf
`main`. Einmalig in *Settings → Pages* als Source **GitHub Actions** wählen -
ohne diesen Schritt läuft der Workflow, aber nichts geht live.

### Cache-Version

Der Service Worker liefert aus dem Cache, solange `CACHE_NAME` gleich
bleibt. Geräte, die schon einmal da waren, bekämen sonst ewig die alte
Version.

Der Workflow erledigt das selbst: er setzt `CACHE_NAME` vor dem Hochladen
auf `knifflor-<commit>`. Die Datei im Repo bleibt dabei unverändert, nur das
veröffentlichte Artefakt wird angepasst.

Beim Deployen von Hand auf einen anderen Hoster musst du `CACHE_NAME` in
`site/sw.js` selbst hochzählen.

## PWA

`manifest.webmanifest` und `sw.js` machen die Seite installierbar: Icon auf
dem Startbildschirm, Start ohne Browser-Rahmen, vollständig offline nutzbar.
Beim ersten Besuch legt der Service Worker alle Dateien in den Cache.
