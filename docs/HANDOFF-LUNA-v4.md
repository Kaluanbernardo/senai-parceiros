# Handoff de execução — Luna v4

## Missão desta rodada

Implementar os três feedbacks de 17/07/2026, nesta ordem de prioridade:

1. fazer cada próxima pergunta da seleção ser realmente gerada por IA e semanticamente dependente de todo o histórico;
2. fazer o Radar governamental ler fontes oficiais atuais, começando pelo DOU diário, com Tavily como fallback do MVP;
3. substituir os textos genéricos das pesquisas por resumos curtos baseados no abstract, sem repetir autor e data.

Este documento foi produzido como planejamento. Nenhuma implementação ou chave foi configurada nesta etapa.

## Ponto de partida verificado

- Repositório local: `C:\Users\sn1096448\Desktop\senai-parceiros`.
- Branch: `codex/enriquece-perfis-institucionais`.
- HEAD no diagnóstico: `f29a8ca` (`fix: torna radar e entrevista contextuais`).
- Há arquivos locais não relacionados e artefatos temporários no worktree. Preservá-los e não incluí-los nos commits desta rodada.
- O MVP continua externo no Vercel. Azure, Entra e providers internos continuam sendo destino futuro, não bloqueio atual.
- A seleção de stakeholders continua sendo a feature principal; Radar é secundário.

## Regras invioláveis

1. Nunca versionar, imprimir ou devolver chaves. Nenhum segredo pode usar prefixo `VITE_`.
2. Respostas, prompts completos, shortlist e rastreabilidade da seleção continuam somente em memória durante a sessão; não persistir.
3. OpenRouter e Tavily são adapters do MVP, não dependências do domínio.
4. Manter fallback local para disponibilidade, mas nunca apresentá-lo como pergunta gerada por IA.
5. Metadados oficiais, título, URL e data não podem depender de IA.
6. IA pode resumir e classificar apenas evidências recuperadas; não pode inventar método, resultado ou impacto.
7. `GET /api/radar/items` deve ler somente o snapshot. Rede externa roda apenas no refresh protegido/agendado.
8. Falha parcial de fonte não apaga o último snapshot válido nem derruba outras seções.
9. Pesquisadores continuam sem foto, avatar ou placeholder de mídia.
10. Antes de preview/deploy: testes, build, preflight, smoke e revisão do diff.

## Diagnóstico 1 — entrevista ainda não usa IA na prática

### Evidências no código

- `src/pages/SelectionPage.jsx` pré-calcula `InterviewPlanner.next()` e silencia erros da rota.
- `api/selection/interview-next.js` converte ausência/falha do provider em HTTP 200 com `semantic-planner-v2`.
- `server/lib/interviewProvider.js` já implementa OpenRouter com JSON Schema, mas a credencial não está configurada no runtime local diagnosticado.
- `.env.local` seleciona OpenRouter, mas não contém uma chave ativa. Não registrar nem copiar a futura chave para o repositório.
- O histórico atual não preserva de forma confiável o texto real de todas as perguntas dinâmicas.
- `coverageFor()` considera somente IDs do `QUESTION_BANK`; perguntas geradas podem não contar na cobertura.
- A IA pode criar IDs arbitrários, enquanto `InterviewPlanner.finalize()` e o ranking dependem de campos canônicos.
- `factsExtracted` e `remainingGaps` voltam na resposta, mas não formam memória transitória útil para a próxima rodada.

### Resultado esperado

Depois de cada resposta, a rota deve enviar o transcript transitório completo ao provider e receber uma pergunta integralmente gerada para aquele contexto. Regras determinísticas controlam campos obrigatórios, segurança, mínimo de 8, máximo de 20 e encerramento; a IA escolhe o melhor aprofundamento e redige pergunta, ajuda e exemplo.

## Arquitetura-alvo da IA

Criar um módulo profundo de geração estruturada, reutilizável pela entrevista e pelos resumos do Radar:

```text
StructuredGeneration.generate({
  task,
  schema,
  messages,
  maxOutputTokens,
  signal
}) -> { data, trace }
```

Adapters reais:

- OpenRouter no MVP;
- OpenAI Platform opcional;
- Azure OpenAI/provider interno no handoff futuro;
- mock em memória para testes.

O módulo deve esconder seleção de provider, headers, modelo, structured output, timeout, parsing, erros sanitizados e metadados de uso. Não expor detalhes do provider às regras de entrevista ou do Radar.

