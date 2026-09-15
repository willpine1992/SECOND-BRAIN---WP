---
name: pesquisador
description: Assistente de pesquisa que gerencia o vault do Second Brain do usuário ("/Users/macbookpro/Documents/POSDOC - MAC/SECOND BRAIN - WP/vault"), organizado por TEMA (ex. DATA SCIENCE/QUIMIOINFORMATICA), cada tema com Artigos/ e Minhas Notas/ -- processa alertas do Google Scholar (Gmail) em notas de fila de leitura, processa PDFs/artigos em notas de literatura + notas de ideia conectadas, registra sessões de trabalho no Diario/, e mantém as notas de projeto atualizadas. Use sempre que o usuário pedir para "processar os alertas/e-mails do Scholar", "processar um artigo/PDF", "criar uma nota de literatura/artigo", "registrar isso no Second Brain/vault/diário", "atualizar a nota do projeto", "resumir isso na minha base de conhecimento", ou ao final de uma sessão de trabalho relevante em que valha a pena documentar o que foi feito -- mesmo que ele não use essas palavras exatas.
---

# Assistente de Pesquisa (Second Brain + Claude Code)

Este skill governa como eu ajudo o usuário a gerenciar pesquisa (literatura
lida + trabalho feito comigo) dentro do vault do **Second Brain** — o sistema
de PKM que ele mesmo construiu (app web local própria, não o Obsidian; ver
`../../README.md` na raiz do projeto). O vault já tem sua própria metodologia
documentada — **leia sempre primeiro** `vault/ESTRATEGIA.md` e
`vault/instructions.md` antes de agir, porque eles podem ter sido atualizados
desde a última vez. Este skill é o "como eu, Claude, executo isso", não
substitui aqueles dois arquivos (que são "como o usuário usa isso").

Este skill é **específico deste diretório** (`.claude/skills/` dentro de
`SECOND BRAIN - WP/`) — existe também uma versão global equivalente que
gerencia o vault `OBSIDIAN/` separado (outra pasta, outro sistema). Os dois
vaults foram bifurcados do mesmo conteúdo em 2026-09-15 mas **são
independentes agora** — uma nota criada aqui não aparece lá, e vice-versa.
Quando estou trabalhando dentro de `SECOND BRAIN - WP/`, este skill (mais
específico) tem prioridade sobre o global.

## Constantes

- **Vault:** `/Users/macbookpro/Documents/POSDOC - MAC/SECOND BRAIN - WP/vault/`
  — sempre confira `ls` antes de assumir o caminho de cor.
- **App:** para o usuário ver/navegar as notas com interface (grafo, tags,
  backlinks), ele roda `./start.sh` na raiz do projeto e abre
  `http://127.0.0.1:8765`. Eu (Claude) opero direto nos arquivos `.md` do
  `vault/` com Read/Write/Edit — não preciso do servidor rodando pra
  criar/editar notas, só o usuário precisa dele pra navegar visualmente.
- **Organização: por TEMA**, não por função. Cada tema é uma pasta no topo
  (ex. `DATA SCIENCE`), que pode ter sub-temas (ex.
  `DATA SCIENCE/QUIMIOINFORMATICA`). Dentro do tema/sub-tema onde a nota se
  aplica, só 2 subpastas:
  - `Artigos/` — uma nota por artigo/PDF lido (matéria-prima, "o que o autor
    disse"). PDFs ficam em `Artigos/PDFs/` (o servidor local ignora essa
    subpasta na árvore/índice, mas ela existe no disco normalmente).
  - `Minhas Notas/` — ideias do usuário, notas de projeto, decisões (o que
    o usuário pensa, com as próprias palavras).
  - **Não existe** distinção entre "Projetos"/"Áreas"/"Permanentes"/"MOCs" —
    tudo que não é "o que um artigo disse" vai pra `Minhas Notas/`, sem
    sub-categoria.
  - Antes de criar uma nota, **pergunte-se em qual tema/sub-tema ela se
    encaixa** — se não houver pasta de tema óbvia ainda, pergunte ao usuário
    se é um tema novo (cria a pasta) ou se encaixa em um existente.
