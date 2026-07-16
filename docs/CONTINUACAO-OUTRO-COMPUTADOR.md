# Plano de continuidade — entrevista adaptativa, radar e catálogo de escolas

Atualizado em 16/07/2026. Este documento registra o próximo ciclo de implementação para que o projeto possa ser retomado em outro computador sem depender do histórico local.

## Ponto de partida

- Repositório: `https://github.com/Kaluanbernardo/senai-parceiros`
- Branch de trabalho: `codex/enriquece-perfis-institucionais`
- Commit publicado no início deste plano: `9b1fee9`
- Preview Vercel: `https://senai-parceiros-4i3egoozj-kaluanbernardos-projects.vercel.app`
- Documentos de referência: `docs/PRD-mvp-selecao-stakeholders.md`, `docs/ARQUITETURA-v2-feedbacks.md`, `docs/PLANO-ONDAS-2-6.md` e `docs/HANDOFF-LUNA-v2.md`.
- Estado das fotos: 78 perfis possuem imagem aprovada e 22 continuam pendentes. A busca de imagens foi pausada por decisão do usuário.

No novo computador:

```bash
git clone https://github.com/Kaluanbernardo/senai-parceiros.git
cd senai-parceiros
git checkout codex/enriquece-perfis-institucionais
npm install
npm test
npm run dev
```

Não copiar arquivos `.env`, tokens ou chaves do computador anterior. Configurar segredos novamente no ambiente local e no Vercel.

## Diagnóstico confirmado

### 1. A entrevista não interpreta semanticamente cada resposta

O fluxo atual usa `src/domain/interviewPlanner.js`, um planejador determinístico. Ele escolhe a próxima pergunta por campos obrigatórios, objetivo, categoria e respostas vazias, mas não pede à IA que interprete o conteúdo da última resposta. A IA só entra no fim, em `POST /api/selection/evaluate`, para avaliar os candidatos.

Consequência: duas respostas semanticamente muito diferentes podem levar à mesma próxima pergunta.

### 2. O radar não está realmente alimentado no ambiente publicado

`GET /api/radar/items` serve `src/data/radar-seeds.json`. OpenAlex e Crossref só são consultados quando `RADAR_LIVE_SOURCES=true`, e esse modo cobre apenas pesquisas. Ainda não existem coletores implementados para fontes governamentais e internacionais, nem rotina persistente de sincronização.

Consequência: a interface e os filtros existem, mas o radar normalmente opera como base curada estática.

### 3. A página unificada de escolas concatena duas bases sem deduplicação

`src/pages/EscolasUnificadaPage.jsx` simplesmente junta os itens de `src/data/escolas.json` com os stakeholders cuja categoria é `Escola`. Hoje são 134 escolas na primeira base e 38 entradas escolares na segunda. Não existe chave canônica, tabela de aliases ou regra de fusão.

Consequência: redes como SENAI e SENAC aparecem mais de uma vez com diferenças de grafia, sigla ou abrangência.

## Decisões de arquitetura

### Provedor de IA

A aplicação deve ter uma fronteira única de provider no servidor, com duas operações:

```text
AiProvider.generateNextQuestion(interviewState)
AiProvider.evaluateCandidates(selectionBrief, candidates)
```

Ordem desejada:

1. OpenAI Platform API, se houver uma chave com faturamento habilitado;
2. OpenRouter, se a OpenAI Platform não estiver disponível;
3. planejador e avaliação locais como fallback transitório.

A assinatura do ChatGPT não deve ser tratada como crédito da API. O uso da aplicação hospedada exige uma chave da OpenAI Platform e faturamento de API separados. Se essa chave não existir, configurar OpenRouter. Referência oficial: `https://learn.chatgpt.com/docs/enterprise/governance#related-chatgpt-usage-controls`.

Variáveis previstas, exclusivamente no servidor:

```text
AI_PROVIDER=openai|openrouter
OPENAI_API_KEY=
OPENAI_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_COST_QUALITY_TRADEOFF=7
```

Nunca usar prefixo `VITE_` para chaves. Nunca versionar segredos. O provider interno da futura Azure deverá implementar o mesmo contrato.

## Plano de execução

### Onda 0 — Baseline e proteção contra regressões