Arquivos previstos:

- criar `server/lib/structuredGeneration.js` e testes;
- refatorar `server/lib/interviewProvider.js` para usar esse módulo;
- manter `server/lib/ai.js` como fachada compatível ou absorver sua responsabilidade sem quebrar a avaliação existente;
- atualizar `.env.example`, `server/lib/operationalStatus.js` e `server/lib/handoffPreflight.js` somente com flags seguras.

## Onda 0 — configuração segura e prova do provider

1. Configurar no Vercel, em Preview e depois Production somente quando autorizado:

   ```text
   AI_PROVIDER=openrouter
   OPENROUTER_API_KEY=<secret server-only>
   OPENROUTER_MODEL=openrouter/auto
   OPENROUTER_COST_QUALITY_TRADEOFF=7
   OPENROUTER_SITE_URL=<deployment origin>
   OPENROUTER_APP_NAME=SENAI-SP Parceiros
   ```

2. A chave deve ser criada no OpenRouter com teto próprio de gastos. Manter também os limites de `server/lib/usageBudget.js`.
3. Fazer um smoke server-side com saída estruturada; nunca devolver a chave, prompt completo ou resposta bruta.
4. Manter `response_format=json_schema`, schema estrito, `provider.require_parameters=true`, temperatura baixa, limite de 600–800 tokens e timeout total de 18 segundos.
5. O preflight MVP deve falhar se `AI_PROVIDER=openrouter` e a chave não estiver configurada.
6. O status administrativo mostra somente `configured`, provider, último resultado sanitizado e contadores agregados.

Se `openrouter/auto` não conseguir cumprir o schema, registrar `invalid_output` e usar fallback local. Não mascarar a falha. Um modelo explícito compatível só deve substituir o Auto Router após evidência no smoke.

## Onda 1 — entrevista realmente adaptativa

### Contrato da próxima rodada

Entrada transitória:

```text
category
objective
transcript[]: turn, displayedQuestion, answer, targetField, dimensions
coveredFields[]
remainingRequiredFields[]
semanticFacts[]
remainingGaps[]
limits: minQuestions, maxQuestions, aggregateCharacters
```

Saída estruturada:

```text
shouldStop
stopReason
targetField
prompt
helper
example
answerKind
reasonTag
dimensionsCovered[]
factsExtracted[]
remainingGaps[]
adaptationExplanation
```

Regras:

- `targetField` deve pertencer ao conjunto canônico elegível do brief e do ranking.
- O servidor cria o ID estável da pergunta a partir de turno + campo-alvo; não confiar em ID inventado pelo modelo.
- O transcript guarda exatamente a pergunta exibida, não só o ID.
- A resposta da pergunta dinâmica deve preencher o campo canônico correspondente em `finalize()`.
- Cobertura deve usar primeiro `state.questionDefinitions[id]` e apenas depois o banco fixo.
- `semanticFacts` e `remainingGaps` permanecem apenas no estado em memória e são enviados à rodada seguinte.
- Resposta que já cobre público, prazo ou formato deve eliminar perguntas redundantes.
- Resposta vaga deve gerar descoberta simples; resposta rica deve gerar aprofundamento específico.
- A IA não encerra antes de 8 perguntas nem com campo obrigatório ausente; o servidor encerra obrigatoriamente até 20.
- Limite agregado recomendado para o transcript: 24.000 caracteres.

### UX e rastreabilidade

- `src/pages/SelectionPage.jsx` não deve fingir que o fallback foi IA.
- Mostrar estado discreto “Pergunta gerada por IA” quando `provider=openrouter` e `fallback=false`.
- Em falha, mostrar “IA indisponível; roteiro local em uso”, com ações “Tentar novamente” e “Continuar localmente”.
- Registrar em memória, para o relatório/planilha, provider, modelo, modo, campo-alvo, dimensões, reason tag e justificativa pública curta; nunca chain-of-thought.
- Padronizar falhas: `ai_not_configured`, `budget_exceeded`, `provider_timeout`, `provider_4xx`, `provider_5xx`, `invalid_output`.

### Aceite da entrevista

