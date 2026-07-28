# Handoff para continuar no Claude — SENAI Parceiros

Data do handoff: 28/07/2026
Checkout: `C:\Users\sn1096448\Desktop\senai-parceiros`
Branch: `codex/enriquece-perfis-institucionais`
HEAD verificado: `1153eba` — `feat: implement adaptive interview and official radar pipeline`

## Objetivo da próxima sessão

Continuar a evolução do MVP de seleção de stakeholders do SENAI-SP. A seleção de stakeholders é a funcionalidade principal; o Radar de notícias EPT/VET é secundário. Preserve o escopo, as regras de segurança e a rastreabilidade já implementadas.

## Estado publicado

- Repositório remoto: `https://github.com/Kaluanbernardo/senai-parceiros.git`.
- O branch local está alinhado ao branch remoto no commit `1153eba`.
- O trabalho anterior publicou somente Preview na Vercel; não inferir produção a partir disso. Revalidar o Preview se a tarefa depender dele.
- O planejamento detalhado das ondas anteriores está em [`docs/HANDOFF-LUNA-v4.md`](./HANDOFF-LUNA-v4.md). Leia-o antes de alterar entrevista ou Radar.

## O que já existe

- Entrevista adaptativa e ranking com estado transitório em memória.
- Geração estruturada server-side, com OpenRouter/OpenAI e fallback local visível.
- Contrato JSON Schema, timeout, erros sanitizados e ausência de segredos no frontend.
- Radar com snapshot, refresh protegido/agendado, adapters oficiais/Tavily, proveniência e políticas de elegibilidade.
- Resumos de pesquisa com abstração de evidência, hash e fallback extrativo.
- Testes unitários e de integração cobrindo os contratos principais.

Arquivos de entrada mais importantes:

- `src/pages/SelectionPage.jsx`
- `src/domain/interviewPlanner.js`
- `server/lib/interviewProvider.js`
- `server/lib/structuredGeneration.js`
- `api/selection/interview-next.js`
- `server/lib/radar/`
- `server/lib/radar.js`
- `src/pages/RadarPage.jsx`
- `scripts/handoff-preflight.mjs`

## Validação feita neste handoff

- `vitest run`: passou — 37 arquivos, 128 testes.
- `vite build`: passou.
- `node scripts/handoff-preflight.mjs --profile=mvp`: executou e retornou bloqueio esperado de configuração:
  - `PUBLIC_APP_ORIGIN` ausente;
  - `OPENROUTER_API_KEY` ausente, com `AI_PROVIDER=openrouter` selecionado.
- O comando global `npm` deste ambiente está quebrado (`npm-cli.js` ausente); os gates acima foram executados diretamente pelos binários locais, fora da limitação do sandbox.
- O build emitiu apenas o alerta de chunks grandes, não uma falha.
- O `dist/` foi varrido e não contém nome nem valor de segredo.

### Correção de 28/07/2026 no preflight

Os dois bloqueios anteriores estavam incorretos e foram resolvidos:

- `AUTH_SESSION_SECRET` já estava preenchido em `.env.local`, mas o Vite carrega esse arquivo apenas em `import.meta.env`. Os handlers de API e o preflight rodam em Node e leem `process.env`, então o segredo era invisível para ambos. `server/lib/envFile.js` passou a carregar `.env.local`/`.env` no ambiente do servidor, sem sobrescrever valores já definidos pelo deploy e ignorando nomes `VITE_`.
- O check `ai_provider` aceitava a credencial de qualquer provider, enquanto `server/lib/structuredGeneration.js` não faz fallback cruzado quando `AI_PROVIDER` está explícito. Com OpenRouter selecionado e sem chave, o preflight reportava verde e toda geração caía em fallback local. O check agora espelha a ordem real de seleção.

Para validar o MVP localmente, definir `PUBLIC_APP_ORIGIN` e `OPENROUTER_API_KEY` apenas em `.env.local` (ignorado pelo Git) ou no ambiente do processo.

## Estado local que deve ser preservado