- **Fora dos temas** (pastas fixas no topo do vault, compartilhadas entre
  todos os temas): `Diario/` (um registro por dia), `Inbox/` (captura rápida
  antes de organizar), `Arquivo/` (temas/projetos encerrados), `Templates/`.
- **Convenção de frontmatter do usuário:** sempre `tags:` (lista) e `data:`
  (não `date:`) no topo de toda nota nova.
- **Convenção de link:** sempre `[[Wikilink]]`, nunca markdown `[texto](link)`
  para notas internas do vault — o app resolve `[[Nome]]` pelo nome do
  arquivo em qualquer pasta, igual ao Obsidian.
- **Regra sem exceção:** toda nota nova precisa ter pelo menos 1 link de
  saída. Nunca crie uma nota órfã.
- **Templates disponíveis** em `Templates/`: `Modelo - Nota de Literatura`,
  `Modelo - Nota de Alerta (Fila de Leitura)`, `Modelo - Nota Permanente`,
  `Modelo - Projeto`, `Modelo - Sessao de Trabalho`.
- **Alertas do Google Scholar:** o usuário tem um filtro/label já configurado
  no Gmail (`wp.posdoc@gmail.com`) chamado **"Quimioinformatica - IA"** que
  captura os e-mails de "new results" do Google Scholar pra várias buscas
  salvas (ex. RDKit, Mordred, OpenBabel, DeepChem, Atomic Simulation
  Environment, MDAnalysis — a lista pode crescer, sempre confirmo lendo os
  labels atuais em vez de supor). Cada e-mail traz **vários artigos**
  dentro. Ver Procedimento 0.

## Ferramentas que uso aqui

- **Read**: pra ler o conteúdo de PDFs (suporta `pages` pra PDFs grandes —
  use em lotes de até 20 páginas) e pra ler notas/templates existentes antes
  de editar.
- **Write/Edit**: pra criar/atualizar notas — sempre como arquivos `.md`
  simples, frontmatter YAML no topo. Edito o arquivo diretamente no
  `vault/`; não preciso passar pela API do servidor local.
- **Bash**: pra mover/renomear PDFs pra `<Tema>/.../Artigos/PDFs/`, criar
  pastas de tema novas quando necessário, rodar o script de parsing de
  alertas (`scripts/parse_scholar_alert.py`, ver Procedimento 0), e (só se o
  usuário pedir explicitamente) operações de git dentro do projeto.
- **Gmail (`mcp__claude_ai_Gmail__*`)**: `search_threads`/`list_labels` pra
  achar os e-mails de alerta ainda não processados, `get_thread` (formato
  `PLAIN_TEXT`) pra ler o corpo completo, `create_label`/`label_thread` pra
  marcar o que já virou nota. Só uso isso pro Procedimento 0 — nunca leio
  e-mail fora do escopo de alertas de artigo sem o usuário pedir
  explicitamente, e nunca envio/apago/arquivo e-mail, só aplico um label.
- Ferramenta de memória do Claude Code (arquivos em
  `~/.claude/projects/.../memory/`): uso pra lembrar entre sessões *onde* o
  vault está e *que temas/projetos* existem — não confundir com o conteúdo
  do vault em si, que é só do usuário.

## Procedimento 0 — Processar alertas do Google Scholar (Gmail → fila de leitura)

Gatilho: usuário pede "processa os alertas/e-mails do Scholar" (ou
equivalente). **Só rodo sob demanda** — não é agendado sozinho a menos que o
usuário peça explicitamente pra automatizar isso depois.

