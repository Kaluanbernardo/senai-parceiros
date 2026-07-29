# Handoff para continuar no Claude — SENAI Parceiros

Data do handoff: 29/07/2026
Checkout: `C:\Users\sn1096448\Desktop\senai-parceiros`
Branch: `codex/enriquece-perfis-institucionais`
Base desta entrega: `fa4faef`

## Prioridade do produto

A seleção de stakeholders é a funcionalidade principal. O Radar EPT/VET é
secundário. O MVP externo continua sendo o alvo imediato; Entra ID, stores
duráveis/atômicos, alertas e scheduler corporativo continuam como gates de uma
implantação corporativa futura.

## Estado implementado

- Entrevista adaptativa server-side com saída estruturada, transcript
  transitório, campos canônicos e fallback local visível.
- OpenRouter validado server-side com o modelo gratuito fixado em
  `google/gemma-4-26b-a4b-it:free`; duas respostas diferentes produziram
  perguntas materialmente diferentes, com `fallback=false`.
- Ranking calibrado para não punir a expressão “sem evidência de parceria” e
  para excluir da shortlist candidatos com risco grave confirmado.
- Exportação XLSX validada reabrindo o arquivo real e conferindo as nove abas
  de auditoria.
- Radar snapshot-only no GET, refresh protegido, DOU direto e fallback Tavily.
- Status `no_edition` do DOU preservado na observabilidade.
- Resumos acadêmicos opcionais por IA em lotes de até seis, com orçamento
  separado `radar-summary`, cache por `summaryInputHash` e fallback extrativo.
- Auditoria reproduzível das fontes RSS por `npm run radar:feeds:audit`.
- O RSS legado indisponível da FAPESP foi removido; a cobertura permanece pela
  página oficial `https://fapesp.br/noticias`.

## Validações desta entrega

- Dependências restauradas de forma reproduzível com `npm ci`.
- Suíte completa: 39 arquivos e 146 testes passaram.
- Build Vite passou; permanece o alerta não bloqueante de chunks grandes.
- Smoke real do OpenRouter passou sem expor chave, prompt completo ou resposta
  bruta.
- Refresh local do DOU alcançou a fonte oficial e retornou zero itens elegíveis
  na janela testada, sem erro.
- Firefox desktop: página inicial, início da entrevista e Radar renderizaram sem
  erro de console.
- Firefox em 390 × 844: Radar sem rolagem horizontal.

Repetir e registrar os números finais antes de publicar:

```powershell
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" test
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build
node scripts/handoff-preflight.mjs --profile=mvp
node scripts/audit-official-feeds.mjs
```

## Configuração server-only

Configurar apenas em `.env.local` ignorado pelo Git ou nas variáveis do Preview:

```text
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=<secret>
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
RADAR_SUMMARY_PROVIDER=openrouter
PUBLIC_APP_ORIGIN=<origin do Preview>
AUTH_SESSION_SECRET=<secret>
```

Não usar prefixo `VITE_` para segredos. `RADAR_SUMMARY_PROVIDER` vazio, `false`
ou `off` mantém o resumo extrativo sem consumo de IA.

## Estado local a preservar

Há scripts e artefatos de coleta de imagens não relacionados em `scripts/`,
`output/`, `tmp/`, `.playwright-cli/` e `src/data/apply_stake_desc_1.cjs`.
Preservá-los. Não usar `git add -A`, reset, stash ou limpeza automática.

## Pendências depois desta entrega

1. Resolver os gates corporativos somente quando houver infraestrutura:
   Entra ID, stores duráveis/atômicos, alertas e scheduler.
2. Acompanhar as 12 vulnerabilidades reportadas pelo `npm audit` (11 altas e
   uma moderada). O caminho automático exige downgrades quebradores de ExcelJS
   e React Router; não usar `npm audit fix --force`. O advisory do React Router
   afeta o modo RSC, que este SPA Vite não usa; as demais ocorrências chegam
   pela cadeia de compactação do ExcelJS.
3. Observar custo e qualidade dos resumos por IA antes de ativá-los por padrão.
4. Revalidar as fontes oficiais periodicamente com
   `npm run radar:feeds:audit`.
5. Publicar primeiro em Preview. Produção exige autorização explícita.

## Regras de continuidade

1. Nunca versionar, imprimir ou devolver chaves.
2. Manter respostas, prompts, shortlist e rastreabilidade da seleção somente em
   memória durante a sessão.
3. Nunca apresentar fallback como conteúdo gerado por IA.
4. `GET /api/radar/items` não consulta rede externa.
5. Falha parcial não apaga o último snapshot válido.
6. Não inventar método, resultado, vínculo ou impacto sem evidência pública.
7. Antes de commit/push: testes, build, preflight, smoke e revisão do diff.
8. Produção somente com autorização explícita.

Leia também `docs/HANDOFF-LUNA-v4.md` para o histórico arquitetural detalhado.
