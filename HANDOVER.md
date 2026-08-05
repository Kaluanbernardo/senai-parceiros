# Handover Documentation — Selection Engine & Comparison UX

**Date:** August 5, 2026  
**Branch:** `claude/selection-generative-questions-criteria-ygz2ul`  
**PR:** #19 (Draft)  
**Status:** Ready for merge to `main`

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

## Ressalvas que continuam de pé

- **Importação de planilha do admin não foi exercitada.** As quatro rotas foram
  corrigidas por inspeção no PR #19. Testar antes de confiar nessa parte.
- **Ao adicionar um quinto candidato à comparação, o primeiro sai sem aviso**
  (`current.slice(1)`). É deliberado — acima de quatro a comparação simultânea
  para de funcionar — mas alguém desatento pode não notar quem saiu.
- Se a shortlist tiver mais de 10, só os 3 primeiros entram na comparação
  inicial. Não há paginação; a maioria dos pedidos produz de 5 a 8 resultados.

---

## Git Details

**Branch:** `claude/selection-generative-questions-criteria-ygz2ul`  
**Latest commit:** `ebce22d` - Add ComparisonTable component to SelectionResults

**Recent commits (last 8):**
1. `ebce22d` - ComparisonTable implementation
2. `[previous 7 commits in PR #19]` - Full refactor details in PR body

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

### Admin Catalog Import Routes
PR notes that four admin routes were corrected by inspection:
- `/api/admin/catalog/import-*` → `/api/admin/[action].js`
- **Spreadsheet import flow was NOT exercised during refactor**
- Recommend testing admin panel before deploying if import is used

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

3. **If admin import breaks:** The four routes were patched by inspection (see PR #19 notes). Exercise the admin spreadsheet import workflow end-to-end.

---

## Deployment Notes

- **Environment variable required for generative questions:** `OPENROUTER_API_KEY` must be in Vercel **Preview** scope (not just Production) for interview questions to be written by AI.
- Without it, interview runs on hardcoded question rotary and displays "IA indisponível" (honest message, not an error).
- Test with `npm run ai:smoke -- --model=` before adopting new models.

---

**This handover is complete. The system is ready for production after merge and browser verification of ComparisonTable.**
