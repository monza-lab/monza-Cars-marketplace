#!/usr/bin/env python3
"""Fetch Classic.com pages through Scrapling and emit parsed JSON.

The TypeScript collector expects a stable JSON payload:
{ ok: true, title, bodyText, images }

This script uses Scrapling's Python fetcher directly so we can keep the Node
side thin and avoid depending on the CLI entrypoint.
"""

from __future__ import annotations

import html
import io
import json
import os
import sys
from html.parser import HTMLParser
from concurrent.futures import ProcessPoolExecutor

# Force UTF-8 stdout/stderr on Windows (avoids charmap codec errors)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from scrapling.fetchers.requests import Fetcher


BLOCK_TAGS = {
    "article",
    "aside",
    "div",
    "footer",
    "header",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "main",
    "nav",
    "p",
    "section",
    "table",
    "tbody",
    "td",
    "th",
    "tr",
    "ul",
    "ol",
}


class ClassicDetailParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._in_body = False
        self._in_title = False
        self._in_h1 = False
        self._skip_depth = 0
        self._title_parts: list[str] = []
        self._h1_parts: list[str] = []
        self._body_parts: list[str] = []
        self._images: list[str] = []
        self._seen_images: set[str] = set()

    def _append_newline(self) -> None:
        if not self._body_parts:
            return
        if self._body_parts[-1] != "\n":
            self._body_parts.append("\n")

    def _append_text(self, text: str) -> None:
        cleaned = html.unescape(text).replace("\r", " ")
        cleaned = " ".join(cleaned.split())
        if not cleaned:
            return
        if self._body_parts and self._body_parts[-1] not in {"\n", " "}:
            self._body_parts.append(" ")
        self._body_parts.append(cleaned)

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "noscript"}:
            self._skip_depth += 1
            return

        if tag == "body":
            self._in_body = True
        elif tag == "title":
            self._in_title = True
        elif tag == "h1":
            self._in_h1 = True

        if tag in {"br", "hr"}:
            self._append_newline()
        elif tag in BLOCK_TAGS:
            self._append_newline()

        attr_map = dict(attrs)
        if tag == "img":
            src = attr_map.get("src")
            if src and "images.classic.com/vehicles/" in src and src not in self._seen_images:
                self._seen_images.add(src)
                self._images.append(src)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"}:
            if self._skip_depth > 0:
                self._skip_depth -= 1
            return

        if tag == "body":
            self._in_body = False
        elif tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False

        if tag in BLOCK_TAGS:
            self._append_newline()

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return

        if self._in_title:
            self._title_parts.append(data)
        if self._in_h1:
            self._h1_parts.append(data)
        if self._in_body:
            self._append_text(data)

    def finish(self) -> tuple[str, str, list[str]]:
        title = " ".join(" ".join(self._h1_parts or self._title_parts).split()).strip()
        body_text = "".join(self._body_parts)
        body_text = body_text.replace("\r", "\n")
        body_text = "\n".join(line.strip() for line in body_text.split("\n"))
        body_text = "\n".join(line for line in body_text.split("\n") if line)
        body_text = body_text.strip()
        return title, body_text, self._images


def fetch_html(url: str) -> str:
    try:
        # Scrapling treats `retries` as the number of attempts. Zero means
        # "do not enter the request loop", which falls through to
        # "No active session available." Use at least one attempt.
        response = Fetcher.get(url, impersonate="chrome", timeout=10, retries=1)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Scrapling fetch failed: {exc}") from exc

    html = getattr(response, "html_content", "") or getattr(response, "body", "") or ""
    if not html:
        raise RuntimeError("Scrapling fetch returned empty HTML")
    return html


def parse_html(html_text: str) -> dict[str, object]:
    parser = ClassicDetailParser()
    parser.feed(html_text)
    title, body_text, images = parser.finish()
    return {
        "ok": True,
        "title": title,
        "bodyText": body_text,
        "images": images,
    }


def parse_single_url(url: str) -> dict[str, object]:
    html_text = fetch_html(url)
    return parse_html(html_text)


def main() -> int:
    urls = sys.argv[1:]
    if not urls:
      sys.stderr.write("Classic.com URL required\n")
      sys.stdout.write(json.dumps({"ok": False, "error": "Classic.com URL required"}))
      return 1

    try:
        if len(urls) == 1:
            payload = parse_single_url(urls[0])
            sys.stdout.write(json.dumps(payload, ensure_ascii=False))
            return 0

        results: list[dict[str, object]] = []
        workers = min(6, len(urls))
        with ProcessPoolExecutor(max_workers=workers) as executor:
            for url, parsed in zip(urls, executor.map(_parse_single_url_safe, urls)):
                if parsed["ok"]:
                    results.append({**parsed, "url": url})
                else:
                    results.append({"ok": False, "error": parsed["error"], "url": url})

        sys.stdout.write(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(str(exc) + "\n")
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


def _parse_single_url_safe(url: str) -> dict[str, object]:
    try:
        return parse_single_url(url)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


if __name__ == "__main__":
    raise SystemExit(main())
