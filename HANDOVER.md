# Handover Documentation — Selection Engine & Comparison UX

**Data:** 5 de agosto de 2026  
**Branch base:** `master` em `759d34c`  
**PRs:** #19, #20, #22, #23 — todos mesclados e publicados  
**Status:** em produção; 308 testes passando, build limpo

---

## Critical Issue Fixed

**Problem:** System was producing arbitrary rankings (scores 59–60 for all candidates) even when given nonsense answers ("asdf qwer zxcv"). No validation that recommendations matched the user's actual request.

**Root Cause:** 
- Four dimensions measured only candidate strength, not relevance to request
- Baseline institutional priorities were treated as user request (institutional agenda applied by default)
- No gate preventing unreadable/empty requests from producing confident shortlists

**Solution Implemented:** Relevance gate + honest explanations

---

## Key Changes

### 1. Relevance Gate (`src/domain/selectionEngine.js`)

**What it does:** Only candidates with demonstrated relationship to user request enter shortlist.

**How it works:**
```javascript
// Line ~150: Separated user request from institutional baseline
const priorities = (profile.priorities || []).filter(p => p.fromUser);  // User-requested only
const baselinePriorities = SENAI_PRIORITIES;  // Institutional baseline (lower weight)

// Line ~13: Thematic answer fields (exclude geography/constraints)
const THEMATIC_ANSWER_FIELDS = ['objective', 'description', 'themes', 'priorities', 'contributions', 'audiences'];

// Line ~157: Relevance measurement
const matchedMass = ... // IDF-weighted specificity of matched terms
const wantedMass = ... // IDF-weighted specificity of user's request
support.supported = matchedMass / wantedMass >= 0.15;  // SUPPORT_MIN_SPECIFICITY threshold
```

**Threshold constant:** `SUPPORT_MIN_SPECIFICITY = 0.15`

This prevents:
- Generic vocabulary overlap ("indústria", "formação profissional" appearing everywhere)
- Geography tokens counting as themes (Brasil was matching education topics)
- Nonsense answers producing confident results

**Shortlist construction:**
```javascript
const shortlist = support.length > 0 ? selectShortlist(supported) : [];
// If no candidates are supported, shortlist is empty
```

**Test Coverage:** See `src/domain/selectionEngine.test.js` lines ~400–450
- "refuses to rank when answers carry no recognizable request"
- "never claims institutional agenda was what user asked for"
- "keeps candidate out when overlap is only generic vocabulary"

---

### 2. Honest Candidate Explanations (`src/domain/candidateExplanation.js`)

**What it does:** Generate fact-based justifications tied to verifiable candidate record data.

**Structure:**
```javascript
{
  headline: "What the person/institution actually does (from areas/pesquisa/descricao)",
  why: [
    "1. Theme match — exact phrases from record vs user's request",
    "2. Evidence — citations, articles, scholar profile, website",
    "3. Fit — institutional relationship, audience match",
    "4. Context — geographic/timeline fit"
  ],
  against: [
    "1. Geographic mismatch — if score < 65 and outside preference",
    "2. No partnership — SENAI relationship status",
    "3. Generic overlap only — if themes match but not user's exact words",
    "4. Incomplete profile — if no external evidence links candidate to topics"
  ]
}
```

**Critical behavior:** 
- Refuses to claim "user requested X" if they didn't
- When no themes specified: "suas respostas não indicaram temas reconhecíveis"
- Never invents relevance that isn't in the record

**Location:** `src/domain/candidateExplanation.js` lines 95–168

---

### 3. Taxonomy Updates (`src/domain/senaiContext.js`)

**Changes:**
- Added `short` property to all taxonomy entries for prose-friendly names
  - "educação profissional" instead of "Qualidade e inovação da educação profissional"
- Removed "docentes" and "instrutores" from `teacher_development` terms
  - These describe audience, not topic; were causing false positives

**Why:** Prevents matching "um evento para instrutores" with "atua em formação docente"

---

### 4. Comparison Table UX (`src/components/SelectionResults.jsx`)

**Status:** ✅ Verificada no navegador (05/08). Dois defeitos encontrados e corrigidos — ver abaixo.

**What it does:**
- Horizontal scanning pattern (attributes as rows, candidates as columns)
- 3–4 candidate limit with chip-based selection
- "O que mais importa?" filter for non-compensatory decision support
- Difference highlighting ("X leads by Y points")
- Hide/show flat rows (dimensions where all candidates tie)