1. Fazer checkout da branch e confirmar `npm test` e `npm run build`.
2. Registrar exemplos reproduzíveis dos três bugs antes de alterar código:
   - entrevista de escola para benchmarking com respostas distintas produzindo a mesma sequência;
   - `/api/radar/items` retornando `mode: curated-fallback`;
   - duplicatas SENAI/SENAC na página unificada e no pool de seleção.
3. Não misturar scripts temporários de coleta de imagens no commit deste ciclo.

Aceite: testes atuais verdes e três fixtures de regressão criadas.

### Onda 1 — Entrevista realmente adaptativa por IA

#### Backend

1. Criar `POST /api/selection/interview/next` autenticado e com rate limit próprio.
2. Enviar ao provider somente estado transitório:
   - categoria e objetivo;
   - perguntas e respostas anteriores;
   - última resposta;
   - dimensões ainda pouco exploradas;
   - limite mínimo/máximo de perguntas;
   - regras de segurança e proibição de inventar fatos.
3. Exigir saída estruturada por JSON Schema:
   - `questionId`, `prompt`, `helper`, `example`, `answerKind` e `reasonTag`;
   - `dimensionsCovered` e `factsExtracted`;
   - `remainingGaps`;
   - `shouldStop` e justificativa curta.
4. Validar no servidor: pergunta não repetida, texto limitado, dimensão permitida, entre 8 e 20 perguntas e cobertura mínima antes de encerrar.
5. Se a chamada falhar, usar `InterviewPlanner` como fallback, deixando a rastreabilidade indicar provider e motivo.

#### Frontend

1. Depois de cada resposta, chamar o novo endpoint e mostrar estado “Preparando a próxima pergunta”.
2. Manter todo o estado apenas na memória da sessão; não gravar respostas no navegador nem no servidor.
3. Preservar revisão de respostas e exportação da rastreabilidade.
4. O exemplo exibido deve vir da mesma decisão contextual da pergunta, não de um texto genérico incompatível com categoria/objetivo.

#### Regras da entrevista

- A primeira pergunta continua sendo a escolha entre pesquisador, escola ou organização, seguida do objetivo.
- Respostas vagas geram perguntas de descoberta em linguagem simples.
- Respostas completas eliminam perguntas redundantes.
- Cada pergunta deve ser explicável: “por que estou perguntando isso?”.
- A entrevista deve separar requisitos, preferências, restrições eliminatórias, incertezas e evidências desejadas.
- A IA não pode recomendar um stakeholder fora do catálogo.

#### Testes de aceite

- “Escola para benchmarking de formação dual” e “pesquisador para palestra sobre IA industrial” produzem próximas perguntas materialmente diferentes.
- Uma resposta que já informa público, prazo e formato impede que essas três perguntas sejam repetidas.
- “Não sei ainda” gera descoberta orientada, sem bloquear o fluxo.
- Falha/timeout do provider continua o fluxo pelo fallback local.
- A entrevista encerra entre 8 e 20 perguntas e entrega um `selectionBrief` válido.

### Onda 2 — Catálogo canônico e deduplicação de escolas

1. Criar um módulo de domínio, por exemplo `src/domain/schoolCatalog.js`, usado tanto pela página quanto pelo motor de seleção.
2. Normalizar nomes para comparação: caixa, acentos, pontuação, espaços, siglas e sufixos institucionais.
3. Combinar sinais para detectar a mesma entidade:
   - domínio do website;
   - país/estado/cidade;
   - sigla e nome normalizado;
   - aliases explícitos;
   - relação rede nacional, departamento regional e unidade local.
4. Criar `src/data/school-aliases.json` para decisões auditáveis, começando por SENAI e SENAC.
5. Não fundir automaticamente entidades com escopo diferente. Exemplo: SENAI Nacional, SENAI-SP e uma escola local podem ser entidades legítimas distintas; duplicatas da mesma entidade com grafias diferentes devem ser fundidas.
6. Definir precedência de campos e preservar proveniência dos registros fundidos.
7. Criar `scripts/audit-school-duplicates.mjs` para listar pares prováveis, pontuação e decisão aplicada.
8. Fazer `EscolasUnificadaPage` e `getCandidatePool()` consumirem o mesmo catálogo canônico.

Testes de aceite:

- variantes textuais da mesma entidade SENAI/SENAC aparecem uma única vez;
- unidades ou departamentos regionais distintos continuam separados quando isso for relevante;
- o ranking não contém duas versões da mesma escola;
- busca por uma variante encontra a entidade canônica;
- o relatório de auditoria explica cada fusão.

