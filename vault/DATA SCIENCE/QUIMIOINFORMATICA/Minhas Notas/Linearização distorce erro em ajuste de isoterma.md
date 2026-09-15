---
tags: [permanente, quimiometria, estatistica]
data: 2026-09-14
---

# Linearização distorce erro em ajuste de isoterma

## A ideia
Linearizar um modelo não-linear pra poder usar regressão linear simples (ex. Ce/Qe vs. Ce na isoterma de Langmuir) não é neutro estatisticamente — a transformação distorce a estrutura do erro, porque o ruído experimental deixa de ser homogêneo depois de dividir/inverter variáveis. Um R² baixo no ajuste linearizado pode ser puramente artefato do método, não evidência de que o modelo não se aplica àquele sistema.

Confirmado empiricamente: mesmo conjunto de pontos experimentais (Ce, Qe) — Langmuir linearizado deu R²=0,03 (aparenta péssimo ajuste); Langmuir ajustado por regressão não-linear direta (`scipy.optimize.curve_fit`) nos mesmos pontos deu R²=0,87. Os dados eram bons o tempo todo; o método de ajuste que era ruim.

## Por que isso importa
Regra prática: nunca descartar um modelo de isoterma/cinética só porque a versão linearizada deu R² ruim. Sempre confirmar com ajuste não-linear direto antes de concluir que o modelo não descreve o sistema. Isso vale pra qualquer modelo classicamente "linearizado" na literatura de adsorção (Langmuir, Freundlich, pseudo-1ª/2ª ordem).

## Fontes
- [[Dashboard Vagem-Palma]] — achado saiu da análise de ajuste não-linear (bloco Vagem/Base/15°C)

## Relacionadas
- [[Bioadsorção]]
