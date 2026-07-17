# Handoff de execução — Luna v3

## Missão

Executar o mapa em `docs/PLANO-PRODUTO-LUNA-v3.md`, começando por `docs/luna-v3/00-baseline-e-contratos.md` e avançando pelos desbloqueios. Não retomar ondas antigas de fotos.

## Ponto de partida

- Repositório: `https://github.com/Kaluanbernardo/senai-parceiros`
- Branch: `codex/enriquece-perfis-institucionais`
- HEAD atual publicado: o commit mais recente da branch `codex/enriquece-perfis-institucionais`; a implementação funcional deste ciclo inclui `5be03f8` (`feat: reidrata catalogo e fecha historico de importacoes`). Esse commit inclui a reidratação do catálogo persistido, o endpoint autenticado de catálogo e a interface de histórico/rollback de importações.
- Commit-base validado: `a7f5669` (`docs: prepara handoff azure e plano de continuidade`). Use o HEAD atual ao retomar; o commit-base é apenas a referência histórica do início deste ciclo.
- Baseline + ondas incrementais: 90 testes aprovados e build Vite aprovado em 17/07/2026.
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
7. Configuração corporativa do armazenamento, ativação do adapter Entra ID e autenticação, mantendo adapters substituíveis.
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
- A base de pesquisadores foi reduzida de 100 linhas legadas para 88 registros canonicos, com 12 aliases rastreaveis; escolas usam identidade canonica para evitar duplicatas de redes como SENAI e SENAC. A auditoria de produção também consolidou variantes multilíngues por domínio/país e deixou 154 registros escolares canônicos sem nomes normalizados repetidos.
- O Gerador de Prompt já usa o contrato compartilhado `senai_catalog_v1`, exige as colunas do catálogo e oferece template XLSX; o painel admin possui prévia, confirmação por linha, deduplicação, idempotência, histórico e rollback protegido contra alterações posteriores. O catálogo persistido é reidratado após autenticação e atualizações importadas são mescladas por identidade/ID sem duplicar a interface. Os adapters `file` e `vercel_blob` tornam o lote durável quando configurados; o próximo Luna deve conectar a credencial corporativa e, depois, Azure Blob/Storage Table.
- O Radar já consome OpenAlex/Crossref, feeds RSS e páginas HTML institucionais allowlisted de Governo, OIT, UNESCO-UNEVOC, INEP, FAPESP, OCDE, Cedefop e ETF, incluindo consultas direcionadas a pesquisadores cadastrados, com fallback curado, snapshot válido, status por fonte, feeds adicionais oficiais configuráveis por `RADAR_EXTRA_FEEDS_JSON`, adapter `vercel_blob` e refresh protegido (`/api/radar/refresh`) agendado em `vercel.json`.
- O uso de IA e os rate limits já têm adapters server-only `memory`, `file` e `vercel_blob`; os caminhos transacionais usam lock exclusivo ou CAS com retry, sem guardar prompts, respostas ou IP bruto. O adapter de alertas HTTPS sanitizados também está pronto, faltando apenas o endpoint corporativo.
- O endpoint administrativo `/api/admin/status` expõe somente flags de configuração e status dos stores para validação operacional; ele nunca retorna segredos, prompts, respostas ou IPs. O bloco `security.authProvider` mostra apenas o nome do provider ativo e `security.entraAdapter` mostra a prontidão segura do adapter (sem valores sensíveis); `handoff.mvp` informa se os gates mínimos do MVP estão configurados e `handoff.corporate.blockers` lista explicitamente o que ainda depende de TI. O mesmo conjunto de APIs, inclusive `POST /api/auth/entra`, é servido pelo `vite preview`, permitindo validar o artefato de produção localmente antes do Vercel.
- Último smoke visual do artefato de produção: Chromium desktop e mobile passaram por login, Home, Seleção adaptativa, Radar nas três seções e Gerador de Prompt, sem erros de console; o favicon foi incluído para eliminar o 404 do shell.
- O preflight executável `node scripts/handoff-preflight.mjs --profile=corporate` verifica provider, Entra, origem, stores duráveis/atômicos, alertas, cron, feeds e IA sem imprimir segredos; deve ser o primeiro gate após preencher o ambiente corporativo.
- O fallback curado do Radar foi validado para as três seções; a aba governamental mantém três itens oficiais quando uma fonte live falha, em vez de ficar vazia.
- Próximo bloco recomendado: registrar o aplicativo/grupos no tenant corporativo e ativar o adapter Entra ID, ligar armazenamento compartilhado privado para catálogo/Radar, configurar o segredo do cron e o webhook de alertas, e revisar o manifesto versionado de feeds.
- O importador e o Gerador de Prompt continuam sendo um unico fluxo: uma planilha criada pelo prompt deve entrar na previa sem remapeamento manual, sem campos de foto/avatar e sem substituir o catalogo inteiro.