- Com a chave ativa, a próxima pergunta chega com `provider=openrouter`, `fallback=false` e modelo efetivamente escolhido.
- Duas respostas semanticamente diferentes, com mesma categoria e objetivo, geram perguntas materialmente diferentes, e não apenas exemplos diferentes.
- Pergunta, ajuda e exemplo usam o contexto fornecido.
- O transcript contém todas as perguntas/respostas anteriores dentro dos limites.
- Cada pergunta gerada preenche um campo canônico que influencia brief e ranking.
- Fluxo termina entre 8 e 20 perguntas, sem duplicidade.
- Ausência da chave, timeout, 429 ou orçamento esgotado ativa fallback visível e mantém o fluxo funcional.

### Testes da entrevista

- `server/lib/interviewProvider.test.js`: transcript, schema, headers, limites, timeout, 401, 429, 5xx, JSON inválido e campo inelegível.
- criar/expandir teste da rota `api/selection/interview-next.js`: pergunta do provider chega intacta ao estado e ao frontend; cobertura inclui perguntas dinâmicas.
- `src/domain/interviewPlanner.test.js`: texto real no transcript, resposta adaptativa no brief e ausência de duplicidade.
- smoke real opcional, habilitado apenas por variável server-side e fora da suíte padrão.

## Diagnóstico 2 — Radar governamental não lê o DOU

- O DOU está somente em `RADAR_SOURCE_POLICY`; não existe adapter de coleta.
- `RADAR_WEB_POLICY` cobre poucas páginas e o parser HTML genérico por regex é frágil.
- `GET /api/radar/items` atualmente pode disparar rede externa.
- A deduplicação descarta a segunda ocorrência em vez de unir evidências e proveniências.
- Uma fonte saudável sem novidades pode parecer falha.
- Seeds curados ainda podem aparecer como fallback de produção.
- O cron roda 09:00 UTC/06:00 BRT, possivelmente cedo para a edição diária estável.

## Arquitetura-alvo do Radar governamental

Manter `server/lib/radar.js` como fachada e extrair módulos:

```text
server/lib/radar/
  contracts.js
  sourceRegistry.js
  pipeline.js
  summaries.js
  sources/
    dou.js
    institutional.js
    feed.js
  web/
    directOfficial.js
    tavily.js
```

Não criar stubs vazios de OpenAI/Gemini. Documentar adapters futuros que cumprirão os mesmos contratos quando forem implementados.

Interfaces internas:

```text
RadarDiscoveryProvider.discover({ query, domains, startDate, endDate, maxResults })
RadarContentProvider.retrieve({ urls, focus })
```

Adapters:

- `DirectOfficialWebProvider`: caminho primário para DOU e páginas estáveis;
- `TavilyWebProvider`: fallback do MVP;
- mock em memória para testes;
- futuros `OpenAIWebProvider` e `GeminiWebProvider`, sem mudar domínio, UI ou store.

Pipeline:

```text
descobrir
→ validar domínio/data
→ extrair conteúdo
→ normalizar metadados
→ gate EPT/indústria/SP
→ resumir/classificar
→ mesclar duplicatas e proveniências
→ publicar ou quarentena
→ atualizar checkpoint e snapshot por seção
```

## Onda 2 — DOU diário e Tavily

### Fonte oficial primária

A Imprensa Nacional permite leitura por data e seção em `leiturajornal?data=DD-MM-YYYY&secao=DO1|DO3`, seguida das páginas ato-a-ato. Usar:

- DO1 para atos normativos;
- DO3 apenas para editais, convênios, chamadas e oportunidades relevantes;
- DO2 fora do MVP para reduzir ruído de pessoal;
- fuso `America/Sao_Paulo`;
- janela de hoje + dois dias anteriores para recuperar atrasos, feriados e edições extras.

O XML oficial mensal serve para backfill e auditoria, não para o radar diário.

Modelo mínimo de um ato:

```text
externalId: dou:<articleId>
sourceName: Diário Oficial da União
sourceUrl
publishedAt
title
summaryPt
contentType
official: true
provider: direct-official | tavily
provenance: articleId, edition, section, page, organ,
            discoveredAt, extractedAt, extractionProvider, contentHash
```

### Tavily como fallback

- Usar Tavily Search restrito a domínios oficiais e sem resposta sintética genérica.
- Usar Tavily Extract apenas para URLs HTTPS previamente validadas.
- Para DOU, aceitar somente `in.gov.br` e caminho de ato do DOU.
- Registrar Tavily como provedor de coleta; a fonte continua sendo a instituição oficial.
- Limitar consultas, URLs por lote, tamanho, redirects e timeout.
- Tratar conteúdo externo como não confiável e resistente a prompt injection.
- Nunca enviar chave na URL, browser, resposta ou log.

