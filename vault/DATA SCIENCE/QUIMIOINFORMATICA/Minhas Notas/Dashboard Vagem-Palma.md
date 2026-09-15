---
tags: [projeto, quimiometria, bioadsorcao]
data: 2026-09-14
status: ativo
---

# Dashboard Vagem-Palma

> [!info] Status
> **Status:** ativo
> **Início:** 2026-09-10
> **Repositório:** https://github.com/willpine1992/CHEMOMETRICS-PALMA-VAGEM
> **Dashboard ao vivo:** https://willpine1992.github.io/CHEMOMETRICS-PALMA-VAGEM/

## Objetivo
Dashboard de análise de dados para o estudo de bioadsorção de azul de metileno usando fibras de **Vagem** e **Palma**, cada uma em 3 tratamentos (In natura, Ácido/H₃PO₄, Base/NaOH). Quatro frentes de análise sobre o mesmo dataset experimental.

## Estado atual
Pipeline completo rodando: ETL (Google Drive → SQLite com validação de schema) alimentando 4 módulos de análise + dashboard publicado.

## Decisões-chave
- **RSM**: modelo quadrático completo é matematicamente singular no dataset OFAT (colinearidade estrutural, ex. massa×tempo r=−0,89) — seleção de termos por VIF foi necessária, não opcional.
- **Isotermas**: linearização de Langmuir pode distorcer o R² (ex. 0,03 → 0,87 ao trocar pra ajuste não-linear direto nos mesmos dados). Ver [[Linearização distorce erro em ajuste de isoterma]].
- **DFT**: escopo limitado a cálculo estático (sem Dinâmica Molecular) por custo computacional em hardware local — celulose modelada via monômero (glicopiranose), não o polímero inteiro.
- **Achado interessante**: HOMO do alcóxido (proxy do tratamento Base/NaOH) sobe de ≈−7 eV pra −0,645 eV — muito mais nucleofílico, consistente com melhor interação com o corante catiônico. Conecta achado computacional com padrão já visto nas isotermas experimentais.

## Notas relacionadas
- Área: [[Quimiometria]]
- Permanentes: [[Linearização distorce erro em ajuste de isoterma]]

## Sessões de trabalho
- [[2026-09-14]]

## Próximos passos
- [ ] Estender ML/RSM pra Palma (hoje só Vagem/Ácido é modelado)
- [ ] Popular `Artigos/` (dentro de DATA SCIENCE/QUIMIOINFORMATICA) com os artigos de referência usados pras isotermas/cinética/DFT
