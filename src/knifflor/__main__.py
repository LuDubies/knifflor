"""Startet den lokalen Vorschauserver: python -m knifflor

Nur zum Entwickeln gedacht. Ausgeliefert wird später site/ als statische
Seite, dieser Server ist dann nicht mehr beteiligt.
"""

import os

from knifflor.app import create_app


def main() -> None:
    host = os.environ.get("KNIFFLOR_HOST", "127.0.0.1")
    port = int(os.environ.get("KNIFFLOR_PORT", "5000"))

    print(f"knifflor: http://{host}:{port}  (Strg+C beendet)")
    # Kein debug=True: der Werkzeug-Debugger fuehrt Code aus, und der Server
    # hat hier nichts zu tun, was ein Neuladen rechtfertigen wuerde.
    create_app().run(host=host, port=port)


if __name__ == "__main__":
    main()