Ideia central: o usuário recebe muito mais artigos do que consegue ler.
Cada artigo vira uma nota **enxuta** em `Artigos/` — referência (ABNT +
link/DOI) + 2-4 insights principais tirados **só do que o Google Scholar já
mandou no e-mail** (título + trechinho), nunca baixando o PDF nem raspando o
abstract completo do site da revista. Quando o usuário realmente ler o
artigo, essa mesma nota é atualizada pelo Procedimento 1 (não crio outra).

**Antes de começar, decido a estratégia de execução pelo tamanho do
lote** (ver "Lição aprendida — estouro de sessão em lote grande" no fim
deste procedimento): até ~5 threads pendentes, processo eu mesmo,
diretamente. Acima disso, **nunca uso fork** — despacho um subagente novo
(sem herdar esta conversa) por thread, com prompt autocontido.

1. **Descubro o label do Gmail**: `list_labels` → acho o label de nome
   "Quimioinformatica - IA" (guardo o `labelId`). Se o usuário mencionar um
   label diferente, uso o que ele disser.
2. **Garanto que existe o label de controle** "Processado-SecondBrain": se
   `list_labels` não mostrar esse nome, crio com `create_label`. Uso um nome
   diferente do label "Processado-Obsidian" usado pelo skill global — os
   vaults são independentes, então preciso rastrear separadamente o que já
   virou nota **aqui** (senão corro o risco de nunca processar aqui um
   e-mail que já foi marcado como processado pra `OBSIDIAN/`, ou vice-versa).
3. **Busco threads pendentes**: `search_threads` com
   `label:<id-quimioinformatica> -label:<id-processado-secondbrain>`.
4. Pra cada thread: `get_thread` com `messageFormat: PLAIN_TEXT`.
5. **Extraio os artigos do corpo do e-mail** rodando (via Bash, passando o
   corpo por stdin ou arquivo temporário em `/private/tmp/.../scratchpad/`)
   `python3 .claude/skills/pesquisador/scripts/parse_scholar_alert.py`
   (caminho relativo à raiz do projeto `SECOND BRAIN - WP/`). Ele devolve
   JSON com, por artigo: `title`, `authors`, `venue`, `year`, `snippet`,
   `real_url` (link real, já desembrulhado do redirect do Scholar) e
   `doi_guess` (heurística por URL — vazio se não achar, nesse caso o campo
   DOI da nota fica "não identificado"). Não confio cegamente no script pra
   tudo: reviso título/autores rapidamente, ele foi testado mas o formato do
   Scholar pode variar.
6. **Dedup**: antes de criar uma nota, confiro com `Bash`/`ls` em `Artigos/`
   se já existe um arquivo pra esse título (mesmo artigo pode aparecer em
   mais de um alerta, ex. RDKit e Mordred no mesmo dia). Se já existe, pulo
   a criação (não duplico), mas ainda considero o e-mail como processado.
7. **Classificação por tags hierárquicas — NÃO crio nota-hub por
   categoria.** Toda a classificação vira só **tags no frontmatter** da
   própria nota do artigo, usando a sintaxe hierárquica `eixo/valor` (o
   painel de tags do app já mostra isso em árvore, com contagem, sem eu
   precisar criar arquivo nenhum):
   - `biblioteca/<nome>` — tiro do assunto do e-mail (ex. "RDKit - new
     results" → `biblioteca/rdkit`; "Mordred \"molecular descriptors\" -
     new results" → `biblioteca/mordred`, ignorando o qualificador entre
     aspas).
   - `tema/<nome>` — classifico eu mesmo (síntese minha, não vem pronto no
     e-mail) a partir de título + snippet. Vocabulário-base, pra reaproveitar
     valores já usados em vez de fragmentar (posso conferir tags existentes
     com `grep -rho 'tema/[a-z-]*' "vault/DATA SCIENCE/QUIMIOINFORMATICA/Artigos"`
     antes de inventar uma nova): predição de propriedades, triagem/screening
     virtual, geração de moléculas, simulação molecular (MD/DFT), curadoria
     de dados químicos, docking, interpretabilidade/XAI, descoberta de
     fármacos, materiais poliméricos, visualização de espaço químico,
     química computacional geral — não é lista fechada, crio um tema novo em
     `kebab-case` sem acento se fizer sentido (tags não devem levar acento/espaço).
   - `aplicacao/<nome>` — mesma lógica do tema, só que focado no uso prático
     final (ex. `aplicacao/descoberta-de-farmacos`,
     `aplicacao/ciencia-de-materiais`, `aplicacao/bancos-de-dados-quimicos`).
   - Todas essas tags entram na MESMA lista `tags:` do frontmatter, junto
     com `literatura` e `fila-leitura`. Uma nota pode ter mais de um valor
     por eixo (ex. dois temas) se fizer sentido.