**Implementation:**
```jsx
function ComparisonTable({ ranges, legend, entries, selectedId, onSelect }) {
  const [chosen, setChosen] = useState(() => legend.slice(0, 3).map((item) => item.id));
  const [showFlat, setShowFlat] = useState(false);
  const [priority, setPriority] = useState('');
  // ... 80+ lines of table rendering logic
}
```

**Location:** `src/components/SelectionResults.jsx` lines ~250–350

---

## Verificação no navegador — feita em 05/08

A entrevista foi percorrida de ponta a ponta contra o catálogo real (322 perfis),
em dois cenários: um pedido concreto sobre formação profissional e um pedido
composto só de ruído.

**Resultado do cenário real:** shortlist de 10, tabela renderizando, os quatro
controles funcionando (seleção por chip com teto de 4, filtro de prioridade,
toggle de critérios empatados, clique na coluna trocando o detalhe individual).

**Resultado do cenário de ruído:** 88 registros avaliados, nenhuma shortlist,
mensagem explicando a recusa. O gate segura em produção.

### Defeito 1 — empate apresentado como liderança (corrigido)

Com dois candidatos em 36 e um em 30, a tabela marcava **os dois** com o selo
"melhor" e a frase abaixo dizia *"Acacia Kuenzer lidera por 6 pontos"*. Em
viabilidade eram três "melhor" simultâneos. A causa era `values.indexOf(best)`,
que devolve o primeiro de vários empatados e o promove a vencedor único.

É o mesmo defeito que o gate de relevância corrigiu na pontuação: a interface
afirmando o que o dado não sustenta.

A lógica saiu do JSX para `describeRow()` em `shortlistComparison.js`, onde é
testável. Agora "melhor" só aparece quando há vencedor único; havendo empate no
topo, todos os empatados recebem "empate no topo" e a frase os nomeia
(*"Piety, Acacia e Elly empatam no topo, 21 pontos à frente de Daniel"*).

Seis testes cobrem os casos: líder único, empate no topo, empate total,
singular/plural de "ponto" e lista sem colunas.

### Defeito 2 — erro de console do React (corrigido)

`<Box display="grid" placeItems="center">` vazava `placeItems` para o DOM
(*"React does not recognize the placeItems prop"*). Passou para `sx`.

### Polimento

Os chips de prioridade saíam em minúscula ao lado dos rótulos capitalizados da
tabela: a regra `::first-letter` estava no root do Chip, e o texto fica num span
interno (`.MuiChip-label`).

---

### 5. Colunas sob demanda no gerador de prompt (PR #22)

O prompt pedia sempre as 27 colunas da categoria. Cada coluna é uma pergunta que
o modelo tenta responder mesmo sem fonte, então pedir tudo alonga a pesquisa e
amplia o espaço de invenção.

`ColumnPicker` em `PromptGeneratorPage.jsx` permite escolher o recorte; as
obrigatórias ficam travadas. `resolveCatalogColumns()` acrescenta as
obrigatórias de volta em silêncio se faltarem — deixar o usuário gerar uma
pesquisa inteira que será recusada na importação seria pior.

Isso exigiu afrouxar `validateCatalogHeaders()`, que exigia cabeçalho completo
na ordem exata. Agora aceita subconjunto: obrigatórias presentes, nenhuma coluna
desconhecida, nenhuma repetida, ordem livre (a linha é lida pelo nome).

Dois efeitos colaterais tratados:

- coluna ausente virava valor inválido (`confianca` fora do recorte caía em
  `Number(undefined)` e reprovava a linha);
- a detecção de categoria ficou ambígua — um arquivo só com colunas comuns serve
  às três, e o desempate passou a ser o `tipo_registro` da primeira linha.

`catalogRoundTrip.test.js` fecha o ciclo recorte → template XLSX → importação nas
três categorias, que é onde as duas pontas poderiam divergir sem ninguém notar.

---

## Ressalvas que continuam de pé

- **A tela de importação XLSX do admin nunca foi exercitada no navegador**
  (upload → prévia → decisões → commit → rollback). O caminho de dados tem
  cobertura automatizada desde o PR #22, e as quatro rotas foram corrigidas por
  inspeção no PR #19, mas a interface em si não. É o maior risco em aberto.
- **Ao adicionar um quinto candidato à comparação, o primeiro sai sem aviso**
  (`current.slice(1)`). É deliberado — acima de quatro a comparação simultânea
  para de funcionar — mas alguém desatento pode não notar quem saiu.
