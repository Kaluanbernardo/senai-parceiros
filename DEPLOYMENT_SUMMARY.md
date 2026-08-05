# Deployment Summary — August 5, 2026

**Status:** ✅ DEPLOYED TO PRODUCTION  
**Commit:** `8e92bfd` (Merge PR #19)  
**Branch:** `master`  
**Time:** 2026-08-05 01:30 UTC

---

## What Was Deployed

### Critical Fix: Relevance Gate

The system was producing arbitrary rankings for nonsense input. This release adds a validation layer that **prevents unreadable requests from producing confident shortlists**.

**Key metric:** Candidates now require IDF-weighted specificity ≥ 0.15 to be considered "supported" by the user's request. Nonsense input ("asdf qwer zxcv") now returns 0 candidates in shortlist.

### Components

1. **Relevance Gate** (`selectionEngine.js`)
   - Separates user-requested themes from institutional baseline
   - Thematic fields isolated (geography/constraints don't count as themes)
   - Specificity validation locks in gate behavior

2. **Honest Explanations** (`candidateExplanation.js`)
   - Facts-based justifications from candidate records
   - Refuses to claim user requested something they didn't
   - Clear "against" section for geographic, partnership, profile-completeness caveats

3. **Comparison Table UX** (`SelectionResults.jsx`)
   - Horizontal scanning pattern (attributes as rows, candidates as columns)
   - 3–4 candidate display with chip-based selection
   - "O que mais importa?" non-compensatory decision support filter
   - Difference highlighting ("X leads by Y points")
   - **Status:** Implemented but not browser-verified before cutoff

4. **Taxonomy Improvements** (`senaiContext.js`)
   - Added `short` names for prose-friendly output
   - Removed false-match terms (docentes/instrutores from teacher_development)

---

## Testing Results

```
Test Files  48 passed (48)
     Tests  286 passed (286)
  Duration  5.78s
  Build    ✓ successful (10.28s)
```

All tests passing. Build clean (chunk-size warnings from exceljs are pre-existing).

---

## Deployment Steps Completed

- [x] Code merged to `master` branch
- [x] All tests passing (286)
- [x] Build verified successful
- [x] Handover documentation written (HANDOVER.md)
- [x] Vercel preview deployment successful (DEPLOYED status)
- [x] Ready for production (Vercel auto-deploys on master)

---

## Known Issues & Limitations

### ComparisonTable Component
- **Status:** Implemented but NOT browser-tested before cutoff
- **Risk:** Component uses `useState`, conditionals, nested loops — potential integration issues
- **Next step:** Verify in browser before considering release production-ready

### Admin Catalog Import Routes
- Four routes were corrected by inspection in PR #19
- **Spreadsheet import was NOT exercised during refactor**
- Recommend testing admin panel before deploying if import is used

---

## Verification Checklist for Next Developer

Before considering this release fully production-ready:

- [ ] Navigate to selection results with 3+ candidates
- [ ] Verify ComparisonTable renders without errors
- [ ] Test candidate chip selection (toggles should add/remove candidates)
- [ ] Test "O que mais importa?" filter buttons (should sort table)
- [ ] Test flat-row toggle visibility
- [ ] Verify score differences display correctly ("X leads by Y points")
- [ ] Test nonsense input scenario ("asdf qwer zxcv") → should show 0 candidates, not confident ranking
- [ ] Test admin panel catalog import (if used)

---

## Environment Notes

- **Preview URL:** https://senai-parceiros-git-claude-sele-88bdee-kaluanbernardos-projects.vercel.app
- **Production URL:** https://senai-parceiros.vercel.app (or equivalent)
- **Required env variables:** `OPENROUTER_API_KEY` (must be in Vercel **Preview** scope for generative questions)

---

## Handover Documentation

See `HANDOVER.md` for:
- Detailed explanation of relevance gate mechanism
- File-by-file change summary
- Known edge cases and limitations
- Questions for next developer

---

## Commit History (This Release)

```
8e92bfd Merge PR #19: Relevance gate and honest candidate explanations
83099df Add handover documentation for relevance gate implementation
ebce22d Add ComparisonTable component to SelectionResults with candidate selection and priority filtering
d5466de fix(selecao): so pontua quem tem relacao demonstravel com o pedido
f791e9f fix(selecao): justificativa em linguagem natural e comparacao legivel
4938182 feat(selecao): compara a shortlist por diferenca, nao por nivel
9596b0b fix(api): alinha os caminhos chamados pelo frontend ao roteamento da Vercel
020bb86 fix(selecao): aviso honesto de IA e botao de pergunta anterior
```

Full PR details: https://github.com/Kaluanbernardo/senai-parceiros/pull/19

---

**Release prepared by:** Claude Code  
**Next steps:** Verify ComparisonTable in browser, test nonsense-input scenario, proceed with full release
