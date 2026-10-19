#!/usr/bin/env python3
"""Servidor local de Mentarosa.

Uso:  python3 serve.py            → http://localhost:8080
      python3 serve.py 3000       → otro puerto

Imita la configuración de Vercel (vercel.json): /products/<slug> muestra
product.html, /wishlist muestra wishlist.html y /cart muestra cart.html. Además desactiva la caché para ver siempre los últimos cambios.
"""
import http.server, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def translate_path(self, path):
        clean = path.split('?', 1)[0].split('#', 1)[0]
        if re.fullmatch(r'/products/[^/]+/?', clean):
            return os.path.join(ROOT, 'product.html')
        if clean in ('/wishlist', '/cart'):
            return os.path.join(ROOT, clean[1:] + '.html')
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
        print(f'Mentarosa en http://localhost:{PORT}  (Ctrl+C para salir)')
        httpd.serve_forever()
