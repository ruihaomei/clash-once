#!/usr/bin/env python3
"""Generate a private Clash Once script from local Clash/Mihomo YAML snapshots."""
import argparse
import json
import os
from pathlib import Path
import sys
import tempfile

import yaml

ROOT = Path(__file__).resolve().parent.parent
PREFIX = "Clash Once/"
TYPES = set("ss ssr vmess vless trojan socks5 http snell hysteria hysteria2 tuic wireguard anytls ssh mieru".split())


def read_pool(path, slot):
    document = yaml.safe_load(path.read_text(encoding="utf-8-sig"))
    nodes = document.get("proxies") if isinstance(document, dict) else None
    if not isinstance(nodes, list):
        raise ValueError(f"{slot}: expected a top-level proxies list in the YAML")
    pool = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        name, kind, server, port = (node.get(key) for key in ("name", "type", "server", "port"))
        if (
            not isinstance(name, str) or not name.strip()
            or not isinstance(kind, str) or kind not in TYPES
            or not isinstance(server, str) or not server.strip()
            or type(port) is not int or not 1 <= port <= 65535
            or node.get("dialer-proxy")
        ):
            continue
        # Imported nodes are independent first hops with names unique across pools.
        label = " ".join(name.replace(",", " ").split())
        pool.append({**node, "name": f"{PREFIX}entry/{slot}/{len(pool) + 1} {label}"})
    if not pool:
        raise ValueError(f"{slot}: no supported standalone nodes")
    return pool


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for slot in ("a", "b", "c"):
        parser.add_argument(f"--{slot}", type=Path, metavar="YAML", help=f"YAML snapshot for slot {slot.upper()}")
    parser.add_argument("--base", type=Path, default=ROOT / "clash-chain.js", help="Clash Once base script")
    parser.add_argument("--output", type=Path, default=Path("clash-chain-menu.local.js"))
    args = parser.parse_args()
    sources = {slot.upper(): getattr(args, slot) for slot in ("a", "b", "c") if getattr(args, slot)}
    if not sources:
        parser.error("supply at least one of --a, --b or --c")
    if not args.output.name.endswith(".local.js") or args.output.resolve() == args.base.resolve():
        parser.error("use a separate output filename ending in .local.js")
    try:
        base = args.base.read_text(encoding="utf-8-sig")
        if "// Clash Once advanced menu" in base or "function main(input)" not in base:
            raise ValueError("use the standard Clash Once script as --base")
        pools = {slot: read_pool(path, slot) for slot, path in sources.items()}
        template = (ROOT / "advanced" / "menu.js").read_text(encoding="utf-8")
        data = json.dumps(json.dumps(pools, ensure_ascii=True, allow_nan=False))
        result = base.rstrip() + "\n\n" + template.replace("__PRIVATE_NODE_POOLS__", data)
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=args.output.parent, delete=False) as handle:
            temp = Path(handle.name)
        try:
            temp.write_text(result, encoding="utf-8")
            os.replace(temp, args.output)
        finally:
            temp.unlink(missing_ok=True)
    except (OSError, TypeError, yaml.YAMLError, RecursionError):
        print("Could not read, parse, or write a local configuration. Check file paths and YAML.", file=sys.stderr)
        return 1
    except ValueError as error:
        # Decode errors may include private file data.
        print("Invalid text encoding." if isinstance(error, UnicodeError) else str(error), file=sys.stderr)
        return 1
    print(f"Generated {args.output.name} ({', '.join(f'{slot}: {len(nodes)}' for slot, nodes in pools.items())}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
