#!/usr/bin/env python3
"""Fetch BeForward pages through Scrapling StealthyFetcher.

Returns raw HTML for TypeScript cheerio parsers to handle.
Does NOT parse — just fetches and bypasses AWS WAF.

Usage:
  python3.11 beforward_scrapling_fetch.py <url>
  python3.11 beforward_scrapling_fetch.py <url1> <url2> ...

Output (JSON on stdout):
  Single:   {"ok": true, "html": "...", "url": "..."}
  Multiple: {"ok": true, "results": [{"ok": true, "html": "...", "url": "..."}, ...]}
  Error:    {"ok": false, "error": "...", "url": "..."}
"""
from __future__ import annotations

import io
import json
import os
import sys

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from scrapling.fetchers import StealthyFetcher


# ── WAF Detection ────────────────────────────────────────────────────

WAF_BLOCK_MARKERS = [
    "awswafcoo",
    "awswaf",
    "access denied",
    "captcha",
    "_challenge",
    "security service to protect",
]


def _is_waf_blocked(html: str) -> bool:
    """Detect AWS WAF challenge pages (typically ~2KB JS challenge)."""
    if len(html) > 10_000:
        return False
    lower = html.lower()
    return any(marker in lower for marker in WAF_BLOCK_MARKERS)


# ── Proxy ────────────────────────────────────────────────────────────

def _get_proxy_config() -> dict | None:
    """Build Playwright proxy dict from BF_PROXY_URL env var."""
    proxy_url = os.environ.get("BF_PROXY_URL", "").strip()
    if not proxy_url:
        return None

    from urllib.parse import urlparse
    parsed = urlparse(proxy_url)
    config: dict = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
    if parsed.username:
        config["username"] = parsed.username
    if parsed.password:
        config["password"] = parsed.password
    sys.stderr.write(f"[bf-scrapling] Using proxy: {parsed.hostname}:{parsed.port}\n")
    return config


# ── HTML Extraction ──────────────────────────────────────────────────

def _get_html_source(page) -> str:
    """Extract raw HTML string from a Scrapling Adaptor.

    Tries public API methods first, then falls back to private internals.
    The Scrapling API may vary between versions, so we try multiple approaches.
    """
    # Approach 1: Public properties (preferred — stable across versions)
    for attr in ('html_content', 'html', 'body'):
        val = getattr(page, attr, None)
        if val and isinstance(val, str) and len(val) > 100:
            return val

    # Approach 2: str() or prettify() (common in scraping libraries)
    for method_name in ('prettify',):
        method = getattr(page, method_name, None)
        if callable(method):
            try:
                result = method()
                if result and isinstance(result, str) and len(result) > 100:
                    return result
            except Exception:
                pass

    # Approach 3: Private attribute (Scrapling stores original HTML here)
    raw = getattr(page, '_Adaptor__text', None)
    if raw and isinstance(raw, str) and len(raw) > 100:
        return raw

    # Approach 4: selectolax element's .html property
    elem = getattr(page, '_Adaptor__element', None)
    if elem:
        h = getattr(elem, 'html', None)
        if h and isinstance(h, str):
            return h

    return ""


# ── Fetch ────────────────────────────────────────────────────────────

def fetch_html(url: str) -> dict:
    """Fetch a single URL and return raw HTML."""
    try:
        proxy = _get_proxy_config()
        kwargs: dict = {"headless": True, "network_idle": True, "timeout": 30000}
        if proxy:
            kwargs["proxy"] = proxy
        page = StealthyFetcher.fetch(url, **kwargs)
        html = _get_html_source(page)

        if not html:
            return {"ok": False, "error": "empty_html", "url": url, "htmlSize": 0}

        if _is_waf_blocked(html):
            return {"ok": False, "error": "waf_blocked", "url": url, "htmlSize": len(html)}

        return {"ok": True, "html": html, "url": url}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}


# ── CLI ──────────────────────────────────────────────────────────────

def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: beforward_scrapling_fetch.py <url> [<url>...]\n")
        sys.stdout.write(json.dumps({"ok": False, "error": "URL required"}))
        return 1

    urls = sys.argv[1:]

    if len(urls) == 1:
        result = fetch_html(urls[0])
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        return 0 if result["ok"] else 1

    results = []
    for u in urls:
        try:
            results.append(fetch_html(u))
        except Exception as exc:
            results.append({"ok": False, "error": str(exc), "url": u})

    all_ok = all(r["ok"] for r in results)
    sys.stdout.write(json.dumps({"ok": all_ok, "results": results}, ensure_ascii=False))
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
