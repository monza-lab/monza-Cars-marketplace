#!/usr/bin/env python3
"""Fetch AutoScout24 pages through Scrapling and emit parsed JSON.

Modes:
  search <url> [<url> ...]   — fetch search page(s), extract listings from __NEXT_DATA__
  detail <url> [<url> ...]   — fetch detail page(s), extract vehicle specs

The TypeScript wrapper expects JSON on stdout.
"""

from __future__ import annotations

import io
import json
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor

# Force UTF-8 stdout/stderr on Windows (avoids charmap codec errors)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from scrapling.fetchers.requests import Fetcher


# ── Fetch ──────────────────────────────────────────────────────────────

def fetch_html(url: str, timeout: int = 15) -> str:
    try:
        response = Fetcher.get(url, impersonate="chrome", timeout=timeout, retries=1)
    except Exception as exc:
        raise RuntimeError(f"Scrapling fetch failed: {exc}") from exc

    text = getattr(response, "html_content", "") or getattr(response, "body", "") or ""
    if not text:
        raise RuntimeError("Scrapling fetch returned empty HTML")
    return text


# ── __NEXT_DATA__ Extraction ──────────────────────────────────────────

def extract_next_data(html_text: str) -> dict | None:
    match = re.search(
        r'<script\s+id="__NEXT_DATA__"[^>]*>\s*(.*?)\s*</script>',
        html_text,
        re.DOTALL,
    )
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


# ── Search Mode ───────────────────────────────────────────────────────

def parse_search(url: str) -> dict:
    raw_html = fetch_html(url, timeout=15)
    next_data = extract_next_data(raw_html)
    if not next_data:
        return {"ok": False, "error": "No __NEXT_DATA__ found", "url": url}

    page_props = next_data.get("props", {}).get("pageProps", {})
    raw_listings = page_props.get("listings", [])
    total_results = page_props.get("numberOfResults")
    total_pages = page_props.get("numberOfPages")

    listings = []
    for raw in raw_listings:
        listing = _map_listing(raw)
        if listing:
            listings.append(listing)

    return {
        "ok": True,
        "mode": "search",
        "listings": listings,
        "totalResults": total_results if isinstance(total_results, int) else None,
        "totalPages": total_pages if isinstance(total_pages, int) else None,
        "url": url,
    }


def _map_listing(raw: dict) -> dict | None:
    """Replicates discover.ts mapNextDataListing() — outputs flat AS24ListingSummary fields."""
    listing_id = raw.get("id")
    if not listing_id:
        return None

    # URL
    rel_url = raw.get("url", "")
    if rel_url:
        url = rel_url if rel_url.startswith("http") else f"https://www.autoscout24.com{rel_url}"
    else:
        url = f"https://www.autoscout24.com/offers/{listing_id}"

    id_match = re.search(r"/offers/([^?#]+)", url)
    final_id = id_match.group(1) if id_match else str(listing_id)

    # Vehicle
    v = raw.get("vehicle") or {}
    make = v.get("make", "Porsche")
    model = v.get("model") or v.get("modelGroup")
    variant = v.get("variant")
    version = v.get("modelVersionInput")

    # Title (same logic as discover.ts buildTitle)
    parts = [make]
    if model:
        parts.append(model)
    if version:
        parts.append(version)
    elif variant and variant != f"{make} {model}":
        parts.append(variant)
    title = " ".join(parts)

    # Price — prefer tracking.price (clean number) over priceFormatted
    tracking = raw.get("tracking") or {}
    tracking_price = _safe_int(tracking.get("price"))
    formatted_price = _parse_price((raw.get("price") or {}).get("priceFormatted", ""))
    price = tracking_price or formatted_price

    # Currency from formatted price
    price_formatted = (raw.get("price") or {}).get("priceFormatted", "")
    currency = _detect_currency(price_formatted) or "EUR"

    # Mileage — prefer tracking.mileage
    tracking_mileage = _safe_int(tracking.get("mileage"))
    vehicle_mileage = _parse_number(v.get("mileageInKm", ""))
    mileage_km = tracking_mileage or vehicle_mileage

    # Year from firstRegistration
    first_reg = tracking.get("firstRegistration")
    year = _parse_year_from_reg(first_reg) or _parse_year_from_title(title)

    # Location (flat string, matching AS24ListingSummary.location)
    loc = raw.get("location") or {}
    loc_parts = [loc.get("city"), loc.get("zip")]
    location = ", ".join(str(p) for p in loc_parts if p) or None
    country = loc.get("countryCode")

    # Images — upgrade resolution from 250x188 to 720x540
    images = [
        img.replace("/250x188.webp", "/720x540.webp")
        for img in (raw.get("images") or [])
    ]

    # Transmission, power, fuel, seller
    transmission = v.get("transmission") or _find_detail(raw.get("vehicleDetails"), "Gear")
    power = _find_detail(raw.get("vehicleDetails"), "Power")
    fuel_type = v.get("fuel")
    seller_type = (raw.get("seller") or {}).get("type")

    return {
        "id": final_id,
        "url": url,
        "title": title,
        "price": price,
        "currency": currency,
        "mileageKm": mileage_km,
        "year": year,
        "make": make,
        "model": model,
        "fuelType": fuel_type,
        "transmission": transmission,
        "power": power,
        "location": location,
        "country": country,
        "sellerType": seller_type,
        "images": images,
        "firstRegistration": first_reg,
    }


