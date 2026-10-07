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

Achtung: Der Service Worker braucht HTTPS oder `localhost`. Ruft man den
Server vom Handy über die LAN-IP auf, registriert er sich nicht - die App
funktioniert dann, aber ohne Offline-Modus.

## Deployen

Den Inhalt von `site/` hochladen. Mehr ist es nicht.

- **Cloudflare Pages / Netlify**: Repo verbinden, Build-Befehl leer lassen,
  Publish-Verzeichnis `site`.
- **GitHub Pages**: `site/` als Quelle wählen.
- **Beliebiger Webserver**: Verzeichnis ausliefern.

HTTPS ist Pflicht, sonst gibt es keinen Service Worker und keine
Installation auf dem Startbildschirm. Alle genannten Hoster liefern das
automatisch mit.

### Nach jeder Änderung

In `site/sw.js` `CACHE_NAME` hochzählen (`knifflor-v1` → `knifflor-v2`).
Ohne das behalten Geräte, die schon einmal da waren, die alte Version.

## PWA

`manifest.webmanifest` und `sw.js` machen die Seite installierbar: Icon auf
dem Startbildschirm, Start ohne Browser-Rahmen, vollständig offline nutzbar.
Beim ersten Besuch legt der Service Worker alle Dateien in den Cache.
