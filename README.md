# Second Brain

Sistema próprio de gerenciamento de notas de pesquisa/artigos, com a mesma
estrutura e funcionalidades de um vault do Obsidian (wikilinks, backlinks,
tags hierárquicas, templates, notas diárias, grafo de conexões) — mas como
uma aplicação web local independente, sem depender do app Obsidian.

## 🔗 Acesso ao painel

**http://127.0.0.1:8765**

O painel é uma aplicação **local** (roda só na sua máquina, sem servidor na
internet — por isso não existe um link público/hospedado). Pra abrir:

```bash
./start.sh
```

e depois acesse o link acima no navegador. Enquanto o servidor não estiver
rodando, esse link não responde.

## Estrutura

```
SECOND BRAIN - WP/
├── vault/          # as notas em si (markdown + frontmatter), organizadas por tema
│   ├── <TEMA>/Artigos/        # uma nota por artigo lido
│   ├── <TEMA>/Minhas Notas/   # ideias e notas de projeto do usuário
│   ├── Diario/                 # notas de sessão de trabalho, uma por dia
│   ├── Inbox/                  # captura rápida antes de organizar
│   ├── Arquivo/                # temas/projetos encerrados
│   └── Templates/               # modelos para novas notas
├── app/
│   ├── server.py    # backend (Python stdlib, zero dependências)
│   └── static/       # frontend (HTML/CSS/JS puro + marked.js + d3.js via CDN)
├── .claude/skills/pesquisador/   # skill do Claude Code (escopo deste projeto)
│   ├── SKILL.md                    # processa alertas do Scholar, PDFs, diário, projetos
│   └── scripts/parse_scholar_alert.py
└── start.sh          # atalho para subir o servidor local
```

## Como usar

```bash
./start.sh
# ou, com outra porta/vault: python3 app/server.py --port 8765 --vault ./vault
```

## Funcionalidades

- **Árvore de notas** por pasta/tema, igual ao explorador de arquivos do Obsidian.
- **Wikilinks** (`[[Nota]]` e `[[Nota|apelido]]`) — clicáveis no modo leitura,
  resolvidos pelo nome do arquivo em qualquer pasta do vault.
- **Backlinks automáticos** — painel lateral mostra quem linka para a nota aberta.
- **Tags hierárquicas** (`tema/docking`, `biblioteca/rdkit`, etc.), extraídas do
  frontmatter `tags: [...]` e de hashtags `#no-corpo`, navegáveis por um painel
  de tags com contagem.
- **Busca** por título, caminho, tag ou conteúdo.
- **Templates** — nova nota a partir de qualquer arquivo em `Templates/`,
  substituindo `{{title}}` e `{{date}}`.
- **Nota diária** — botão "Diário de hoje" cria/abre `Diario/AAAA-MM-DD.md`.
- **Grafo de conexões** — visualização interativa (d3 force-directed) de todas
  as notas e seus links, colorida por tema/pasta.
- **Tema claro/escuro**, responsivo.

## Backend

`app/server.py` é um servidor HTTP feito só com a biblioteca padrão do Python
(sem Flask/Django) — lê e escreve os arquivos `.md` do `vault/` diretamente,
faz o parsing do frontmatter (subconjunto simples de YAML), extrai wikilinks
e tags, e monta o índice de backlinks em memória a cada requisição a
`/api/index`.

## Conteúdo inicial

O `vault/` foi semeado com uma cópia do vault Obsidian existente do usuário
(`OBSIDIAN/`), que continua existindo e sendo usado normalmente em paralelo —
este é um sistema separado.

## Automação (skill do Claude Code)

Este projeto tem uma skill `pesquisador` própria (`.claude/skills/pesquisador/`,
escopo local — não é a global usada no vault `OBSIDIAN/`) que automatiza,
dentro deste `vault/`:

- transformar alertas do Google Scholar (Gmail) em notas de fila de leitura;
- processar um PDF/artigo em nota de literatura + notas de ideia conectadas;
- registrar sessões de trabalho em `Diario/`;
- manter notas de projeto em `Minhas Notas/` atualizadas.

Rodando o Claude Code dentro desta pasta, basta pedir em linguagem natural
("processa os alertas do Scholar", "processa esse PDF", "registra isso no
diário") — ver `SKILL.md` para os detalhes de cada procedimento.
