#!/usr/bin/env python3
import json
import sys

from scrapling.fetchers import StealthyFetcher


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: autotrader-scrapling-probe.py <url>", file=sys.stderr)
        return 2

    url = sys.argv[1]
    StealthyFetcher.adaptive = True
    page = StealthyFetcher.fetch(url, headless=True, network_idle=True)

    urls = []
    for node in page.css("img"):
        src = node.attributes.get("src") or node.attributes.get("data-src")
        if src and "atcdn.co.uk" in src:
            urls.append(src)

    print(json.dumps({"url": url, "images": urls[:20]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
