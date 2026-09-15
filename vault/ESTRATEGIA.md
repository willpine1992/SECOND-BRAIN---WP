---
tags: [meta, estrategia]
data: 2026-09-15
---

# Estratégia do Vault — Como isto funciona

> Este arquivo explica o *porquê*. Pro passo a passo prático do dia a dia, ver [[instructions]].

## A ideia em 1 frase

Organizo por **tema** (pastas), e dentro de cada tema separo **o que os artigos dizem** de **o que eu penso** — e ligo as duas coisas com links `[[assim]]`.

## Estrutura

```
DATA SCIENCE/
  QUIMIOINFORMATICA/
    Artigos/          <- uma nota por artigo lido (+ os PDFs)
    Minhas Notas/      <- minhas ideias, projetos, decisões
  (outro sub-tema, se precisar)/
(OUTRO TEMA, quando aparecer)/
  ...

Diario/     <- um registro por dia de trabalho relevante
Inbox/      <- captura rápida, sem organizar, pra processar depois
Arquivo/    <- temas/projetos encerrados, fora do caminho
Templates/  <- meus modelos de nota
```

Cada tema novo (ex.: se eu começar a pesquisar outra área) vira uma pasta nova no topo, com a mesma lógica de `Artigos/` + `Minhas Notas/` dentro.

## A única regra que realmente importa

- **Artigos**: o que o *autor* escreveu. Resumo, dados, citações. Fica "cru" ali.
- **Minhas Notas**: o que *eu* penso depois de ler. Reescrito com minhas palavras.

Se eu só crio notas de artigo e nunca escrevo o que eu penso sobre eles, o vault vira um monte de resumos que eu nunca mais releio. É escrevendo "o que eu penso" que uma leitura vira insight — e é aí que duas ideias de artigos diferentes se encontram.

**Fluxo**: leio o artigo → crio a nota em `Artigos/` → pra cada trecho que me fez pensar algo, crio uma nota em `Minhas Notas/` linkando de volta pro artigo → ligo essa nova ideia com outras ideias/projetos relacionados que eu já tenha.

## Toda nota nova precisa ter pelo menos 1 link

Não importa se é uma nota de artigo, uma ideia, ou uma nota de projeto — sempre linka em algo. Nota sem link é nota perdida, ninguém vai achar ela de novo.

## Revisão rápida (uma vez por semana, 15 min)

1. Esvazia o `Inbox/`.
2. Abre o **Grafo** (botão no topo) e procura notas soltas, sem nenhuma linha saindo — força pelo menos 1 link em cada.
3. Relê 1 nota antiga de `Minhas Notas/` ao acaso — às vezes gera uma conexão nova.

## Relação com o Claude Code

Eu (Claude) tenho minha própria memória entre sessões — é só pra eu te ajudar melhor, não é uma base de conhecimento pra você consultar. Este vault é seu: onde as ideias e a literatura ficam pra você revisitar e conectar. Eu posso criar/atualizar a nota do dia em `Diario/` e a nota do projeto quando você pedir — mas ler, conectar e gerar insight a partir disso é sempre com você.