Variáveis previstas:

```text
RADAR_DOU_ENABLED=true
RADAR_DOU_SECTIONS=DO1,DO3
RADAR_DOU_TIMEZONE=America/Sao_Paulo
RADAR_DOU_LOOKBACK_DAYS=3
RADAR_DISCOVERY_PROVIDER=direct
RADAR_EXTRACT_PROVIDER=tavily
TAVILY_API_KEY=<secret server-only>
TAVILY_SEARCH_DEPTH=advanced
TAVILY_MAX_RESULTS=20
TAVILY_DAILY_CREDIT_LIMIT=<definir após observar o MVP>
RADAR_SUMMARY_PROVIDER=openrouter
```

### Elegibilidade e importância

Publicar somente quando houver:

- relação direta com educação profissional, tecnológica, técnica, aprendizagem ou qualificação; ou
- relação conjunta entre indústria/trabalho e competências/formação; ou
- referência direta a SENAI, Sistema S, SETEC, Rede Federal, Centro Paula Souza ou impacto material em São Paulo.

Score temático proposto:

- aderência direta à EPT: até 25;
- indústria, trabalho e competências: até 15;
- impacto/materialidade para SENAI-SP ou São Paulo: até 10;
- recência: até 30;
- qualidade da fonte: até 20.

Triagem:

- publicar: temática >= 25 e total >= 65;
- quarentena: total 50–64 ou baixa confiança;
- descartar: abaixo de 50 ou sem gate de elegibilidade.

Atos rotineiros de pessoal, compras sem relação temática e simples menções devem ser excluídos.

### Snapshot e agendamento

- `api/radar/items.js` sempre chama `getRadarItems({ live: false })`; filtros operam sobre snapshot.
- Apenas `api/radar/refresh.js` consulta fontes externas.
- Atualizar o snapshot por seção: falha do Governo não deve impedir Pesquisa/Internacional nem apagar o snapshot governamental anterior.
- Uma fonte que respondeu corretamente com zero itens é `ok` com contagem zero; fim de semana/feriado sem edição é `no_edition`.
- O mesmo dia é idempotente e checkpoints só avançam após persistência.
- Mudar o cron inicial para 12:00 UTC/09:00 BRT; manter refresh admin para reexecução.
- No Azure, trocar apenas scheduler/store/adapters, usando Timer Trigger e segredos no Key Vault.

### Aceite governamental

- O Radar mostra atos do DOU do dia quando houver itens materialmente relevantes.
- Cada ato tem URL oficial, data, órgão, seção, tipo e resumo substantivo.
- DO1 e DO3 são processados e atos irrelevantes não aparecem.
- Tavily assume automaticamente quando a extração direta falha.
- Duplicatas direta/Tavily aparecem uma vez com proveniências combinadas.
- `GET /api/radar/items` executa zero chamadas externas.
- Falhas preservam o último snapshot e aparecem no status operacional sem expor segredos.
- Seeds não são apresentados como novidades atuais em produção.

## Diagnóstico 3 — “resumos” acadêmicos repetem metadados

- `openAlexItem()` em `server/lib/radar.js` escreve “Pesquisa de [autores], publicada em [data]...”.
- OpenAlex não solicita `abstract_inverted_index`.
- Crossref/OCDE não aproveitam `abstract` e usam texto genérico.
- `src/pages/RadarPage.jsx` já mostra autores e data em campos próprios; o resumo repete ambos.
- A deduplicação pode manter a versão sem abstract e descartar outra mais rica.

## Onda 3 — abstracts acadêmicos úteis

Criar `server/lib/radar/summaries.js` com funções puras para:

- reconstruir `abstract_inverted_index` do OpenAlex;
- extrair e limpar abstract HTML/JATS do Crossref;
- normalizar texto;
- mesclar versões da mesma pesquisa por DOI/OpenAlex ID;
- validar resumo final;
- produzir fallback baseado em evidência.

Fluxo:

```text
coletar metadados
→ mesclar duplicatas e escolher melhor evidência
→ obter/reconstruir abstract
→ resumir/traduzir opcionalmente
→ validar
→ persistir snapshot
```