## Próximas ondas para execução

1. **Configuração corporativa (TI):** Blob privado no MVP, segredos server-only, registro do aplicativo/grupos Entra ID e preenchimento das variáveis `ENTRA_*` para ativar `POST /api/auth/entra`.
2. **Operação compartilhada:** configurar os adapters duráveis/atômicos do MVP ou substituí-los por Redis/Storage corporativo, ativar alertas de custo/erro e manter retenção de logs sem prompts ou respostas.
3. **Radar editorial:** revisar o manifesto de feeds `2026-07-17.v1`, ampliar a allowlist de fontes nacionais, estaduais e internacionais quando aprovado, e manter quarentena, deduplicação, snapshot e refresh agendado.
4. **Calibração da seleção:** testar cenários reais de benchmarking, evento e parceria para comprovar perguntas adaptativas, diferenças entre candidatos e shortlist de 5–10 itens.
5. **Gate de importações futuras:** reutilizar aliases por domínio/país para novos registros e manter separados os escopos nacional, regional e local.
6. **QA de entrega:** executar smoke visual desktop/mobile no navegador corporativo, validar importação/replay/rollback e login Entra, revisar diff e só então solicitar preview Vercel.

### Critério específico da nova feature de importação

O Luna deve tratar a planilha XLSX produzida pelo Gerador de Prompt como uma entrada de catálogo de primeira classe: o prompt, o template, a prévia administrativa, a confirmação, a deduplicação, o histórico e o rollback precisam usar o mesmo contrato `senai_catalog_v1`. A planilha pode conter pesquisadores, escolas ou organizações; não pode conter fotos, avatares, credenciais ou dados privados. Reenviar a mesma planilha deve ser idempotente e nunca substituir o catálogo inteiro.

O round-trip só é considerado pronto quando as colunas `aderencia_contexto`, `relacao_publica`, `evidencias_publicas`, `riscos_sinais`, `confianca` e `dados_nao_localizados` chegam ao modelo canônico e influenciam a seleção sem remapeamento manual. O próximo Luna deve executar essa validação para `researcher`, `school` e `organization`.

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
AUTH_PROVIDER=local|entra
ENTRA_TENANT_ID=
ENTRA_CLIENT_ID=
ENTRA_ADMIN_GROUP_ID=
ENTRA_USER_GROUP_ID=
ENTRA_ISSUER=
ENTRA_JWKS_URL=
ENTRA_TRUST_PROXY_HEADERS=false
OPS_ALERT_WEBHOOK_URL=
OPS_ALERT_COOLDOWN_SECONDS=300
AI_ALERT_THRESHOLD=0.8
```

Valores nunca devem aparecer em documentação, saída, teste ou commit. O adapter corporativo futuro deve respeitar os mesmos contratos.

## Prompt direto para o Luna

> Leia integralmente `docs/PLANO-PRODUTO-LUNA-v3.md`, `docs/HANDOFF-LUNA-v3.md` e os tickets ainda pendentes. Retome na branch `codex/enriquece-perfis-institucionais` a partir do commit-base indicado acima, preservando todos os arquivos locais não relacionados. O baseline, entrevista adaptativa, catálogos canônicos, importação XLSX, Radar live, calibração da shortlist, adapters privados MVP (`file`/`vercel_blob`), operação atômica, alertas sanitizados e o adapter server-side Entra/OIDC (`server/lib/entra.js`, `POST /api/auth/entra`) já estão implementados. Ainda dependem de TI o registro do aplicativo/grupos no tenant, a escolha e configuração do armazenamento corporativo, o endpoint de alertas, o segredo do cron e a revisão final dos feeds definitivos. Use TDD, não persista entrevistas/resultados da seleção, não exponha segredos e mantenha pesquisadores sem qualquer mídia de perfil. Priorize agora concluir a configuração corporativa documentada e validar o runbook de handoff. Faça testes, build, smoke visual quando o navegador estiver disponível, revisão, commit e push por ticket; preview Vercel apenas depois dos gates locais.
