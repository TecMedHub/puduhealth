"""Servidor HTTPS local para medir con la cámara del celular en la misma red WiFi.

El navegador sólo permite usar la cámara en HTTPS (o en localhost). Este servidor usa un
certificado autofirmado: el celular mostrará una advertencia que hay que aceptar una vez.

Sólo sirve la app y el procesamiento de señal (/app/ y /pulsometro/assets/); nunca los datos.

Uso: python3 app/servir_https.py [puerto]
"""

import http.server
import socket
import ssl
import subprocess
import sys
from functools import partial
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
CERTS = Path.home() / ".cache" / "salud-a-bordo"
PERMITIDAS = ("/app/", "/pulsometro/assets/")
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8443


class SoloApp(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        ruta = self.path.split("?", 1)[0]
        if ruta == "/":
            self.send_response(302)
            self.send_header("Location", "/app/")
            self.end_headers()
            return
        if not ruta.startswith(PERMITIDAS) or ".." in ruta:
            self.send_error(404)
            return
        super().do_GET()

    def list_directory(self, path):
        self.send_error(404)


def certificado():
    CERTS.mkdir(parents=True, exist_ok=True)
    cert, clave = CERTS / "cert.pem", CERTS / "clave.pem"
    if not cert.exists():
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30",
             "-subj", "/CN=salud-a-bordo", "-keyout", str(clave), "-out", str(cert)],
            check=True, capture_output=True,
        )
    return cert, clave


def ip_local():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("10.255.255.255", 1))  # no envía paquetes: sólo elige la interfaz de red
        return s.getsockname()[0]


if __name__ == "__main__":
    cert, clave = certificado()
    servidor = http.server.ThreadingHTTPServer(("0.0.0.0", PUERTO), partial(SoloApp, directory=str(RAIZ)))
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, clave)
    servidor.socket = ctx.wrap_socket(servidor.socket, server_side=True)
    print(f"Abrir en el celular (misma WiFi): https://{ip_local()}:{PUERTO}/app/")
    print("Aceptar la advertencia del certificado. Ctrl+C para detener.")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
