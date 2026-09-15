#!/usr/bin/env python3
"""Bakes the vault/ into docs/data.json for the read-only GitHub Pages copy.

Run this after editing the vault (locally, via the app or by hand) and
commit the result so the online copy at docs/ stays in sync:

    python3 scripts/build_static_site.py

Reuses the same parsing logic as app/server.py (frontmatter, wikilinks,
tags, backlinks) so the online read-only viewer and the local read-write
app never drift apart in how they interpret notes.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))

from server import Vault  # noqa: E402

VAULT_DIR = ROOT / "vault"
DOCS_DIR = ROOT / "docs"
DATA_FILE = DOCS_DIR / "data.json"


def main():
    vault = Vault(VAULT_DIR)
    tree = vault.tree()
    notes = vault.build_index()
    for path, note in notes.items():
        note["content"] = vault.read(path)

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    data = {"tree": tree, "notes": notes}
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {DATA_FILE.relative_to(ROOT)} ({len(notes)} notas, {DATA_FILE.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
