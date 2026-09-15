---
tags: [meta, tutorial]
data: 2026-09-15
---
Eu uso o formato `[[Nota]]` para links internos. Sempre que criar um conceito novo que se relacione com uma nota existente, crie o link nesse formato wiki. Sempre use Frontmatter (YAML) no topo com `tags:` e `data:`

# Tutorial — Como Usar Este Vault

Guia prático. Pra entender o *porquê* das regras, ver [[ESTRATEGIA]] — este arquivo aqui é só "o que eu faço, agora".

> Este vault roda no **Second Brain**, o app próprio (não o Obsidian) —
> suba com `./start.sh` na raiz do projeto e abra `http://127.0.0.1:8765`.

---

## 1. A estrutura, em 1 olhada

- Cada **tema** (ex.: `DATA SCIENCE/QUIMIOINFORMATICA`) tem 2 pastas dentro: `Artigos/` e `Minhas Notas/`.
- `Diario/` = registro do dia. `Inbox/` = captura rápida. `Arquivo/` = coisa encerrada.

## 2. Processar um artigo — passo a passo

**Passo 1 — durante a leitura.** Não organiza nada. Se um trecho chamar atenção, joga rápido no `Inbox/` (nova nota, `Cmd+N`, escreve 1 linha e segue lendo).

**Passo 2 — depois de terminar o artigo.**
1. Botão **+ Nota** (topo) → escolhe a pasta `DATA SCIENCE/QUIMIOINFORMATICA/Artigos` (ou o tema certo) → template `Modelo - Nota de Literatura`
2. Digita o título do artigo em vez de "nome genérico" — o app já cria o arquivo com esse nome na pasta escolhida
3. Preenche: autores, ano, link/DOI
4. **TL;DR**: resume em 1-3 frases, *com suas palavras* — nunca copia o abstract
5. Trechos-chave: aqui sim pode colar citação literal, com página

**Passo 3 — a parte que gera insight de verdade.** Pra cada trecho que te fez pensar em algo:
1. Botão **+ Nota** → pasta `Minhas Notas` do mesmo tema → template `Modelo - Nota Permanente`
2. Escreve a ideia **com suas palavras**
3. Linka de volta pro artigo (seção "Fontes") digitando `[[` + nome do artigo
4. No modo **Ler**, clica no link pra conferir se resolveu certo (fica azul se achou a nota, vermelho/pontilhado se não achou — nesse caso o app oferece criar a nota que falta)

**Passo 4.** Volta na nota do artigo e linka as ideias novas que você criou a partir dele.

Um artigo bem processado gera **2 a 5 notas em Minhas Notas**, não só 1 nota de artigo sozinha.

## 3. O dia a dia (`Diario/`)

Botão **Diário de hoje** (topo) — já abre/cria a nota do dia certa, com o modelo certo. Preenche rápido: o que fez, decisão tomada, onde travou, próximo passo. Linka o projeto que você tocou.

## 4. Como isso "acumula" valor

- Primeiras semanas: poucas notas, os links parecem forçados. Normal.
- Com mais notas: fica mais fácil lembrar o que já existe olhando o painel de **Tags** (lateral esquerda, com contagem por tag).
- Depois de um tempo: o botão **Grafo** (topo) mostra aglomerados — assuntos que amadureceram sem você perceber.
- O painel de **Backlinks** (lateral direita, abaixo de cada nota) mostra tudo que aponta pra ela — vira automaticamente seu "tudo que já pensei sobre isso".

## 5. Guardando os PDFs

PDF sempre cai numa subpasta `PDFs/` dentro do `Artigos/` do tema (fora do que o app mostra na árvore/índice, mas existe normalmente no disco). Nome padrão: `Sobrenome Ano - Titulo Curto`, igual pra nota e pro PDF.

**Sozinho**: copia o PDF manualmente pra `<Tema>/Artigos/PDFs/` (o app ainda não tem upload de arquivo pela interface) e referencia o caminho na seção `## PDF` da nota.

**Comigo**: me manda o PDF (ou uma pasta com vários) e eu leio, extraio autores/resumo/trechos-chave, renomeio no padrão certo, deixo o PDF na pasta certa e a nota de artigo rascunhada — você revisa e escreve suas ideias.

## 6. Perguntas que vão aparecer

**"É nota de Artigo ou de Minhas Notas?"** — É o que o autor disse? Artigo. É o que eu penso? Minhas Notas.

**"Uma nota de ideia ficou longa, com várias coisas."** — São duas notas, não uma. Divide.

**"Não sei onde encaixar."** — Cria mesmo assim, linka no que existir de mais próximo, ajusta na revisão semanal.

**"Esqueci de linkar algo."** — Sem problema, dá pra achar e consertar depois pela caixa de busca (topo) ou pelo painel de Backlinks.

## 7. Controles do app

| Ação | Onde |
|---|---|
| Nova nota (com template) | Botão **+ Nota** (topo) |
| Nota de hoje | Botão **Diário de hoje** (topo) |
| Linkar outra nota | Digitar `[[` + nome, no editor |
| Buscar no vault | Caixa de busca (topo) — título, tag ou conteúdo |
| Filtrar por tag | Painel **Tags** (lateral esquerda) |
| Ver grafo | Botão **Grafo** (topo) |
| Salvar | Botão **Salvar** ou `Cmd+S` |
| Tema claro/escuro | Ícone ◐ (topo direito) |

---

Dúvida de "por quê" → [[ESTRATEGIA]]. Dúvida de "o que eu faço agora" → este arquivo.