### Onda 3 — Radar com ingestão real

#### Entrega rápida

1. Configurar no preview Vercel `RADAR_LIVE_SOURCES=true`.
2. Confirmar OpenAlex e Crossref na aba de pesquisas com `mode: live+curated`.
3. Exibir na interface o modo, horário da última atualização e erro por fonte.

#### Ingestão completa

1. Criar adapters independentes por fonte. Prioridade inicial:
   - pesquisa: OpenAlex e Crossref;
   - federal: MEC/SETEC, CNE, INEP, MTE, MDIC, ABDI, IPEA e DOU;
   - São Paulo: Governo de SP, Centro Paula Souza, CEE-SP, SEADE, FAPESP e InvestSP;
   - internacional: OCDE, OIT, UNESCO-UNEVOC, Cedefop, ETF, Banco Mundial e BID.
2. Preferir RSS/API quando disponível e usar parser HTML somente para páginas públicas estáveis.
3. Implementar uma rotina agendada `api/cron/radar-sync` com segredo próprio.
4. Persistir snapshots fora do processo serverless. Para o MVP Vercel, usar um `RadarStore` substituível; implementar Vercel Blob ou banco equivalente. Na Azure, trocar por Azure Blob/SQL sem alterar domínio e interface.
5. Normalizar, deduplicar por URL/DOI/hash e guardar proveniência, data de coleta e status da fonte.
6. Usar IA apenas para resumo em português, temas e relevância. A coleta não pode depender da IA e deve preservar título, URL e data originais.
7. O endpoint de leitura serve o último snapshot válido mesmo quando uma fonte falhar.

Testes de aceite:

- cada uma das três seções apresenta itens externos atuais e clicáveis;
- filtros funcionam sobre dados ingeridos, não apenas seeds;
- itens repetidos entre fontes aparecem uma vez, com proveniência preservada;
- falha de uma fonte não derruba o radar inteiro;
- execução registra quantidade, erros, duração e última atualização;
- nenhuma chave ou payload sensível aparece no frontend.

## Sequência recomendada de commits

1. `test: registra regressões da entrevista radar e escolas`
2. `refactor: cria contrato de providers de IA`
3. `feat: gera próxima pergunta adaptativa no servidor`
4. `feat: conecta entrevista guiada ao planejador de IA`
5. `feat: cria catálogo canônico de escolas`
6. `data: consolida aliases e duplicatas de escolas`
7. `feat: habilita fontes acadêmicas ao vivo no radar`
8. `feat: adiciona coletores oficiais e armazenamento do radar`
9. `chore: documenta variáveis e handoff para Azure`

## Ordem de prioridade

1. Entrevista adaptativa — é parte da funcionalidade principal de seleção.
2. Deduplicação de escolas — afeta catálogo e qualidade do ranking.
3. Radar real — importante, mas complementar à seleção.

## Definição de pronto deste ciclo

O ciclo só termina quando:

- a próxima pergunta é realmente gerada a partir do conteúdo da resposta anterior;
- há fallback local e rastreabilidade de provider/modelo;
- nenhuma resposta da entrevista fica persistida;
- catálogo e ranking usam escolas canônicas sem duplicatas da mesma entidade;
- as três seções do radar recebem dados externos atuais;
- testes unitários, integração e build passam;
- preview Vercel foi revisado;
- segredos estão apenas no ambiente e o caminho de migração para Azure permanece por adapters.

## Prompt para retomar no outro computador

> Leia `docs/CONTINUACAO-OUTRO-COMPUTADOR.md` e execute o plano a partir da Onda 0. Trabalhe na branch `codex/enriquece-perfis-institucionais`, preserve arquivos que não pertencem ao escopo, implemente e teste a entrevista adaptativa antes da deduplicação e do radar. Não grave segredos no repositório. Use OpenAI Platform API se houver `OPENAI_API_KEY`; caso contrário, configure OpenRouter. Publique uma nova preview no Vercel ao concluir cada onda funcional.

## Skills sugeridas para a próxima sessão

- `implement` para executar este plano em ondas.
- `tdd` para entrevista adaptativa, deduplicação e adapters do radar.
- `diagnose` se a seleção ou o radar falhar durante a integração.
- `deploy-to-vercel` para publicar e verificar cada preview.
- `vercel-react-best-practices` ao alterar o fluxo React.

