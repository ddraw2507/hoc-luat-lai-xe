"""Server tĩnh cho lúc phát triển: phục vụ thư mục app/ với Cache-Control: no-store (để luôn thấy code/dữ liệu mới).

Dùng: python tools/app/devserver.py [port]   (mặc định 8765)
"""
import functools
import http.server
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent.parent / "app"


class NoStore(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".webmanifest": "application/manifest+json", ".webp": "image/webp", ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(NoStore, directory=str(APP))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as srv:
        print(f"Phục vụ {APP} tại http://localhost:{port}")
        srv.serve_forever()