O worktree contém alterações não commitadas e artefatos de pesquisa/coleta, incluindo `scripts/`, `output/`, `tmp/`, `.playwright-cli/` e `src/data/apply_stake_desc_1.cjs`. Eles não foram incluídos neste handoff/commit. Não use `git add -A`, não faça reset, stash ou limpeza automática. Primeiro classifique o que é trabalho intencional do usuário e o que é temporário.

## Regras de continuidade

1. Nunca colocar chaves em código, logs, bundle, prompt do handoff ou variáveis `VITE_*`.
2. Manter prompts, respostas, shortlist e rastreabilidade da seleção apenas em memória durante a sessão.
3. O fallback local deve ser explícito; nunca apresentar uma pergunta fallback como gerada por IA.
4. `GET /api/radar/items` deve ler snapshot e não disparar coleta externa.
5. Falha de fonte não pode apagar o último snapshot válido.
6. Evidência pública deve sustentar resumos, scores e alertas; não inventar método, resultado, vínculo ou impacto.
7. Não publicar em produção sem autorização explícita.
8. Antes de qualquer commit/push: revisar escopo, rodar testes, build, preflight e smoke aplicável.
9. Usar português brasileiro com acentos. Se aparecer mojibake, validar os bytes/encoding antes de qualquer correção ampla.

## Próximos passos recomendados

1. Ler `docs/HANDOFF-LUNA-v4.md`, `CONTEXT.md` e o diff/status atual.
2. Confirmar qual onda o usuário quer continuar. Se não houver indicação, começar corrigindo a configuração segura do preflight e os testes da entrevista adaptativa, sem tocar nos artefatos locais.
3. Para validação local do MVP, fornecer valores de desenvolvimento para `PUBLIC_APP_ORIGIN` e `AUTH_SESSION_SECRET` somente no ambiente/processo, nunca no Git.
4. Repetir `vitest run`, `vite build` e `node scripts/handoff-preflight.mjs --profile=mvp` depois da mudança.
5. Fazer smoke no Preview somente se necessário e rotular o resultado como Preview.

## Skills sugeridas para o Claude

- `diagnose` ou `diagnosing-bugs`: se a sessão começar pelo bloqueio de configuração, runtime ou entrevista.
- `implement`: para executar uma onda de implementação a partir do handoff existente.
- `review`: antes de aceitar alterações em um worktree misto.
- `github:github`: para inspecionar branch, Preview, PR ou checks sem confundir Preview com produção.

## Prompt pronto para colar no Claude

```text
Você vai continuar o projeto em C:\Users\sn1096448\Desktop\senai-parceiros.

Leia primeiro:
1. docs/HANDOFF-CLAUDE.md
2. docs/HANDOFF-LUNA-v4.md
3. CONTEXT.md
4. git status --short --branch e git log -5 --oneline

Contexto confirmado:
- branch: codex/enriquece-perfis-institucionais
- HEAD publicado: 1153eba
- seleção de stakeholders é a feature principal; Radar é secundário
- `vitest run` passou com 36 arquivos/121 testes
- `vite build` passou
- preflight MVP está bloqueado somente por `PUBLIC_APP_ORIGIN` e `AUTH_SESSION_SECRET` ausentes neste ambiente
- há alterações locais e artefatos de coleta não relacionados; preserve-os, não use `git add -A`, não faça reset/stash/limpeza automática

Sua primeira tarefa é diagnosticar o estado atual e propor a menor próxima onda útil. Não implemente ainda até identificar o escopo no diff, a menos que a correção seja claramente necessária e segura. Se seguir automaticamente, priorize tornar o preflight MVP validável com configuração server-only de desenvolvimento e cobrir a entrevista adaptativa, sem expor segredos.

Regras: nunca versionar chaves; nunca usar VITE_ para segredo; fallback de IA sempre visível; GET do Radar lê somente snapshot; não inventar evidência; não publicar produção; usar português brasileiro com acentos.

Depois de qualquer alteração, rode os gates reais (`node_modules/.bin/vitest.cmd run`, `node_modules/.bin/vite.cmd build` e `node scripts/handoff-preflight.mjs --profile=mvp`), revise o diff e informe exatamente o que passou, o que ficou bloqueado e quais arquivos foram alterados.
```
