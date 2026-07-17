# Handoff de execução — Luna v3

## Missão

Executar o mapa em `docs/PLANO-PRODUTO-LUNA-v3.md`, começando por `docs/luna-v3/00-baseline-e-contratos.md` e avançando pelos desbloqueios. Não retomar ondas antigas de fotos.

## Ponto de partida

- Repositório: `https://github.com/Kaluanbernardo/senai-parceiros`
- Branch: `codex/enriquece-perfis-institucionais`
- Commit-base validado: `a7f5669` (`docs: prepara handoff azure e plano de continuidade`).
- Baseline + ondas incrementais: 63 testes aprovados e build Vite aprovado em 17/07/2026.
- Preview conhecido: `https://senai-parceiros-4i3egoozj-kaluanbernardos-projects.vercel.app`
- Produção não deve ser publicada sem solicitação explícita.

## Documentos de continuidade

- Plano canônico: [`docs/PLANO-PRODUTO-LUNA-v3.md`](./PLANO-PRODUTO-LUNA-v3.md).
- Runbook de infraestrutura, segurança, backup e migração: [`docs/AZURE-HANDOFF-RUNBOOK.md`](./AZURE-HANDOFF-RUNBOOK.md).
- Contrato de importação: [`docs/luna-v3/03b-importacao-xlsx.md`](./luna-v3/03b-importacao-xlsx.md).

## Prioridade do Luna

1. baseline e fixtures de regressão;
2. entrevista semanticamente adaptativa;
3. avaliação e shortlist mais diferenciadas;
4. catálogos canônicos de pesquisadores e escolas;
5. importação XLSX integrada ao Gerador de Prompt;
6. thin slice real do Radar;
7. Configuração corporativa do armazenamento e autenticação, mantendo adapters substituíveis.
8. XLSX, remoção de exportadores legados e hardening Azure.

Catálogos, importador XLSX e Radar podem evoluir em paralelo, mas não devem regredir a entrevista e a seleção, que são a feature principal.

## Regras invioláveis

1. Preservar React, Vite e MUI; evoluir incrementalmente.
2. Não persistir respostas, resultados ou prompts completos da seleção.
3. Nunca imprimir, versionar ou expor chaves. Não usar `VITE_` para segredos.
4. Usar OpenAI Platform somente se houver chave de API faturada; assinatura ChatGPT não equivale a API. Caso contrário, usar OpenRouter com `openrouter/auto`.
5. Manter fallback local para entrevista e avaliação.
6. Não recomendar fora do catálogo e não completar cinco com candidato eliminado ou risco grave.
7. Não expor chain-of-thought; registrar apenas justificativas e reason tags estruturados.
8. Pesquisadores nunca exibem foto, avatar, iniciais ou placeholder de mídia e não possuem campos `foto`/`image`.
9. Scholar serve para verificação de identidade, não para coleta de fotos.
10. Importações são administrativas, usam schema compartilhado com o Gerador de Prompt e exigem prévia antes de persistir.
11. Nunca substituir o catálogo inteiro com o conteúdo de um arquivo nem gravar importações somente na memória do navegador.
12. Não adicionar scripts temporários, `.playwright-cli`, `output`, `tmp` ou arquivos exploratórios aos commits.
13. Preservar modificações locais não relacionadas, especialmente `scripts/collect-image-batch.ps1` e `src/data/apply_stake_desc_1.cjs`.
14. Publicar preview Vercel somente após testes, build, smoke e revisão do diff.

## Primeira sessão recomendada

1. Ler integralmente o plano canônico e o ticket de baseline.
2. Confirmar branch, commit e worktree sem alterar arquivos não relacionados.
3. Rodar testes e build.
4. Criar fixtures de escola/benchmarking, pesquisador/palestra, organização/parceria e contexto vago.
5. Fixar contratos e testes de regressão.
6. Fazer commit coeso do baseline.
7. Iniciar imediatamente a entrevista adaptativa se nenhum bloqueio real existir.

## Estado apos a execucao inicial

