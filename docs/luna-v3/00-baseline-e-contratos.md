# Ticket — Estabelecer baseline e contratos de regressão

## Objetivo

Congelar o comportamento que deve ser preservado e reproduzir as três falhas centrais antes de alterar arquitetura.

## Trabalho

1. Partir da branch `codex/enriquece-perfis-institucionais`, commit `6e2fa14` ou posterior.
2. Rodar `npm test` e `npm run build`.
3. Criar fixtures contrastantes:
   - escola para benchmarking de formação dual;
   - pesquisador para palestra sobre IA na indústria;
   - organização para parceria em economia circular;
   - contexto vago com respostas “não sei ainda”.
4. Registrar regressões para:
   - mesma sequência de perguntas apesar de respostas distintas;
   - candidatos excessivamente semelhantes ou rastreabilidade insuficiente;
   - duplicatas de pesquisadores e SENAI/SENAC no catálogo/pool;
   - Radar retornando `curated-fallback`.
5. Consolidar contratos de `Question`, `InterviewState`, `SelectionBrief`, `SelectionResult`, trace e item do Radar.
6. Fixar a invariável de que pesquisadores não possuem nem renderizam mídia de perfil.

## Aceite

- fixtures falham pelo motivo esperado antes da implementação;
- testes existentes continuam verdes;
- contratos distinguem `riskControl` de exposição ao risco;
- trace prevê tamanho do catálogo, elegíveis, avaliados, retornados e motivos de exclusão;
- nenhum arquivo temporário de coleta de imagens entra no commit.

## Próximo desbloqueio

Desbloqueia entrevista adaptativa, catálogos canônicos e Radar real.
