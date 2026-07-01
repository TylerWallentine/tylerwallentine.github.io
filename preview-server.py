"""
Local preview server with caching DISABLED.

Python's plain `http.server` lets the browser cache files (CSS/JS), so edits
sometimes don't show up on reload. This subclass sends no-cache headers on
every response so the browser always fetches the latest files.

Used by preview.bat. Not part of the live site.
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


# Static assets (images/fonts/media) are allowed to cache so they don't
# re-download on every page load during preview. Code files (HTML/CSS/JS)
# stay no-cache so edits always show up on reload.
CACHEABLE_EXT = (
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp4", ".webm", ".mp3",
)


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split("?", 1)[0].lower()
        if path.endswith(CACHEABLE_EXT):
            # Cache static assets for a day (revalidated after).
            self.send_header("Cache-Control", "public, max-age=86400")
        else:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving with no-cache at http://localhost:{port}/  (Ctrl+C to stop)")
    HTTPServer(("", port), NoCacheHandler).serve_forever()