Ordem de evidência:

1. abstract real da fonte;
2. resumo anteriormente gerado com mesmo hash;
3. descrição institucional;
4. indisponibilidade explícita.

Contrato editorial:

- português brasileiro;
- 2–3 frases, aproximadamente 45–80 palavras;
- explicar objetivo, abordagem/escopo e achado/contribuição somente quando presentes;
- não mencionar autor, data, periódico ou “consulte a fonte”;
- não repetir o título;
- não inventar método ou conclusão ausente.

Adicionar ao item normalizado:

```text
summaryStatus: source | ai | extractive | unavailable
summaryInputHash
summaryUpdatedAt
summaryProvenance: source, provider, model
```

Reutilizar resumo quando o hash não mudar. Registrar orçamento separado em `usageBudget` como `radar-summary`. Processar 5–8 abstracts por chamada.

Fallback:

1. resumo em português gerado do abstract;
2. duas primeiras frases úteis do abstract original;
3. abstract original identificado como tal;
4. “A fonte não disponibilizou resumo deste trabalho”.

Nunca voltar ao template com autor/data nem criar abstract apenas com título e tópicos.

### UX dos abstracts

- Em `src/pages/RadarPage.jsx`, rotular o bloco como “Em poucas palavras”.
- Autor e data ficam somente nos metadados.
- Estado sem abstract deve ser discreto, sem parágrafo de preenchimento.
- Se necessário, extrair `src/components/RadarItemCard.jsx` para manter a página legível.

### Aceite dos abstracts

- Pesquisa com abstract exibe resumo factual de 2–3 frases.
- Nenhum resumo começa com “Pesquisa de”, “publicada em”, “Metadados DOI” ou equivalente.
- Autor e data aparecem uma única vez.
- Ausência de abstract é explícita e nunca preenchida com invenção.
- Mesmo hash não consome novos tokens.
- Falha de IA não impede o Radar de carregar.

## Estratégia de paralelização para o Luna

Após a Onda 0:

- agente A: entrevista adaptativa e testes, sem tocar no Radar;
- agente B: criar adapters DOU/Tavily e fixtures, sem integrar `server/lib/radar.js`;
- agente C: criar módulo de abstracts/merge e testes, sem integrar `server/lib/radar.js`;
- agente principal: integrar B e C na fachada do Radar, mudar snapshot/API/cron, revisar segurança e executar gates.

Essa divisão evita conflitos no monólito atual `server/lib/radar.js`.

## Gates de execução

1. Testes unitários e de integração de cada onda.
2. `npm test`.
3. `npm run build`.
4. `npm run handoff:preflight:mvp`.
5. Verificar que o bundle não contém `OPENROUTER_API_KEY`, `TAVILY_API_KEY` nem valores de segredo.
6. Smoke em Preview Vercel:
   - duas entrevistas com mesma configuração e respostas semanticamente distintas;
   - fallback visível com provider desabilitado;
   - Radar carregando sem rede externa no GET;
   - refresh encontrando DOU relevante ou registrando `no_edition` corretamente;
   - abstracts sem repetição de autor/data;
   - desktop e mobile sem erros de console.
7. Revisão do diff preservando arquivos locais não relacionados.
8. Commit e push por onda. Preview primeiro; Production somente com autorização explícita.

## Fontes técnicas para a implementação

