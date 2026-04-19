#!/usr/bin/env python3
"""Fetch Elferspot pages through Scrapling and emit raw HTML as JSON.

The TypeScript collector expects a stable JSON payload:
  { ok: true, html: "<html>..." }
  { ok: false, error: "..." }

Supports single URL or batch (multiple URLs as arguments).
Batch returns: { ok: true, results: [{ ok, html?, error?, url }...] }
"""

from __future__ import annotations

import io
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor

# Force UTF-8 stdout/stderr on Windows (avoids charmap codec errors)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from scrapling.fetchers.requests import Fetcher


def fetch_html(url: str) -> str:
    try:
        response = Fetcher.get(url, impersonate="chrome", timeout=15, retries=1)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Scrapling fetch failed: {exc}") from exc

    html = getattr(response, "html_content", "") or getattr(response, "body", "") or ""
    if not html:
        raise RuntimeError("Scrapling fetch returned empty HTML")
    return html


def fetch_single(url: str) -> dict[str, object]:
    try:
        html = fetch_html(url)
        return {"ok": True, "html": html}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def main() -> int:
    urls = sys.argv[1:]
    if not urls:
        sys.stderr.write("URL required\n")
        sys.stdout.write(json.dumps({"ok": False, "error": "URL required"}))
        return 1

    try:
        if len(urls) == 1:
            payload = fetch_single(urls[0])
            sys.stdout.write(json.dumps(payload, ensure_ascii=False))
            return 0 if payload["ok"] else 1

        results: list[dict[str, object]] = []
        workers = min(6, len(urls))
        with ProcessPoolExecutor(max_workers=workers) as executor:
            for url, result in zip(urls, executor.map(fetch_single, urls)):
                results.append({**result, "url": url})

        sys.stdout.write(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(str(exc) + "\n")
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
