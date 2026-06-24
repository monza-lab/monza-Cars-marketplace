#!/usr/bin/env python3
"""Fetch multiple BeForward pages through ONE persistent StealthySession.

beforward.jp is behind AWS WAF. Each fresh StealthyFetcher.fetch() opens a new
browser context, so the WAF JS-challenge is re-triggered every time and only a
fraction solve before the datacenter IP gets throttled. Reusing a SINGLE session
lets the challenge be solved once and the resulting `aws-waf-token` cookie be
reused for the rest of the batch — far higher yield from GitHub Actions IPs,
with no paid proxy.

Usage:
  printf '%s\\n' url1 url2 | python beforward_session_fetch.py
  python beforward_session_fetch.py url1 url2 ...

Output (JSON Lines on stdout, one object per URL, in input order):
  {"url": "...", "ok": true,  "html": "..."}
  {"url": "...", "ok": false, "error": "waf_blocked", "htmlSize": 1950}

Env:
  BF_PROXY_URL  optional proxy (http://user:pass@host:port)
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

from scrapling.fetchers import StealthySession


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


def _get_proxy_config():
    proxy_url = os.environ.get("BF_PROXY_URL", "").strip()
    if not proxy_url:
        return None
    from urllib.parse import urlparse
    parsed = urlparse(proxy_url)
    config = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
    if parsed.username:
        config["username"] = parsed.username
    if parsed.password:
        config["password"] = parsed.password
    return config


def _get_html_source(page) -> str:
    """Extract raw HTML string from a Scrapling Adaptor (version-tolerant)."""
    for attr in ("html_content", "html", "body"):
        val = getattr(page, attr, None)
        if val and isinstance(val, str) and len(val) > 100:
            return val
    method = getattr(page, "prettify", None)
    if callable(method):
        try:
            result = method()
            if result and isinstance(result, str) and len(result) > 100:
                return result
        except Exception:
            pass
    raw = getattr(page, "_Adaptor__text", None)
    if raw and isinstance(raw, str) and len(raw) > 100:
        return raw
    elem = getattr(page, "_Adaptor__element", None)
    if elem:
        h = getattr(elem, "html", None)
        if h and isinstance(h, str):
            return h
    return ""


def _emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    urls = sys.argv[1:]
    if not urls:
        urls = [line.strip() for line in sys.stdin if line.strip()]
    if not urls:
        _emit({"ok": False, "error": "no urls"})
        return 1

    kwargs: dict = {
        "headless": True,
        "network_idle": True,
        "timeout": 30000,
        "max_pages": 1,        # one page → sequential reuse of the WAF cookie
        "retries": 2,          # session-level retry on transient failures
    }
    proxy = _get_proxy_config()
    if proxy:
        kwargs["proxy"] = proxy
        sys.stderr.write(f"[bf-session] using proxy {proxy.get('server')}\n")

    session = StealthySession(**kwargs)
    session.start()
    try:
        for url in urls:
            try:
                page = session.fetch(url)
                html = _get_html_source(page)
                if not html:
                    _emit({"url": url, "ok": False, "error": "empty_html", "htmlSize": 0})
                elif _is_waf_blocked(html):
                    _emit({"url": url, "ok": False, "error": "waf_blocked", "htmlSize": len(html)})
                else:
                    _emit({"url": url, "ok": True, "html": html})
            except Exception as exc:  # noqa: BLE001 — report per-URL, keep batch alive
                _emit({"url": url, "ok": False, "error": str(exc)[:200]})
    finally:
        try:
            session.close()
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