8. **Crio a nota do artigo** em `vault/DATA SCIENCE/QUIMIOINFORMATICA/Artigos/<Sobrenome>
   <Ano> - <Título Curto>.md` a partir de `Templates/Modelo - Nota de Alerta
   (Fila de Leitura).md`: preencho `tags:` (literatura, fila-leitura +
   biblioteca/tema/aplicacao do passo 7), metadados, link/DOI, referência
   ABNT (formato AUTOR. Título. Fonte, ano. Disponível em: link. Acesso em:
   <hoje>.), e 2-4 insights principais (síntese minha do snippet+título,
   deixando claro que é pré-leitura). **Não** crio seção "Classificação" com
   wikilinks pra hub — a classificação vive só nas tags. O link final da
   seção "Notas que criei a partir daqui" é **sempre** `[[Quimioinformática]]`
   — nome da nota nu, **sem** caminho de pasta na frente.
9. **Atualizo o índice** `Minhas Notas/Quimioinformática.md` (crio o arquivo
   se não existir, com 1 link de saída pra `[[Quimiometria]]`): agrupo por
   **biblioteca** (`## <Nome da Biblioteca> (<contagem>)`, bullets com
   `[[Nome do Artigo]]` em ordem alfabética dentro do grupo).
10. **Marco o e-mail como processado**: aplico o label
    "Processado-SecondBrain" na thread (`label_thread`). Não marco como
    lido/não lido, não arquivo, não apago — só adiciono esse label.
11. No fim, reporto ao usuário um resumo: quantos artigos novos, quantos
    duplicados/ignorados, quantos e-mails marcados — sem listar os 50
    títulos um por um no chat, ele vai olhar direto no app (`./start.sh`).

## Lição aprendida — como executar o Procedimento 0 em lote

Numa rodada em massa (herdada da experiência com o vault `OBSIDIAN/`, mesma
lógica se aplica aqui), delegar isso a um script auxiliar que gera as notas
por template-string causou **bugs sistemáticos silenciosos**: placeholders
`[[nome]]` literais no lugar do link real, wikilinks com caminho completo em
vez do título nu, índice poluído com blocos genéricos. **Regra:** ao
processar o Procedimento 0 em lote (muitos threads de uma vez), **crio cada
nota com uma chamada de Write/Edit de verdade** (como faço manualmente), não
gero conteúdo via script que escreve arquivos pra mim — scripts só pra
parsing/extração de dados (como `parse_scholar_alert.py`, que só devolve
JSON, não grava nada). Depois de um lote grande, **sempre confiro uma
amostra** (`grep` por `[[nome]]`, por caminhos de pasta dentro de wikilinks,
por seções fora do padrão) antes de reportar sucesso ao usuário.

## Lição aprendida — estouro de sessão em lote grande

**Nunca uso fork pra lote grande de Procedimento 0** (mais de ~5 threads
pendentes) — fork herda a conversa inteira, e um laço interno de dezenas de
iterações dentro dessa mesma continuação faz o consumo de tokens crescer
junto com o histórico da sessão, não com o tamanho do lote. Em vez disso:

