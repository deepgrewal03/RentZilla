"""Deployment entrypoint for RentZilla.

The deploy build steps export the Expo web app to ``artifacts/mobile/dist``.
This module serves that static build and exposes the top-level ``app`` object
the deployment platform looks for.

It works both as an ASGI application (uvicorn) and as a WSGI application
(gunicorn), using only the Python standard library so no extra packages are
required at deploy time.
"""

from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "artifacts" / "mobile" / "dist"
INDEX = DIST / "index.html"

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/svg+xml", ".svg")

DEFAULT_TYPE = "application/octet-stream"


def _root() -> Path:
    """Directory holding the exported Expo web build."""
    return DIST


def _safe_path(raw_path: str) -> Path | None:
    """Map a URL path to a file inside the build directory, or None."""
    path = raw_path.split("?", 1)[0].split("#", 1)[0]
    relative = path.lstrip("/") or "index.html"
    base = _root()
    candidate = (base / relative).resolve()
    try:
        candidate.relative_to(base.resolve())
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    # Single-page app: unknown extensionless routes fall back to index.html.
    if not Path(relative).suffix:
        index = base / "index.html"
        if index.is_file():
            return index
    return None


def _content_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or DEFAULT_TYPE


def _health_payload() -> bytes:
    return json.dumps({"ok": True, "service": "rentzilla-web"}).encode()


def _not_found_payload() -> bytes:
    return json.dumps({"ok": False, "error": "Not found"}).encode()


def _missing_build_page() -> bytes:
    """Shown if the web export has not been produced yet."""
    return (
        b"<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        b"<title>RentZilla</title></head><body style=\"font-family:system-ui;"
        b"padding:2rem\"><h1>RentZilla</h1><p>The web build is not available yet. "
        b"Run <code>pnpm --filter @workspace/mobile run build:web</code> to "
        b"generate <code>artifacts/mobile/dist</code>.</p></body></html>"
    )


class _App:
    """Callable that adapts to either the WSGI or the ASGI calling convention."""

    def __call__(self, *args):
        if len(args) == 3 and isinstance(args[0], dict) and "type" in args[0]:
            return self._asgi(*args)
        return self._wsgi(*args)

    # --- WSGI ---------------------------------------------------------------
    def _wsgi(self, environ, start_response):
        raw_path = environ.get("PATH_INFO", "/") or "/"
        if raw_path in ("/status", "/health", "/api/healthz"):
            body = _health_payload()
            start_response(
                "200 OK",
                [
                    ("Content-Type", "application/json"),
                    ("Content-Length", str(len(body))),
                ],
            )
            return [body]

        target = _safe_path(raw_path)
        if target is None:
            if raw_path == "/" and not INDEX.is_file():
                body = _missing_build_page()
                start_response(
                    "200 OK",
                    [
                        ("Content-Type", "text/html; charset=utf-8"),
                        ("Content-Length", str(len(body))),
                    ],
                )
                return [body]
            body = _not_found_payload()
            start_response(
                "404 Not Found",
                [
                    ("Content-Type", "application/json"),
                    ("Content-Length", str(len(body))),
                ],
            )
            return [body]

        try:
            body = target.read_bytes()
        except OSError:
            body = _not_found_payload()
            start_response(
                "404 Not Found",
                [
                    ("Content-Type", "application/json"),
                    ("Content-Length", str(len(body))),
                ],
            )
            return [body]

        start_response(
            "200 OK",
            [
                ("Content-Type", _content_type(target)),
                ("Content-Length", str(len(body))),
                ("Cache-Control", "public, max-age=3600"),
            ],
        )
        return [body]

    # --- ASGI ---------------------------------------------------------------
    async def _asgi(self, scope, receive, send):
        if scope.get("type") == "lifespan":
            while True:
                message = await receive()
                if message["type"] == "lifespan.startup":
                    await send({"type": "lifespan.startup.complete"})
                elif message["type"] == "lifespan.shutdown":
                    await send({"type": "lifespan.shutdown.complete"})
                    return
            return

        raw_path = scope.get("path", "/") or "/"
        if raw_path in ("/status", "/health", "/api/healthz"):
            await self._asgi_respond(send, 200, "application/json", _health_payload())
            return

        target = _safe_path(raw_path)
        if target is None:
            if raw_path == "/" and not INDEX.is_file():
                await self._asgi_respond(
                    send, 200, "text/html; charset=utf-8", _missing_build_page()
                )
                return
            await self._asgi_respond(
                send, 404, "application/json", _not_found_payload()
            )
            return

        try:
            body = target.read_bytes()
        except OSError:
            await self._asgi_respond(
                send, 404, "application/json", _not_found_payload()
            )
            return

        await self._asgi_respond(send, 200, _content_type(target), body)

    async def _asgi_respond(self, send, status: int, content_type: str, body: bytes):
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [
                    (b"content-type", content_type.encode()),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


app = _App()
# Common alternative names some deployment platforms look for.
application = app
handler = app


def main() -> None:
    """Run a small development server (used when no WSGI server is present)."""
    from wsgiref.simple_server import make_server

    port = int(os.environ.get("PORT", "8080"))
    with make_server("0.0.0.0", port, app) as server:
        print(f"Serving RentZilla web build on port {port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
