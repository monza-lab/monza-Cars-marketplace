#!/usr/bin/env python3
"""Fetch a Classic.com page through Scrapling and emit parsed JSON."""

from __future__ import annotations

import argparse
import html
import json
import os
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path


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


def run_scrapling_fetch(url: str, html_path: Path, fetch_mode: str) -> None:
    cmd = ["scrapling", "extract", fetch_mode, url, str(html_path)]
    if fetch_mode == "stealthy-fetch":
        cmd.append("--solve-cloudflare")
    if os.environ.get("SCRAPLING_NO_HEADLESS") == "1":
        cmd.append("--no-headless")

    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def fetch_html(url: str) -> str:
    fetch_modes = [os.environ.get("SCRAPLING_FETCH_MODE", "stealthy-fetch"), "fetch"]
    if "dynamic-fetch" not in fetch_modes:
        fetch_modes.append("dynamic-fetch")

    with tempfile.TemporaryDirectory(prefix="classic-scrapling-") as tmp_dir:
        html_path = Path(tmp_dir) / "page.html"
        errors: list[str] = []

        for mode in dict.fromkeys(fetch_modes):
            try:
                run_scrapling_fetch(url, html_path, mode)
                if html_path.exists():
                    return html_path.read_text(encoding="utf-8", errors="replace")
            except subprocess.CalledProcessError as exc:
                stderr = (exc.stderr or "").strip()
                stdout = (exc.stdout or "").strip()
                details = stderr or stdout or f"exit status {exc.returncode}"
                errors.append(f"{mode}: {details}")
                continue

        raise RuntimeError("Scrapling fetch failed: " + " | ".join(errors))


def parse_html(html_text: str) -> dict[str, object]:
    parser = ClassicDetailParser()
    parser.feed(html_text)
    title, body_text, images = parser.finish()
    return {"ok": True, "title": title, "bodyText": body_text, "images": images}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("url", help="Classic.com listing URL")
    args = parser.parse_args()

    try:
        html_text = fetch_html(args.url)
        payload = parse_html(html_text)
        sys.stdout.write(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(str(exc) + "\n")
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