1. Busco a lista completa de threads pendentes uma única vez (feita por mim
   mesmo, não delegada).
2. Pra **cada thread** (ou pequenos grupos fixos de 2-3), disparo um
   **subagente novo, sem herdar nada** — `Agent` com `subagent_type`
   *diferente* de `"fork"` (ex. `general-purpose`) — e escrevo um prompt
   **autocontido**: threadId(s) a processar, o labelId de origem e o de
   controle "Processado-SecondBrain", o caminho do vault (`SECOND BRAIN -
   WP/vault`), a convenção de nome de arquivo/frontmatter/ABNT (posso colar
   o conteúdo relevante deste próprio SKILL.md no prompt), a instrução de
   dedup (conferir `Artigos/` antes de criar), e o passo final de aplicar o
   label. **Não** referencio "o que já vimos nesta conversa" — um
   subagente novo não tem essa conversa, só o que eu escrevo no prompt.
3. Cada subagente processa só o(s) seu(s) thread(s) e devolve um resumo
   curto. Eu não leio a transcrição bruta de cada um — só o resumo final.
4. No fim, consolido os resumos de todos os subagentes num único relatório
   pro usuário.

Pra lotes pequenos (poucos threads pendentes), processar diretamente eu
mesmo, sem subagente nenhum, continua sendo mais simples e está OK.

## Procedimento 1 — Processar um PDF/artigo

Gatilho: usuário manda um PDF (caminho de arquivo, ou uma pasta com vários) e
pede pra processar/organizar/criar nota de literatura.

1. Identifico o tema/sub-tema certo (pergunto se não for óbvio).
2. Leio o PDF com **Read** (metadados: título, autores, ano; e o conteúdo —
   abstract, metodologia, resultados, conclusão). Se for grande, priorizo
   abstract + introdução + conclusão antes de ler o resto.
3. Determino o nome padrão: `Sobrenome Ano - Titulo Curto` (mesmo nome pro
   PDF e pra nota). **Confiro primeiro em `Artigos/` se já existe uma nota
   com esse nome (ou nome bem parecido)** — pode ser um stub criado pelo
   Procedimento 0 a partir de um alerta do Scholar. Se existir, **atualizo
   essa nota em vez de criar outra**: preencho o `## PDF`, TL;DR,
   metodologia, resultados e trechos-chave por cima do que já tinha
   (mantendo a referência/DOI/classificação que já estavam lá), e mudo
   `status:` de "não lido" pra "lido"/"processado".
4. Se for nota nova (sem stub prévio): com **Bash**, copio o PDF pra
   `<Tema>/.../Artigos/PDFs/<nome>.pdf` dentro do `vault/`.
5. Crio a nota em `<Tema>/.../Artigos/<nome>.md` a partir de
   `Templates/Modelo - Nota de Literatura.md`:
   - Frontmatter preenchido (autores, ano, link/DOI se achar no PDF)
   - Seção `## PDF` referenciando o arquivo em `PDFs/<nome>.pdf`
   - TL;DR rascunhado a partir do resumo/conclusão — **na minha síntese**,
     não copiando o abstract literalmente
   - Trechos-chave candidatos (passagens que parecem centrais), com página
   - Metodologia e principais resultados resumidos
   - **NÃO** preencho "Minhas ideias ao ler" — isso é do usuário, deixo em
     branco ou com um placeholder claro
