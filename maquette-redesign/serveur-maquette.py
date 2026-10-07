"""
Serveur de la maquette, sur http://localhost:3200.

Il sert les fichiers de ce dossier et relaie /api/ et /media/ vers le serveur
Django (http://localhost:8000). La maquette et l'API partagent ainsi la même
adresse : pas de CORS à régler, cookies de session et jeton CSRF passent tels
quels. Rien n'est modifié dans back/.

    ..\\back\\.venv\\Scripts\\python.exe serveur-maquette.py
"""
import http.client
import http.server
import os
import socketserver
import sys
import urllib.parse

PORT = int(os.environ.get("PORT_MAQUETTE", "3200"))
DJANGO = os.environ.get("DJANGO", "localhost:8000")
RELAIS = ("/api/", "/media/", "/admin/", "/static/")
os.chdir(os.path.dirname(os.path.abspath(__file__)))
# Les images que la base cite en « /images/... » vivent dans le dossier public
# du front Next.js : on les sert depuis là, en lecture seule.
PUBLIC_FRONT = os.path.abspath(os.path.join("..", "front", "public"))


class Gestion(http.server.SimpleHTTPRequestHandler):
    def _relayer(self):
        longueur = int(self.headers.get("Content-Length") or 0)
        corps = self.rfile.read(longueur) if longueur else None
        entetes = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "connection", "accept-encoding")}
        entetes["Host"] = DJANGO
        try:
            cnx = http.client.HTTPConnection(DJANGO, timeout=30)
            cnx.request(self.command, self.path, body=corps, headers=entetes)
            rep = cnx.getresponse()
            donnees = rep.read()
        except OSError as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(('{"detail": "Le serveur Django ne répond pas sur %s (%s)."}' % (DJANGO, e)).encode())
            return
        self.send_response(rep.status, rep.reason)
        for cle, valeur in rep.getheaders():
            if cle.lower() in ("transfer-encoding", "connection", "content-length", "content-encoding"):
                continue
            self.send_header(cle, valeur)
        self.send_header("Content-Length", str(len(donnees)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(donnees)

    def translate_path(self, chemin):
        local = super().translate_path(chemin)
        if not os.path.exists(local) and os.path.isdir(PUBLIC_FRONT):
            propre = urllib.parse.unquote(chemin.split("?", 1)[0].split("#", 1)[0]).lstrip("/")
            candidat = os.path.abspath(os.path.join(PUBLIC_FRONT, *propre.split("/")))
            if candidat.startswith(PUBLIC_FRONT) and os.path.isfile(candidat):
                return candidat
        return local

    def _route(self, defaut):
        if self.path.startswith(RELAIS):
            return self._relayer()
        return defaut()

    def do_GET(self): self._route(super().do_GET)
    def do_HEAD(self): self._route(super().do_HEAD)
    def do_POST(self): self._relayer()
    def do_PUT(self): self._relayer()
    def do_PATCH(self): self._relayer()
    def do_DELETE(self): self._relayer()
    def do_OPTIONS(self): self._relayer()

    def end_headers(self):
        if not self.path.startswith(RELAIS):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("%s  %s\n" % (self.command, self.path))


class Serveur(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    print(f"Maquette : http://localhost:{PORT}/index.html  et  http://localhost:{PORT}/plein-ecran.html")
    print(f"API relayée vers http://{DJANGO}  (Ctrl+C pour arrêter)")
    Serveur(("", PORT), Gestion).serve_forever()
