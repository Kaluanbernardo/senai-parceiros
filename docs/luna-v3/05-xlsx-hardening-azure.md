# Ticket — Consolidar XLSX, segurança e handoff Azure

## Objetivo

Encerrar o ciclo com um único artefato exportável útil e uma arquitetura segura para transferência ao ambiente corporativo.

## XLSX

1. Validar as nove abas: Leia-me, Contexto, Shortlist, Comparação detalhada, Evidências, Riscos e lacunas, Respostas, Metodologia e Catálogo considerado.
2. Garantir igualdade entre UI e workbook para candidatos, notas, pesos, evidências, lacunas, exclusões e regras.
3. Validar hyperlinks, filtros, painéis congelados, Unicode e proteção contra formula injection.
4. Fazer smoke em Excel e LibreOffice.
5. Depois do gate, apagar builders de PDF, DOCX e PPTX e remover `jspdf`, `jspdf-autotable`, `docx` e `pptxgenjs`.

## Hardening e Azure

1. Configuração server-only, validada e fail-closed.
2. Contract tests para providers OpenAI/OpenRouter/Azure/fake, RadarStore do MVP/Azure e Vercel Cron/Azure Timer.
3. Rate limit compartilhado, quotas, timeout, idempotência, teto de gasto e alertas.
4. Logs sem respostas privadas, prompts integrais, cookies, tokens ou segredos.
5. Documentar variáveis, rotação, backup, restore, rollback e migração.
6. Exigir autenticação corporativa quando o time de TI implementar Entra ID; manter os dois papéis da aplicação.
7. Remover e revogar todas as chaves pessoais no handoff.

## Aceite

- workbook abre sem reparo e permite reconstruir o resultado;
- bundle não contém exportadores legados;
- nenhum segredo aparece em Git, browser, planilha ou logs;
- troca para Azure ocorre por configuração/adapters, sem fork da UI ou domínio;
- jobs são autenticados e idempotentes;
- time de TI recebe runbook suficiente para operar e rotacionar credenciais.
