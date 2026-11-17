import mimetypes
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".mjs")


class FieldnoteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND, "Fieldnote performs image analysis on this device.")
            return
        if path != "/" and Path(path).suffix.lower() not in {
            ".html", ".css", ".js", ".mjs", ".wasm", ".onnx", ".webmanifest",
            ".png", ".jpg", ".jpeg", ".webp", ".ico", ".svg"
        }:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def do_POST(self):
        self.send_error(
            HTTPStatus.NOT_FOUND,
            "Photo diagnosis is performed in the browser; server uploads are disabled."
        )


def main():
    host = os.environ.get("FIELDNOTE_HOST", "127.0.0.1")
    port = int(os.environ.get("FIELDNOTE_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), FieldnoteHandler)
    print(f"Fieldnote local preview ready at http://{host}:{port}/")
    print("Photo analysis runs on-device in the browser.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Fieldnote preview.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
