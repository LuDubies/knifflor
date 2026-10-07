"""Lokaler Vorschauserver für die statische knifflor-Seite.

Die App liegt als fertiges HTML/CSS/JS in site/ und braucht zum Betrieb
keinen Server. Dieses Modul liefert das Verzeichnis nur zum Entwickeln aus,
damit lokal dieselben Pfade gelten wie später beim Hoster.
"""

from pathlib import Path

from flask import Flask

#: site/ liegt neben src/ im Projektwurzelverzeichnis.
SITE_DIR = Path(__file__).resolve().parents[2] / "site"


def create_app(site_dir: Path | str | None = None) -> Flask:
    """Liefert das Verzeichnis site/ unter / aus."""
    root = Path(site_dir).resolve() if site_dir else SITE_DIR

    if not (root / "index.html").is_file():
        raise FileNotFoundError(f"Keine index.html in {root} - ist site/ vorhanden?")

    app = Flask(__name__, static_folder=str(root), static_url_path="")

    # Ohne das verdeckt der Browser-Cache beim Entwickeln jede Änderung.
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    return app