- Se a shortlist tiver mais de 10, só os 3 primeiros entram na comparação
  inicial. Não há paginação; a maioria dos pedidos produz de 5 a 8 resultados.

---

## Histórico

| PR | O quê |
|---|---|
| #19 | entrevista conversacional, critérios calculados, rotas alinhadas à Vercel |
| #20 | tabela de comparação deixa de apresentar empate como liderança |
| #22 | renomeação das categorias; colunas sob demanda no gerador de prompt |
| #23 | rótulo "Outras organizações", rotas do catálogo renomeadas, chips da home removidos |

**Nomenclatura atual** (rótulo visível / id interno / rota):

| Rótulo | Id | Rota |
|---|---|---|
| Pessoas Físicas | `person` | `/catalogo/pessoas-fisicas` |
| Pessoas Jurídicas | `organization` | `/catalogo/pessoas-juridicas` |

Os caminhos antigos continuam redirecionando (`LEGACY_CATALOG_ROUTES` em
`src/App.jsx`) e os subtipos filtram cada pessoa física ou jurídica. O
normalizador ainda aceita os valores históricos de `categoria` (`'Pesquisador'`,
`'Escola'`, `'Organização'`) na entrada, mas o catálogo canônico expõe apenas
`person` e `organization` como naturezas de entidade.

---

## Known Limitations & Notes

### ComparisonTable Edge Cases
- If shortlist has > 10 candidates, current UI shows first 3 only
- No pagination implemented yet (low priority — most requests produce 5–8 results)
- "O que mais importa?" filter only works if dimension discriminates (amplitude ≥ 5)

### Relevance Gate Thresholds
- `SUPPORT_MIN_SPECIFICITY = 0.15` locked in tests
- If next developer needs to adjust: search `SUPPORT_MIN_SPECIFICITY` in codebase
- Changing threshold requires re-running nonsense test to verify gate behavior

### Importação de catálogo
- `SUPPORT_MIN_SPECIFICITY` não tem relação com a importação; o limiar de
  colunas é estrutural (obrigatórias presentes), não numérico.
- As colunas marcadas `essential: true` em `catalogImportSchema.js` definem o
  preset "Essenciais" do gerador. Mudar lá muda o preset, o prompt e o template
  de uma vez — é a fonte única.
- **A tela do admin continua sem verificação em navegador.**

---

## Files Changed

**Core logic:**
- `src/domain/selectionEngine.js` — Relevance gate, separated priorities
- `src/domain/candidateExplanation.js` — Honest explanations (NEW)
- `src/domain/shortlistComparison.js` — Analysis within shortlist (already implemented)
- `src/domain/senaiContext.js` — Taxonomy short names, removed false-match terms

**UI:**
- `src/components/SelectionResults.jsx` — ComparisonTable component (NEW)

**Tests:**
- `src/domain/selectionEngine.test.js` — Gate behavior locked in
- `src/domain/shortlistComparison.test.js` — Already passing
- `tests/api/routes.test.js` — Vercel routing validation

---

## Questions for Next Developer

1. **If ComparisonTable has runtime errors:** Start debugging in browser DevTools, check state initialization order, verify `legend` and `ranges` props are passed correctly.

2. **If relevance gate is too strict/loose:** Adjust `SUPPORT_MIN_SPECIFICITY` constant (line ~27 in selectionEngine.js), then run full test suite to verify no regressions.

3. **Se a importação do admin falhar:** o caminho de dados é coberto por
   `catalogRoundTrip.test.js` e `catalogImport.test.js`; comece pela tela, que
   nunca foi exercitada. As rotas foram corrigidas por inspeção no PR #19.

4. **Se um rótulo parecer fora do lugar:** rótulo visível, id interno, rota e o
   campo `categoria` dos registros são quatro coisas distintas — ver a tabela em
   *Histórico*. Só o rótulo e a rota foram renomeados.

---

## Deployment Notes

- **Environment variable required for generative questions:** `OPENROUTER_API_KEY` must be in Vercel **Preview** scope (not just Production) for interview questions to be written by AI.
- Without it, interview runs on hardcoded question rotary and displays "IA indisponível" (honest message, not an error).
- Test with `npm run ai:smoke -- --model=` before adopting new models.

---

**Estado final:** tudo mesclado em `master` (`759d34c`) e publicado. 308 testes
em 50 arquivos, build limpo. A única parte do sistema que nunca foi vista
funcionando num navegador é a tela de importação XLSX do admin.