- Baseline, entrevista adaptativa, provider OpenAI/OpenRouter com fallback local e deduplicacao dos catalogos ja foram implementados nesta branch.
- A base de pesquisadores foi reduzida de 100 linhas legadas para 88 registros canonicos, com 12 aliases rastreaveis; escolas usam identidade canonica para evitar duplicatas de redes como SENAI e SENAC.
- O Gerador de Prompt já usa o contrato compartilhado `senai_catalog_v1`, exige as colunas do catálogo e oferece template XLSX; o painel admin possui prévia, confirmação por linha, deduplicação, idempotência, histórico e rollback. Os adapters `file` e `vercel_blob` tornam o lote durável quando configurados; o próximo Luna deve conectar a credencial corporativa e, depois, Azure Blob/Storage Table.
- O Radar já consome OpenAlex/Crossref e feeds RSS institucionais de Governo, OIT e UNESCO-UNEVOC, incluindo consultas direcionadas a pesquisadores cadastrados, com fallback curado, snapshot válido, status por fonte, adapter `vercel_blob` e refresh protegido (`/api/radar/refresh`) agendado em `vercel.json`.
- O uso de IA já tem teto server-only por dia (requisições, tokens e custo estimado), sem guardar prompts ou respostas; o contador suporta adapters `memory`, `file` e `vercel_blob`, e o próximo ambiente deve ligar uma implementação compartilhada/atômica corporativa.
- Próximo bloco recomendado: ligar armazenamento compartilhado privado para catálogo/Radar, configurar o segredo do cron, ampliar allowlist e executar o hardening Azure/Entra ID.
- O importador e o Gerador de Prompt continuam sendo um unico fluxo: uma planilha criada pelo prompt deve entrar na previa sem remapeamento manual, sem campos de foto/avatar e sem substituir o catalogo inteiro.

## Próximas ondas para execução

1. **Configuração corporativa (TI):** Blob privado no MVP, segredos server-only, Entra ID e mapeamento dos papéis `user`/`admin`.
2. **Operação compartilhada:** rate limit e orçamento em Redis/Storage com operação atômica, alertas de custo/erro e retenção de logs sem prompts ou respostas.
3. **Radar editorial:** ampliar e revisar a allowlist de fontes nacionais, estaduais e internacionais; manter quarentena, deduplicação, snapshot e refresh agendado.
4. **Calibração da seleção:** testar cenários reais de benchmarking, evento e parceria para comprovar perguntas adaptativas, diferenças entre candidatos e shortlist de 5–10 itens.
5. **QA de entrega:** executar smoke visual desktop/mobile no navegador corporativo, validar importação/replay/rollback, revisar diff e só então solicitar preview Vercel.

## Variáveis previstas

```text
AI_PROVIDER=openai|openrouter
OPENAI_API_KEY=
OPENAI_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_COST_QUALITY_TRADEOFF=7
RADAR_LIVE_SOURCES=true|false
RADAR_CRON_SECRET=
```

Valores nunca devem aparecer em documentação, saída, teste ou commit. O adapter corporativo futuro deve respeitar os mesmos contratos.

## Prompt direto para o Luna

> Leia integralmente `docs/PLANO-PRODUTO-LUNA-v3.md`, `docs/HANDOFF-LUNA-v3.md` e os tickets ainda pendentes. Retome na branch `codex/enriquece-perfis-institucionais` a partir do commit-base indicado acima, preservando todos os arquivos locais não relacionados. O baseline, entrevista adaptativa, catálogos canônicos, importação XLSX, Radar live, calibração da shortlist, adapters Azure e adapters privados Vercel Blob já estão implementados. Use TDD, não persista entrevistas/resultados da seleção, não exponha segredos e mantenha pesquisadores sem qualquer mídia de perfil. Priorize agora configurar Blob/Entra ID/rate limits, ampliar allowlist e concluir o runbook de handoff. Faça testes, build, smoke visual quando o navegador estiver disponível, revisão, commit e push por ticket; preview Vercel apenas depois dos gates locais.
