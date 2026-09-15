#!/usr/bin/env python3
"""
Extrai artigos individuais do corpo em texto plano (PLAIN_TEXT) de um e-mail
de alerta do Google Scholar, como retornado por mcp__claude_ai_Gmail__get_thread.

Uso:
    python3 parse_scholar_alert.py < corpo_email.txt
    python3 parse_scholar_alert.py corpo_email.txt

Saída: JSON (lista de artigos) no stdout. Cada item:
    {
      "title": str,
      "authors_venue_year": str,   # linha crua "Fulano, Beltrano... - Periódico, 2026"
      "authors": str,              # melhor esforço, só a parte de autores
      "venue": str,                # melhor esforço, periódico/fonte (pode ser vazio)
      "year": str,                 # 4 dígitos, ou ""
      "snippet": str,              # trecho curto que o Scholar mostrou
      "real_url": str,             # link desembrulhado do redirect scholar_url
      "doi_guess": str             # DOI extraído da URL por heurística, ou ""
    }

Sem dependências externas (só stdlib) -- roda com qualquer Python 3.
"""
import sys
import re
import json
from urllib.parse import urlparse, parse_qs, unquote


ARTICLE_BLOCK_RE = re.compile(
    r"^###\s*(?:###\s*)?(?:\[(?:PDF|HTML|LIVRO|CITAÇÃO)\]\s*)?"
    r"\[(?P<title>.+?)\]\((?P<schurl>https://scholar\.google\.com/scholar_url\?[^\)]*)\)\s*\n"
    r"(?P<authors_venue>[^\n]*)\n"
    r"(?P<snippet>.*?)"
    r"(?=\n\s*\n\|\s*\[|\n###|\Z)",
    re.MULTILINE | re.DOTALL,
)

YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")

DOI_PATTERNS = [
    # caminho /doi/<prefixo>/<sufixo> (RSC, Wiley, etc.)
    re.compile(r"/doi/(?:pdf/|abs/|full/)?(10\.\d{4,9}/[^/?#&]+)", re.IGNORECASE),
    # chemrxiv.org/.../10.26434/chemrxiv.NNNNNNN
    re.compile(r"(10\.26434/chemrxiv[.\-][A-Za-z0-9.\-]+)", re.IGNORECASE),
    # DOI cru em qualquer parte da URL (ex: dx.doi.org/10.xxxx/yyyy)
    re.compile(r"(10\.\d{4,9}/[^\s/?#&\"'<>]+)"),
]


def unwrap_scholar_url(scholar_url: str) -> str:
    """Extrai a URL real de dentro do redirect scholar_url?...&url=<real>&..."""
    qs = parse_qs(urlparse(scholar_url).query)
    real = qs.get("url", [""])[0]
    return unquote(real) if real else scholar_url


def guess_doi(url: str) -> str:
    for pattern in DOI_PATTERNS:
        m = pattern.search(url)
        if m:
            doi = m.group(1).rstrip(".,;")
            return doi
    return ""


def split_authors_venue_year(line: str):
    line = line.strip()
    year_match = YEAR_RE.search(line)
    year = year_match.group(0) if year_match else ""
    # formato típico: "Fulano, Beltrano… - Periódico, 2026"  ou  "Fulano - 2026"
    if " - " in line:
        authors, _, rest = line.partition(" - ")
    else:
        authors, rest = line, ""
    venue = rest.replace(year, "").strip(" ,") if rest else ""
    return authors.strip(), venue, year


def clean_snippet(snippet: str) -> str:
    snippet = re.sub(r"\s*\n\s*", " ", snippet).strip()
    # remove marcações de negrito do Scholar em torno de termos (ex: *RDKit*)
    snippet = snippet.replace("*", "")
    return snippet


def parse(text: str):
    articles = []
    for m in ARTICLE_BLOCK_RE.finditer(text):
        title = re.sub(r"\s+", " ", m.group("title")).strip()
        schurl = m.group("schurl")
        real_url = unwrap_scholar_url(schurl)
        authors_venue_year = m.group("authors_venue").strip()
        authors, venue, year = split_authors_venue_year(authors_venue_year)
        snippet = clean_snippet(m.group("snippet"))
        articles.append({
            "title": title,
            "authors_venue_year": authors_venue_year,
            "authors": authors,
            "venue": venue,
            "year": year,
            "snippet": snippet,
            "real_url": real_url,
            "doi_guess": guess_doi(real_url),
        })
    return articles


def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()

    articles = parse(text)
    json.dump(articles, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
