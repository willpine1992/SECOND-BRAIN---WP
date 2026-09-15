---
tags: [meta, tutorial]
data: 2026-09-14
---
Eu uso o formato `[[Nota]]` para links internos. Sempre que criar um conceito novo que se relacione com uma nota existente, crie o link no formato wiki do Obsidian. Sempre use Frontmatter (YAML) no topo com `tags:` e `data:`

# Tutorial — Como Usar Este Vault

Guia prático. Pra entender o *porquê* das regras, ver [[ESTRATEGIA]] — este arquivo aqui é só "o que eu faço, agora".

---

## 1. A estrutura, em 1 olhada

- Cada **tema** (ex.: `DATA SCIENCE/QUIMIOINFORMATICA`) tem 2 pastas dentro: `Artigos/` e `Minhas Notas/`.
- `Diario/` = registro do dia. `Inbox/` = captura rápida. `Arquivo/` = coisa encerrada.

## 2. Processar um artigo — passo a passo

**Passo 1 — durante a leitura.** Não organiza nada. Se um trecho chamar atenção, joga rápido no `Inbox/` (nova nota, `Cmd+N`, escreve 1 linha e segue lendo).

**Passo 2 — depois de terminar o artigo.**
1. `Cmd+P` → `Insert template` → `Modelo - Nota de Literatura`
2. Cria/move a nota pra `Artigos/` do tema certo (ex.: `DATA SCIENCE/QUIMIOINFORMATICA/Artigos/`)
3. Renomeia pro título do artigo
4. Preenche: autores, ano, link/DOI
5. **TL;DR**: resume em 1-3 frases, *com suas palavras* — nunca copia o abstract
6. Trechos-chave: aqui sim pode colar citação literal, com página

**Passo 3 — a parte que gera insight de verdade.** Pra cada trecho que te fez pensar em algo:
1. `Cmd+P` → `Insert template` → `Modelo - Nota Permanente`
2. Cria em `Minhas Notas/` do mesmo tema
3. Escreve a ideia **com suas palavras**
4. Linka de volta pro artigo (seção "Fontes")
5. Digita `[[` e procura se já tem outra nota parecida em `Minhas Notas/` — se achar, linka

**Passo 4.** Volta na nota do artigo e linka as ideias novas que você criou a partir dele.

Um artigo bem processado gera **2 a 5 notas em Minhas Notas**, não só 1 nota de artigo sozinha.

## 3. O dia a dia (`Diario/`)

`Cmd+P` → `Open today's daily note` (já abre no lugar certo, com o modelo certo). Preenche rápido: o que fez, decisão tomada, onde travou, próximo passo. Linka o projeto que você tocou.

## 4. Como isso "acumula" valor

- Primeiras semanas: poucas notas, os links parecem forçados. Normal.
- Com mais notas: o autocomplete do `[[` começa a sugerir coisas que você já escreveu e tinha esquecido.
- Depois de um tempo: o **Graph view** mostra aglomerados — assuntos que amadureceram sem você perceber.
- O painel de **Backlinks** (embaixo de cada nota) mostra tudo que aponta pra ela — vira automaticamente seu "tudo que já pensei sobre isso".

## 5. Guardando os PDFs

PDF sempre cai numa subpasta `PDFs/` dentro do `Artigos/` de onde você estiver (já configurado). Nome padrão: `Sobrenome Ano - Titulo Curto`, igual pra nota e pro PDF.

**Sozinho**: arrasta o PDF pra dentro da nota (seção `## PDF` do modelo) — o Obsidian salva e linka sozinho.

**Comigo**: me manda o PDF (ou uma pasta com vários) e eu leio, extraio autores/resumo/trechos-chave, renomeio no padrão certo, e deixo a nota de artigo rascunhada — você revisa e escreve suas ideias.

## 6. Perguntas que vão aparecer

**"É nota de Artigo ou de Minhas Notas?"** — É o que o autor disse? Artigo. É o que eu penso? Minhas Notas.

**"Uma nota de ideia ficou longa, com várias coisas."** — São duas notas, não uma. Divide.

**"Não sei onde encaixar."** — Cria mesmo assim, linka no que existir de mais próximo, ajusta na revisão semanal.

**"Esqueci de linkar algo."** — Sem problema, dá pra achar e consertar depois pelo painel de Backlinks ou `Cmd+Shift+F`.

## 7. Atalhos

| Ação | Atalho |
|---|---|
| Inserir template | `Cmd+P` → `Insert template` |
| Nota de hoje | `Cmd+P` → `Open today's daily note` |
| Linkar outra nota | Digitar `[[` + nome |
| Buscar no vault | `Cmd+Shift+F` |
| Abrir nota rápido | `Cmd+O` |
| Ver grafo | Ícone de rede na lateral |

---

Dúvida de "por quê" → [[ESTRATEGIA]]. Dúvida de "o que eu faço agora" → este arquivo.