# ── Detail Mode ───────────────────────────────────────────────────────

def parse_detail(url: str) -> dict:
    raw_html = fetch_html(url, timeout=10)
    vehicle: dict = {
        "trim": None, "vin": None, "transmission": None,
        "bodyStyle": None, "engine": None,
        "colorExterior": None, "colorInterior": None,
        "description": None, "images": [], "features": [],
    }

    next_data = extract_next_data(raw_html)
    if next_data:
        page_props = next_data.get("props", {}).get("pageProps", {})
        _extract_detail_from_next_data(page_props, vehicle)

    # Fallback: JSON-LD structured data
    _extract_from_json_ld(raw_html, vehicle)

    return {"ok": True, "mode": "detail", "vehicle": vehicle, "url": url}


def _extract_detail_from_next_data(page_props: dict, vehicle: dict) -> None:
    """Extract vehicle details from __NEXT_DATA__ pageProps on detail pages."""
    listing = (
        page_props.get("listingDetails")
        or page_props.get("listing")
        or page_props.get("pageData", {}).get("listingDetails")
        or {}
    )

    v = listing.get("vehicle") or {}
    tracking = listing.get("tracking") or {}

    if not vehicle["trim"]:
        vehicle["trim"] = v.get("modelVersionInput") or v.get("variant") or tracking.get("variant")
    if not vehicle["vin"]:
        vehicle["vin"] = listing.get("vin") or v.get("vin")
    if not vehicle["transmission"]:
        vehicle["transmission"] = v.get("transmission") or _find_detail(listing.get("vehicleDetails"), "Gear")
    if not vehicle["bodyStyle"]:
        vehicle["bodyStyle"] = v.get("bodyType") or v.get("bodyStyle")
    if not vehicle["engine"]:
        engine = v.get("rawPowerInKw") or _find_detail(listing.get("vehicleDetails"), "Power")
        if engine:
            vehicle["engine"] = str(engine)
    if not vehicle["colorExterior"]:
        vehicle["colorExterior"] = v.get("bodyColor") or v.get("bodyColorOriginal")
    if not vehicle["colorInterior"]:
        vehicle["colorInterior"] = v.get("upholsteryColor")
    if not vehicle["description"]:
        vehicle["description"] = listing.get("description") or listing.get("sellerNotes")

    # Images
    imgs = listing.get("images") or []
    if imgs and not vehicle["images"]:
        vehicle["images"] = [
            img.replace("/250x188.webp", "/720x540.webp")
            for img in imgs if isinstance(img, str)
        ]

    # Features/equipment
    equipment = listing.get("equipment") or listing.get("features") or []
    if equipment and not vehicle["features"]:
        vehicle["features"] = [str(e) for e in equipment if e]


