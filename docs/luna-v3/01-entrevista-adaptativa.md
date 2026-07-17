# Ticket — Tornar a entrevista semanticamente adaptativa

## Objetivo

Fazer a próxima pergunta nascer do significado da última resposta e das lacunas ainda relevantes, mantendo limites claros para um usuário leigo.

## Implementação

1. Criar contrato `AiProvider` e adapters `openai`, `openrouter` e `local-fallback`.
2. Implementar `POST /api/selection/interview/next`, autenticado e com rate limit próprio.
3. Enviar somente estado transitório: categoria, objetivo, histórico, última resposta, cobertura, incertezas e limites.
4. Exigir JSON estruturado com:
   - `questionId`, `prompt`, `helper`, `example`, `answerKind`;
   - `reasonTag`, `dimensionsCovered`, `factsExtracted`, `remainingGaps`;
   - `shouldStop` e justificativa curta.
5. Validar no servidor pergunta repetida, tamanho, dimensão permitida, schema, mínimo de 8 e máximo de 20 perguntas.
6. Regras determinísticas decidem obrigatoriedade e segurança; a IA escolhe aprofundamento e redação.
7. Respostas vagas geram descoberta guiada. Respostas completas pulam perguntas redundantes.
8. O exemplo usa as palavras e o cenário já fornecidos; fallback é específico para categoria + objetivo.
9. Frontend chama o endpoint após cada resposta, mostra carregamento, permite voltar/revisar e mantém tudo apenas em memória.
10. Timeout, schema inválido, rate limit ou ausência de chave acionam o planejador local sem interromper o fluxo.

## Segurança e custo

- nunca enviar catálogo inteiro para gerar perguntas;
- não registrar respostas completas, prompt integral ou chain-of-thought;
- configurar timeout, máximo de tokens, teto de chamadas e rastreabilidade de provider/modelo;
- nenhuma chave com prefixo `VITE_`.

## Testes de aceite

- escola + benchmarking e pesquisador + palestra produzem perguntas e exemplos diferentes;
- contexto de economia circular não recebe exemplo de IA industrial;
- resposta que já contém público, prazo e formato evita três perguntas redundantes;
- “não sei ainda” gera uma pergunta simples de descoberta;
- revisão de resposta recalcula cobertura sem reiniciar;
- fluxo sempre termina entre 8 e 20 perguntas;
- falha do provider continua pelo fallback local e aparece na trace.
