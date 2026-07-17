# Ticket — Aprofundar avaliação e diferenciação da shortlist

## Objetivo

Transformar o briefing adaptativo em uma shortlist de 5 a 10 possibilidades materialmente diferentes, com notas reconstruíveis e trade-offs claros.

## Implementação

1. Gerar `SelectionBrief` com requisitos, preferências, restrições eliminatórias, incertezas e evidências desejadas.
2. Derivar pesos dentro de faixas controladas, sem pedir percentuais ao usuário.
3. Aplicar filtros eliminatórios e risco grave antes da avaliação profunda.
4. Pré-classificar todo o catálogo e enviar apenas 20–30 candidatos por lotes pequenos ao provider.
5. Avaliar subcritérios das seis dimensões: impacto, alinhamento, credibilidade, colaboração, viabilidade e risco controlado.
6. Validar evidências contra campos/URLs do catálogo e recalcular totais no servidor.
7. Registrar provider, modelo, lotes, custo estimado, regras, pesos, lacunas e confiança.
8. Diversificar sem sacrificar fit: abordagem, geografia, instituição, contribuição e perspectiva.
9. Retornar 5–10 quando houver elegíveis. Se houver menos de cinco, explicar a restrição e oferecer revisão; nunca reintroduzir eliminado ou risco grave.
10. Explicar como cada candidato difere dos demais, não apenas por que é bom.
11. Manter matriz valor estratégico × viabilidade, radar comparativo dos cinco primeiros e radar individual para toda a shortlist.

## Testes de aceite

- economia circular e IA industrial produzem briefings, pesos e rankings diferentes;
- duplicação de notas não esconde candidatos na matriz ou no radar;
- risco grave confirmado zera valor estratégico;
- shortlist respeita 5–10 e diversidade auditável;
- fallback local continua funcional;
- avaliador técnico reconstrói cada nota usando a trace exibida.
