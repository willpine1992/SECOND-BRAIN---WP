#!/usr/bin/env python3
"""Second Brain - local PKM server.

Zero-dependency (stdlib only) HTTP server that serves a small single-page
app for browsing/editing a folder of markdown notes exactly like an
Obsidian vault: wikilinks, backlinks, hierarchical tags, templates and a
graph view.

Usage:
    python3 server.py [--port 8765] [--vault ../vault]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]")
HASHTAG_RE = re.compile(r"(?<![\w/#])#([A-Za-z0-9_\-/À-ÿ]+)")
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)


# --------------------------------------------------------------------------
# Frontmatter parsing (tiny subset of YAML actually used in this vault)
# --------------------------------------------------------------------------

def parse_frontmatter(text: str):
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    raw = m.group(1)
    body = text[m.end():]
    data = {}
    for line in raw.split("\n"):
        if not line.strip() or ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            items = [v.strip().strip('"').strip("'") for v in inner.split(",") if v.strip()]
            data[key] = items
        else:
            if value.startswith('"') and value.endswith('"') and len(value) >= 2:
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'") and len(value) >= 2:
                value = value[1:-1]
            data[key] = value
    return data, body


def note_title(rel_path: str, frontmatter: dict, body: str) -> str:
    if frontmatter.get("titulo"):
        return frontmatter["titulo"]
    h1 = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
    if h1:
        return h1.group(1).strip()
    return Path(rel_path).stem


def extract_tags(frontmatter: dict, body: str):
    tags = set()
    fm_tags = frontmatter.get("tags")
    if isinstance(fm_tags, list):
        tags.update(t.strip() for t in fm_tags if t.strip())
    elif isinstance(fm_tags, str) and fm_tags.strip():
        tags.add(fm_tags.strip())
    for m in HASHTAG_RE.finditer(body):
        tags.add(m.group(1))
    return sorted(tags)


def extract_links(body: str):
    links = []
    for m in WIKILINK_RE.finditer(body):
        target = m.group(1).strip()
        alias = (m.group(2) or "").strip()
        if target:
            links.append({"target": target, "alias": alias or None})
    return links


# --------------------------------------------------------------------------
# Vault indexing
# --------------------------------------------------------------------------

class Vault:
    def __init__(self, root: Path):
        self.root = root

    # -- filesystem helpers -------------------------------------------------
    def _abs(self, rel_path: str) -> Path:
        rel_path = rel_path.lstrip("/")
        p = (self.root / rel_path).resolve()
        if self.root not in p.parents and p != self.root:
            raise PermissionError("path escapes vault root")
        return p

    def tree(self):
        def walk(dir_path: Path, rel: str):
            entries = []
            try:
                items = sorted(
                    dir_path.iterdir(),
                    key=lambda p: (p.is_file(), p.name.lower()),
                )
            except FileNotFoundError:
                return entries
            for item in items:
                if item.name.startswith(".") or item.name == "PDFs":
                    continue
                item_rel = f"{rel}/{item.name}" if rel else item.name
                if item.is_dir():
                    entries.append(
                        {
                            "name": item.name,
                            "path": item_rel,
                            "type": "dir",
                            "children": walk(item, item_rel),
                        }
                    )
                elif item.suffix.lower() == ".md":
                    entries.append({"name": item.name, "path": item_rel, "type": "file"})
            return entries

        return walk(self.root, "")

    def all_notes(self):
        for dirpath, dirnames, filenames in os.walk(self.root):
            dirnames[:] = [d for d in dirnames if not d.startswith(".") and d != "PDFs"]
            for fn in filenames:
                if fn.lower().endswith(".md"):
                    abs_p = Path(dirpath) / fn
                    rel_p = abs_p.relative_to(self.root).as_posix()
                    yield rel_p, abs_p

    def read(self, rel_path: str) -> str:
        p = self._abs(rel_path)
        return p.read_text(encoding="utf-8")

    def write(self, rel_path: str, content: str):
        p = self._abs(rel_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")

    def delete(self, rel_path: str):
        p = self._abs(rel_path)
        if p.exists():
            p.unlink()

    def exists(self, rel_path: str) -> bool:
        return self._abs(rel_path).exists()

    # -- index: notes + tags + resolved links + backlinks -------------------
    def build_index(self):
        notes = {}
        by_stem = {}
        for rel_p, abs_p in self.all_notes():
            try:
                text = abs_p.read_text(encoding="utf-8")
            except Exception:
                continue
            fm, body = parse_frontmatter(text)
            title = note_title(rel_p, fm, body)
            tags = extract_tags(fm, body)
            links = extract_links(body)
            mtime = abs_p.stat().st_mtime
            notes[rel_p] = {
                "path": rel_p,
                "title": title,
                "tags": tags,
                "links": links,
                "frontmatter": fm,
                "mtime": mtime,
                "folder": str(Path(rel_p).parent) if str(Path(rel_p).parent) != "." else "",
            }
            stem = Path(rel_p).stem.lower()
            by_stem.setdefault(stem, []).append(rel_p)

        # resolve wikilink targets -> note paths, and build backlinks
        backlinks: dict[str, list[str]] = {rel: [] for rel in notes}
        for rel_p, note in notes.items():
            resolved = []
            for link in note["links"]:
                target_stem = link["target"].split("/")[-1].strip().lower()
                candidates = by_stem.get(target_stem, [])
                target_path = candidates[0] if candidates else None
                resolved.append(
                    {
                        "target": link["target"],
                        "alias": link["alias"],
                        "resolved": target_path,
                    }
                )
                if target_path and target_path != rel_p:
                    backlinks.setdefault(target_path, [])
                    if rel_p not in backlinks[target_path]:
                        backlinks[target_path].append(rel_p)
            note["links"] = resolved

        for rel_p, note in notes.items():
            note["backlinks"] = backlinks.get(rel_p, [])

        return notes


# --------------------------------------------------------------------------
# HTTP handler
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    vault: Vault = None  # set at startup

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, message, status=400):
        self._send_json({"error": message}, status)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _serve_static(self, rel):
        rel = rel.lstrip("/") or "index.html"
        p = (STATIC_DIR / rel).resolve()
        if STATIC_DIR not in p.parents and p != STATIC_DIR:
            self._send_error_json("forbidden", 403)
            return
        if not p.exists() or p.is_dir():
            p = STATIC_DIR / "index.html"
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
        }.get(p.suffix, "application/octet-stream")
        data = p.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # -- routing --------------------------------------------------------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        path = parsed.path

        try:
            if path == "/api/tree":
                self._send_json({"tree": self.vault.tree()})
            elif path == "/api/index":
                self._send_json({"notes": self.vault.build_index()})
            elif path == "/api/note":
                rel = qs.get("path", [""])[0]
                if not rel or not self.vault.exists(rel):
                    self._send_error_json("not found", 404)
                    return
                content = self.vault.read(rel)
                self._send_json({"path": rel, "content": content})
            elif path == "/api/templates":
                templates = []
                tdir = self.vault.root / "Templates"
                if tdir.exists():
                    for p in sorted(tdir.glob("*.md")):
                        templates.append(
                            {"name": p.stem, "path": p.relative_to(self.vault.root).as_posix()}
                        )
                self._send_json({"templates": templates})
            else:
                self._serve_static(path)
        except PermissionError as e:
            self._send_error_json(str(e), 403)
        except Exception as e:  # pragma: no cover
            self._send_error_json(str(e), 500)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/note":
                body = self._read_json_body()
                rel = body.get("path", "").strip()
                content = body.get("content", "")
                if not rel:
                    self._send_error_json("path required", 400)
                    return
                self.vault.write(rel, content)
                self._send_json({"ok": True, "path": rel})
            else:
                self._send_error_json("not found", 404)
        except PermissionError as e:
            self._send_error_json(str(e), 403)
        except Exception as e:  # pragma: no cover
            self._send_error_json(str(e), 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/note":
                body = self._read_json_body()
                rel = body.get("path", "").strip()
                content = body.get("content", "")
                overwrite = body.get("overwrite", False)
                if not rel:
                    self._send_error_json("path required", 400)
                    return
                if not rel.lower().endswith(".md"):
                    rel += ".md"
                if self.vault.exists(rel) and not overwrite:
                    self._send_error_json("note already exists", 409)
                    return
                self.vault.write(rel, content)
                self._send_json({"ok": True, "path": rel})
            elif path == "/api/search":
                body = self._read_json_body()
                query = (body.get("query") or "").strip().lower()
                tag = (body.get("tag") or "").strip()
                notes = self.vault.build_index()
                results = []
                for rel, note in notes.items():
                    if tag and tag not in note["tags"]:
                        continue
                    if query:
                        haystack = (note["title"] + " " + rel + " " + " ".join(note["tags"])).lower()
                        if query not in haystack:
                            try:
                                content = self.vault.read(rel).lower()
                            except Exception:
                                content = ""
                            if query not in content:
                                continue
                    results.append({"path": rel, "title": note["title"], "tags": note["tags"]})
                results.sort(key=lambda n: n["title"].lower())
                self._send_json({"results": results})
            else:
                self._send_error_json("not found", 404)
        except PermissionError as e:
            self._send_error_json(str(e), 403)
        except Exception as e:  # pragma: no cover
            self._send_error_json(str(e), 500)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        path = parsed.path
        try:
            if path == "/api/note":
                rel = qs.get("path", [""])[0]
                if not rel:
                    self._send_error_json("path required", 400)
                    return
                self.vault.delete(rel)
                self._send_json({"ok": True})
            else:
                self._send_error_json("not found", 404)
        except PermissionError as e:
            self._send_error_json(str(e), 403)
        except Exception as e:  # pragma: no cover
            self._send_error_json(str(e), 500)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--vault", type=str, default=str(APP_DIR.parent / "vault"))
    args = parser.parse_args()

    vault_root = Path(args.vault).resolve()
    vault_root.mkdir(parents=True, exist_ok=True)
    Handler.vault = Vault(vault_root)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Second Brain rodando em http://127.0.0.1:{args.port}")
    print(f"Vault: {vault_root}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando.")
        server.shutdown()


if __name__ == "__main__":
    main()