def _extract_from_json_ld(raw_html: str, vehicle: dict) -> None:
    """Fallback: extract from JSON-LD structured data."""
    for match in re.finditer(
        r'<script\s+type="application/ld\+json"[^>]*>\s*(.*?)\s*</script>',
        raw_html, re.DOTALL,
    ):
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        schema_type = data.get("@type", "")
        if schema_type not in ("Car", "Vehicle", "Product"):
            continue

        if not vehicle["vin"]:
            vehicle["vin"] = data.get("vehicleIdentificationNumber")
        if not vehicle["bodyStyle"]:
            vehicle["bodyStyle"] = data.get("bodyType")
        if not vehicle["engine"]:
            eng = data.get("vehicleEngine")
            if isinstance(eng, dict):
                vehicle["engine"] = eng.get("engineDisplacement") or eng.get("name")
            elif isinstance(eng, str):
                vehicle["engine"] = eng
        if not vehicle["colorExterior"]:
            vehicle["colorExterior"] = data.get("color")
        if not vehicle["transmission"]:
            trans = data.get("vehicleTransmission")
            if trans:
                vehicle["transmission"] = str(trans)
        if not vehicle["description"]:
            vehicle["description"] = data.get("description")
        if not vehicle["images"] and data.get("image"):
            imgs = data["image"]
            if isinstance(imgs, str):
                vehicle["images"] = [imgs]
            elif isinstance(imgs, list):
                vehicle["images"] = [str(i) for i in imgs if i]


# ── Helpers ───────────────────────────────────────────────────────────

def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        n = int(val)
        return n if n > 0 else None
    except (ValueError, TypeError):
        return None

def _parse_price(text: str) -> int | None:
    if not text:
        return None
    cleaned = re.sub(r"[^0-9]", "", text)
    try:
        n = int(cleaned)
        return n if n > 0 else None
    except ValueError:
        return None

def _parse_number(text: str) -> int | None:
    if not text:
        return None
    cleaned = re.sub(r"[^0-9]", "", str(text))
    try:
        n = int(cleaned)
        return n if n > 0 else None
    except ValueError:
        return None

def _detect_currency(text: str) -> str | None:
    if not text:
        return None
    if "CHF" in text or "Fr." in text:
        return "CHF"
    if "£" in text or "GBP" in text:
        return "GBP"
    if "$" in text or "USD" in text:
        return "USD"
    if "€" in text or "EUR" in text:
        return "EUR"
    return "EUR"

def _parse_year_from_reg(text) -> int | None:
    if not text:
        return None
    m = re.search(r"(?:\d{2}[/-])?((?:19|20)\d{2})", str(text))
    return int(m.group(1)) if m else None

def _parse_year_from_title(title: str) -> int | None:
    m = re.search(r"\b(19\d{2}|20\d{2})\b", title)
    return int(m.group(1)) if m else None

def _find_detail(details, label: str) -> str | None:
    if not details or not isinstance(details, list):
        return None
    for d in details:
        if isinstance(d, dict) and d.get("ariaLabel") == label:
            return d.get("data")
    return None


# ── Batch & CLI ───────────────────────────────────────────────────────

def _parse_search_safe(url: str) -> dict:
    try:
        return parse_search(url)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}

def _parse_detail_safe(url: str) -> dict:
    try:
        return parse_detail(url)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}


def main() -> int:
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: as24_scrapling_fetch.py <search|detail> <url> [<url> ...]\n")
        sys.stdout.write(json.dumps({"ok": False, "error": "Mode and URL required"}))
        return 1

    mode = sys.argv[1]
    urls = sys.argv[2:]

    if mode not in ("search", "detail"):
        sys.stderr.write(f"Unknown mode: {mode}\n")
        sys.stdout.write(json.dumps({"ok": False, "error": f"Unknown mode: {mode}"}))
        return 1

    parse_fn = parse_search if mode == "search" else parse_detail
    safe_fn = _parse_search_safe if mode == "search" else _parse_detail_safe
    max_workers = 4 if mode == "search" else 6

    try:
        if len(urls) == 1:
            payload = parse_fn(urls[0])
            sys.stdout.write(json.dumps(payload, ensure_ascii=False))
            return 0

        results = []
        with ProcessPoolExecutor(max_workers=min(max_workers, len(urls))) as executor:
            for parsed in executor.map(safe_fn, urls):
                results.append(parsed)

        sys.stdout.write(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
        return 0
    except Exception as exc:
        sys.stderr.write(str(exc) + "\n")
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