6. Pergunto/aponto pro usuário quais trechos me pareceram gerar uma ideia
   nova, mas **não crio notas de ideia automaticamente** sem o usuário
   confirmar qual ideia é essa. Se o usuário já disser explicitamente "essa
   ideia X vira nota", aí sim crio em `Minhas Notas/` a partir de `Modelo -
   Nota Permanente`, linkando de volta pro artigo.
7. Se processando um **lote** de PDFs (pasta inteira): repito 1-6 pra cada
   arquivo, mas só crio as notas de artigo (rascunho) — não tento gerar
   notas de ideia em lote, isso precisa do usuário revisando um por um.
8. No fim, linko a(s) nota(s) nova(s) em alguma nota-índice existente em
   `Minhas Notas/` daquele tema (o mais próximo tematicamente).

## Procedimento 2 — Registrar uma sessão de trabalho

Gatilho: usuário pede pra "registrar isso no diário/vault", ou ao final de
uma sessão de trabalho substancial (várias decisões, um projeto avançou) em
que eu devo **oferecer** fazer isso (não fazer silenciosamente sem avisar).

1. Abro/crio `Diario/<AAAA-MM-DD>.md` a partir de `Templates/Modelo -
   Sessao de Trabalho.md` (data de hoje).
2. Preencho: projeto(s) tocado(s) (linkando `[[Nome do Projeto]]`), o que foi
   feito, decisões tomadas, bloqueios, próxima ação — resumo real do que
   aconteceu na sessão, não genérico.
3. Se a nota do dia já existir (segunda sessão no mesmo dia), **acrescento**,
   não sobrescrevo o que já está lá.

## Procedimento 3 — Atualizar/criar nota de projeto

Gatilho: um projeto ativo (ex. o dashboard Vagem-Palma) teve avanço relevante
e o usuário quer isso refletido na nota de projeto (fica em `Minhas Notas/`
do tema correspondente).

1. Se a nota do projeto já existe, faço **Edit** incremental: atualizo
   "Estado atual", adiciono "Decisões-chave" novas, atualizo "Próximos
   passos" (marca `[x]` o que foi concluído, adiciona `[ ]` novo).
2. Se não existe ainda, crio a partir de `Templates/Modelo - Projeto.md`,
   dentro do `Minhas Notas/` do tema certo.
3. Linko a sessão de diário do dia em "Sessões de trabalho".
4. Se decisões novas vieram de artigos/ideias específicas, linko essas
   notas em "Notas relacionadas".

## O que eu NUNCA faço sem pedir

- Sobrescrever "Minhas ideias ao ler" ou o corpo de uma nota de ideia já
  escrita pelo usuário.
- Apagar/mover notas de `Minhas Notas/` ou `Artigos/` (são propriedade
  intelectual do usuário — só ele arquiva/deleta).
- Renomear a pasta do vault ou mudar a convenção de frontmatter
  (`tags`/`data`) sem ele pedir.
- Criar nota de ideia em lote/automaticamente a partir de um PDF sem
  confirmação de qual ideia específica deve virar nota.
- Criar uma pasta de tema novo sem confirmar com o usuário que é mesmo um
  tema novo (e não algo que já existe com outro nome).
- Rodar o Procedimento 0 (alertas) sem o usuário pedir naquela sessão —
  nunca faço isso "de fundo"/agendado sem confirmação explícita.
- Mandar, apagar, arquivar ou marcar e-mail como lido/não lido — no Gmail
  eu só leio (`search_threads`/`get_thread`) e aplico o label
  "Processado-SecondBrain" (`label_thread`).
- Tratar este vault e o vault `OBSIDIAN/` como se fossem o mesmo — são
  independentes desde 2026-09-15; não copio/sincronizo notas entre eles sem
  o usuário pedir explicitamente.

## Quando NÃO usar este skill

- Pra trabalho de código/dashboard em si (isso segue as instruções normais
  do projeto, ex. `DASHBOARD-VAGEM/`) — este skill só entra quando o pedido é
  especificamente sobre gerenciar o vault/literatura/diário do Second Brain.
- Se o usuário pedir uma organização diferente da que já está no vault —
  não proponho trocar o sistema sem ele pedir explicitamente.
- Se o usuário estiver claramente falando do vault `OBSIDIAN/` (outra pasta,
  outro sistema) — nesse caso é o skill global equivalente que entra, não
  este.
