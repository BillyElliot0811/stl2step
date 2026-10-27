"""Serve this static app locally; no third-party Python packages required."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import threading
import webbrowser


class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".wasm": "application/wasm", ".js": "text/javascript"}

    def end_headers(self):
        # Local development should always use the saved version of the app.
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Run STL to STEP on localhost.")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser automatically")
    parser.add_argument("--port", type=int, default=8000, help="Preferred port; 0 chooses a free port")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("port must be between 0 and 65535")
    root = str(Path(__file__).resolve().parent)
    handler = partial(AppHandler, directory=root)
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError:
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"STL -> STEP: {url}", flush=True)
    print("Keep this window open. Press Ctrl+C to stop.", flush=True)
    timer = threading.Timer(0.4, webbrowser.open, args=(url,))
    timer.daemon = True
    if not args.no_browser:
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

