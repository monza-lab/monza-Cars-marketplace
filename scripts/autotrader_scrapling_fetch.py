#!/usr/bin/env python3
"""Fetch AutoTrader UK pages through Scrapling StealthyFetcher.

Modes:
  search <url> [<url> ...]  — fetch search page(s), extract listing cards
  detail <url> [<url> ...]  — fetch detail page(s), extract vehicle specs

Uses StealthyFetcher (headless browser) to bypass Cloudflare.
The TypeScript wrapper expects JSON on stdout.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from scrapling.fetchers import StealthyFetcher


# ── Fetch ──────────────────────────────────────────────────────────────

CF_BLOCK_MARKERS = [
    "security service to protect",
    "just a moment",
    "checking your browser",
    "verify you are human",
    "enable javascript and cookies",
    "attention required",
    "cloudflare",
]


def _is_cf_blocked(page) -> bool:
    """Detect Cloudflare challenge/block pages."""
    text = _get_text(page).lower()
    return any(m in text for m in CF_BLOCK_MARKERS) and len(text) < 2000


def fetch_page(url: str, timeout_ms: int = 30000):
    """Fetch a fully-rendered page using StealthyFetcher."""
    StealthyFetcher.adaptive = True
    return StealthyFetcher.fetch(url, headless=True, network_idle=True, timeout=timeout_ms)


# ── Search Mode ────────────────────────────────────────────────────────

def parse_search(url: str) -> dict:
    page = fetch_page(url, timeout_ms=30000)

    if _is_cf_blocked(page):
        return {"ok": False, "mode": "search", "error": "cloudflare_blocked", "url": url}

    listings = []

    # AutoTrader search results: each listing card has links to /car-details/<id>
    for card in page.css("a[href*='/car-details/']"):
        href = _get_attr(card, "href", "")
        advert_match = re.search(r"/car-details/(\d+)", href)
        if not advert_match:
            continue

        advert_id = advert_match.group(1)

        # Try to get text content from the card's parent context
        parent = card
        title_text = ""
        price_text = ""

        # Walk up to find the listing card container
        for _ in range(5):
            p = getattr(parent, "parent", None)
            if p is None:
                break
            parent = p
            text = _get_text(parent)
            if len(text) > 50:
                title_text = text
                break

        # Extract title from the link text or nearby heading
        link_text = _get_text(card).strip()
        if link_text and len(link_text) > 5:
            title_text = link_text

        # Extract price from nearby elements
        price_el = None
        try:
            price_el = parent.css("[class*='price'], [data-testid*='price']")
        except Exception:
            pass
        if price_el:
            for pel in price_el:
                pt = _get_text(pel).strip()
                if pt and "\u00a3" in pt:
                    price_text = pt
                    break

        listing = {
            "advertId": advert_id,
            "title": _clean_text(title_text) or f"Porsche (AutoTrader {advert_id})",
            "priceText": price_text or None,
            "price": _parse_price(price_text),
            "url": f"https://www.autotrader.co.uk/car-details/{advert_id}",
        }
        listings.append(listing)

    # Deduplicate by advertId
    seen = set()
    unique = []
    for lst in listings:
        if lst["advertId"] not in seen:
            seen.add(lst["advertId"])
            unique.append(lst)

    # Try to get total results count from page text
    total_results = None
    for el in page.css("h1, [data-testid*='results-count'], [class*='results']"):
        text = _get_text(el)
        m = re.search(r"([\d,]+)\s+(?:results?|cars?|Porsche)", text, re.IGNORECASE)
        if m:
            total_results = int(m.group(1).replace(",", ""))
            break

    return {
        "ok": True,
        "mode": "search",
        "listings": unique,
        "totalResults": total_results,
        "url": url,
    }


# ── Detail Mode ────────────────────────────────────────────────────────

def parse_detail(url: str) -> dict:
    page = fetch_page(url, timeout_ms=30000)

    if _is_cf_blocked(page):
        return {"ok": False, "mode": "detail", "error": "cloudflare_blocked", "url": url}

    body_text = _get_text(page)

    vehicle: dict = {
        "title": None, "price": None, "priceText": None,
        "mileage": None, "mileageUnit": None,
        "location": None, "description": None,
        "images": [], "vin": None,
        "exteriorColor": None, "interiorColor": None,
        "transmission": None, "engine": None, "bodyStyle": None,
    }

    # Title
    for sel in ["h1", "[data-testid='vehicle-title']", "[class*='title']"]:
        for el in page.css(sel):
            t = _clean_text(_get_text(el))
            if t and len(t) > 3:
                vehicle["title"] = t
                break
        if vehicle["title"]:
            break

    # Price
    for sel in ["[data-testid='price']", "[class*='price']"]:
        for el in page.css(sel):
            t = _clean_text(_get_text(el))
            if t and "\u00a3" in t:
                vehicle["priceText"] = t
                vehicle["price"] = _parse_price(t)
                break
        if vehicle["price"]:
            break

    # Key specs — look for spec items in the overview section
    specs = _extract_specs(page, body_text)
    vehicle["mileage"] = specs.get("mileage")
    vehicle["mileageUnit"] = specs.get("mileageUnit", "miles")
    vehicle["transmission"] = specs.get("transmission")
    vehicle["engine"] = specs.get("engine")
    vehicle["bodyStyle"] = specs.get("bodyStyle")
    vehicle["exteriorColor"] = specs.get("exteriorColor")

    # Location
    for sel in ["[data-testid*='location']", "[class*='location']"]:
        for el in page.css(sel):
            t = _clean_text(_get_text(el))
            if t and len(t) > 2:
                vehicle["location"] = t
                break
        if vehicle["location"]:
            break

    # Description
    for sel in ["[data-testid*='description']", "[class*='description']", "section p"]:
        for el in page.css(sel):
            t = _clean_text(_get_text(el))
            if t and len(t) > 30:
                vehicle["description"] = t[:2000]
                break
        if vehicle["description"]:
            break

    # VIN
    vin_match = re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", body_text)
    if vin_match:
        vehicle["vin"] = vin_match.group(0).upper()

    # Images
    images = []
    for node in page.css("img"):
        src = _get_attr(node, "src") or _get_attr(node, "data-src") or ""
        if "atcdn.co.uk" in src:
            images.append(_normalize_image_url(src))
    vehicle["images"] = list(dict.fromkeys(images))[:30]  # dedupe, cap at 30

    return {"ok": True, "mode": "detail", "vehicle": vehicle, "url": url}


def _extract_specs(page, body_text: str) -> dict:
    """Extract key vehicle specs from the page."""
    specs: dict = {}

    # Strategy 1: Look for spec items in key-specs section
    for el in page.css("[data-testid*='spec'], [class*='spec'] li, [class*='key-spec']"):
        text = _clean_text(_get_text(el))
        if not text:
            continue
        _match_spec(text, specs)

    # Strategy 2: Regex on body text for common patterns
    if not specs.get("mileage"):
        m = re.search(r"([\d,]+)\s*(miles?|km|kilometres?)\b", body_text, re.I)
        if m:
            specs["mileage"] = int(m.group(1).replace(",", ""))
            specs["mileageUnit"] = "km" if "km" in m.group(2).lower() else "miles"

    if not specs.get("transmission"):
        m = re.search(r"\b(Automatic|Manual|Semi-Automatic|PDK|Tiptronic|DSG|CVT)\b", body_text, re.I)
        if m:
            specs["transmission"] = m.group(1)

    if not specs.get("engine"):
        m = re.search(r"\b(\d(?:\.\d)?\s?[Ll](?:itre)?)\b", body_text)
        if m:
            specs["engine"] = m.group(1)

    if not specs.get("bodyStyle"):
        m = re.search(r"\b(Coupe|Convertible|SUV|Estate|Saloon|Hatchback|Cabriolet|Targa|Roadster)\b", body_text, re.I)
        if m:
            specs["bodyStyle"] = m.group(1)

    if not specs.get("exteriorColor"):
        m = re.search(r"(?:body|exterior)\s+colou?r\s*\n?\s*([A-Za-z][A-Za-z\s-]{1,30})", body_text, re.I)
        if m:
            # Clean up: take only the color name, strip trailing context
            color = m.group(1).strip()
            color = re.split(r"\n|View all", color)[0].strip()
            if color:
                specs["exteriorColor"] = color

    return specs


def _match_spec(text: str, specs: dict):
    """Match a spec text like '20,000 miles' or 'Automatic' to a field."""
    lower = text.lower()
    m = re.search(r"([\d,]+)\s*(miles?|km)", lower)
    if m and not specs.get("mileage"):
        specs["mileage"] = int(m.group(1).replace(",", ""))
        specs["mileageUnit"] = "km" if "km" in m.group(2) else "miles"
        return
    if re.search(r"\b(automatic|manual|semi-auto|pdk|tiptronic)\b", lower) and not specs.get("transmission"):
        specs["transmission"] = text.strip()
        return
    m = re.search(r"\b(\d\.\d\s?l)", lower)
    if m and not specs.get("engine"):
        specs["engine"] = text.strip()
        return


# ── Helpers ────────────────────────────────────────────────────────────

def _get_attr(el, name: str, default: str = "") -> str:
    """Safely get an attribute from a Scrapling element."""
    # Scrapling Selector uses .attrib (AttributesHandler with .get())
    attrib = getattr(el, "attrib", None)
    if attrib is not None:
        try:
            val = attrib.get(name, default)
            return val if isinstance(val, str) else default
        except Exception:
            pass
    return default


def _get_text(el) -> str:
    """Safely get text from a Scrapling element."""
    # Try get_all_text() first (Scrapling Selector method)
    gat = getattr(el, "get_all_text", None)
    if callable(gat):
        try:
            result = gat()
            if result and isinstance(result, str):
                return result
        except Exception:
            pass
    # Try .text property
    text = getattr(el, "text", None)
    if text and isinstance(text, str):
        return text
    # Try .text_content()
    tc = getattr(el, "text_content", None)
    if callable(tc):
        try:
            return tc() or ""
        except Exception:
            pass
    return ""


def _clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _parse_price(text: str) -> int | None:
    if not text:
        return None
    cleaned = re.sub(r"[^0-9]", "", text)
    try:
        n = int(cleaned)
        return n if n > 0 else None
    except ValueError:
        return None


def _normalize_image_url(url: str) -> str:
    """Upgrade AutoTrader image URLs to higher resolution."""
    url = re.sub(r"\?.*$", "", url)  # strip query params
    return url


# ── CLI ────────────────────────────────────────────────────────────────

def _safe_parse(fn, url: str) -> dict:
    try:
        return fn(url)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}


def main() -> int:
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: autotrader_scrapling_fetch.py <search|detail> <url> [<url>...]\n")
        sys.stdout.write(json.dumps({"ok": False, "error": "Mode and URL required"}))
        return 1

    mode = sys.argv[1]
    urls = sys.argv[2:]

    if mode not in ("search", "detail"):
        sys.stderr.write(f"Unknown mode: {mode}\n")
        sys.stdout.write(json.dumps({"ok": False, "error": f"Unknown mode: {mode}"}))
        return 1

    parse_fn = parse_search if mode == "search" else parse_detail
    safe_fn = lambda url: _safe_parse(parse_fn, url)

    try:
        if len(urls) == 1:
            payload = parse_fn(urls[0])
            sys.stdout.write(json.dumps(payload, ensure_ascii=False))
            return 0

        results = [safe_fn(u) for u in urls]
        sys.stdout.write(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
        return 0
    except Exception as exc:
        sys.stderr.write(str(exc) + "\n")
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
