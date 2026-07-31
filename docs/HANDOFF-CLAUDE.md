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

## Carregamento sob demanda do bundle

As nove rotas usam `React.lazy` e os três JSONs de catálogo (~730 kB) saíram do
chunk de entrada. `DataProvider` só busca os seeds quando existe usuário
autenticado, então quem para na tela de login não baixa o catálogo.

`catalogReady` fecha o portão em `Protected`: nenhuma página que consome
`useData` renderiza antes dos seeds chegarem, o que impede lista vazia aparecer
como resultado real. Ao alterar `DataContext`, preservar esse par
`catalogReady`/`Protected`.

Efeito medido no `npm run build`:

| chunk de entrada | antes | depois |
| --- | --- | --- |
| `index` | 1.461,9 kB | 498,4 kB |
| `index` gzip | ~430 kB | 161,4 kB |

O alerta de chunk maior que 500 kB continua, agora apenas pelo `exceljs`
(937 kB), que já é `import()` dinâmico e só baixa quando alguém exporta.

## Pendências depois desta entrega

1. Resolver os gates corporativos somente quando houver infraestrutura:
   Entra ID, stores duráveis/atômicos, alertas e scheduler. Bloqueio externo:
   não há o que fazer no código até o SENAI-SP liberar os recursos.
2. Acompanhar as 12 vulnerabilidades reportadas pelo `npm audit` (11 altas e
   uma moderada). O caminho automático exige downgrades quebradores de ExcelJS
   e React Router; não usar `npm audit fix --force`. O advisory do React Router
   afeta o modo RSC, que este SPA Vite não usa; as demais ocorrências chegam
   pela cadeia de compactação do ExcelJS.

   Verificado em 29/07/2026: a faixa vulnerável é `7.12.0 - 8.2.0` e a última
   7.x publicada é a `7.18.2`, ainda dentro dela. **Esperar um patch 7.x não é
   estratégia viável** — a correção só existe a partir da `8.3.0`, ou seja,
   exige salto de major. Como o projeto usa `BrowserRouter` em SPA Vite, sem
   RSC, o risco prático permanece nulo; tratar como item agendado antes de
   produção, nunca como emergência.
3. Observar custo e qualidade dos resumos por IA antes de ativá-los por padrão.
   Depende de dados que só o Preview em uso gera; manter
   `RADAR_SUMMARY_PROVIDER` vazio até haver medição real.
4. Revalidar as fontes oficiais periodicamente com
   `npm run radar:feeds:audit`.

   Ambiente com allowlist de egresso (sandbox, CI restrito) devolve 403 com o
   corpo `Host not in allowlist: <host>` para toda fonte. Isso é bloqueio de
   rede, não fonte quebrada: confirmar numa rede sem allowlist antes de tratar
   qualquer feed como indisponível.
5. Publicar primeiro em Preview. Produção exige autorização explícita.

## Variáveis mínimas para o preflight MVP passar

Verificado em 29/07/2026: estas cinco bastam para `npm run handoff:preflight:mvp`
retornar `ok: true` com `blockers: []`.

```text
AUTH_PROVIDER=local
AUTH_SESSION_SECRET=<pelo menos 32 caracteres>
PUBLIC_APP_ORIGIN=<origin do Preview>
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=<secret>
```

`ai_provider` só é obrigatório porque `AI_PROVIDER` está preenchido; sem essa
variável o preflight exige apenas as quatro primeiras. Configurar no painel do
Preview ou em `.env.local`, nunca no repositório.

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