- [Base de dados oficial do DOU](https://in.gov.br/web/guest/acesso-a-informacao/dados-abertos/base-de-dados)
- [Serviço oficial de acesso ao DOU](https://www.gov.br/pt-br/servicos/acessar-o-diario-oficial-da-uniao)
- [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search)
- [Tavily Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract)
- [OpenRouter Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [OpenRouter Auto Router](https://openrouter.ai/docs/guides/routing/routers/auto-router)
- [OpenAI Web Search — adapter futuro](https://developers.openai.com/api/docs/guides/tools-web-search)
- [Gemini URL Context — adapter futuro](https://ai.google.dev/gemini-api/docs/url-context)

## Prompt direto para o Luna

> Leia integralmente `docs/HANDOFF-LUNA-v4.md` e execute as Ondas 0 e 1 primeiro. Não use nem versiona nenhuma chave fornecida no chat; oriente a configuração server-only no Vercel e em `.env.local` ignorado. Preserve todos os arquivos locais não relacionados. Use TDD. A pergunta seguinte da seleção deve ser comprovadamente gerada pelo OpenRouter e alimentar um campo canônico do brief/ranking; o fallback local deve continuar funcional, mas visível. Depois, paralelize os módulos DOU/Tavily e abstracts conforme a seção de paralelização, deixando a integração de `server/lib/radar.js` para o agente principal. `GET /api/radar/items` não pode consultar fontes externas. Execute testes, build, preflight e smoke em Preview Vercel antes de qualquer Production. Não implemente Azure/Entra agora; apenas preserve as interfaces de handoff.
## Estado congelado nesta pausa — 17/07/2026

### Implementado nesta rodada

- Onda 0/1: `server/lib/structuredGeneration.js` criou a fronteira server-only para OpenRouter, OpenAI e Azure futuro, com JSON Schema estrito, timeout, erros sanitizados e trace sem prompt/resposta/chave.
- Onda 0/1: `server/lib/interviewProvider.js`, `api/selection/interview-next.js`, `src/domain/interviewPlanner.js` e `src/pages/SelectionPage.jsx` agora enviam transcript sem persistência, facts/gaps, campo canônico, pergunta exibida e estado explícito de IA/fallback. A UX oferece tentar novamente ou continuar localmente.
- Onda 2: adapters independentes em `server/lib/radar/contracts.js`, `server/lib/radar/web/{urlPolicy,directOfficial,tavily}.js` e `server/lib/radar/sources/dou.js`, com allowlist HTTPS, DOU DO1/DO3, fuso de São Paulo, Tavily Search/Extract restrito, hashes e fixtures.
- Onda 2 integrada: `server/lib/radar.js` consulta DOU no refresh protegido, filtra EPT/indústria, mantém status/proveniência e `api/radar/items.js` ficou snapshot-only. O cron foi ajustado para 12:00 UTC/09:00 BRT.
- Onda 3 parcial: `server/lib/radar/summaries.js` reconstrói abstract OpenAlex, limpa Crossref, cria hash/proveniência, fallback evidencial e mescla duplicatas; `RadarPage` não exibe mais o template repetitivo de autor/data.
- `.env.example`, status operacional e preflight foram atualizados sem incluir segredos.

### Validações já executadas

- `node --check` passou nos módulos JavaScript alterados.
- Testes novos de resumos e geração estruturada: 8/8 passaram.
- Testes de entrevista/planner: 9/9 passaram.
- Testes dos adapters DOU/Tavily/políticas de URL: 11/11 passaram.
- Build Vite gerou `dist/` com bundle; o runtime do sandbox não imprimiu a linha final do processo, portanto repetir no próximo ambiente.
- `npm test` completo e `npm run handoff:preflight:mvp` ainda devem ser repetidos no próximo computador.

### Configuração pendente para tornar a IA real

Nenhuma chave foi configurada. Para testar a geração sem fallback, configurar somente no ambiente server-side do Vercel ou em `.env.local` ignorado:

```text
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=<secret>
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_COST_QUALITY_TRADEOFF=7
TAVILY_API_KEY=<secret opcional para fallback DOU>
```

Não copiar valores para o Git, frontend, logs ou documentação pública. Sem a chave, a interface deve mostrar explicitamente que está usando o roteiro local.

### Próxima sessão obrigatória

1. Repetir `npm test`, `npm run build` e `npm run handoff:preflight:mvp` com o runtime normal.
2. Fazer smoke da seleção com OpenRouter configurado e confirmar que duas respostas semanticamente diferentes produzem `provider=openrouter`, `fallback=false` e perguntas materialmente diferentes.
3. Validar refresh do DOU em Preview; se não houver edição relevante, registrar `no_edition` sem apagar o snapshot anterior.
4. Completar Onda 3 com resumo AI opcional em português (usando `structuredGeneration` e orçamento separado `radar-summary`), mantendo o fallback extractivo atual e cache por `summaryInputHash`.
5. Revisar encoding de textos legados em `src/domain/interviewPlanner.js` se a interface apresentar caracteres quebrados; não alterar o contrato de campos.
6. Fazer code review, commit/push e deploy Preview. Production somente com autorização explícita.

### Arquivos deliberadamente fora do commit

O worktree contém scripts de coleta de imagens, `output/`, `tmp/`, `.playwright-cli/` e outros artefatos locais de rodadas anteriores. Eles foram preservados e não fazem parte deste handoff.
