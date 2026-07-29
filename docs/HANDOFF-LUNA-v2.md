# Handoff de execução — Luna v2 (histórico)

> Documento substituído por `docs/HANDOFF-LUNA-v3.md` e `docs/PLANO-PRODUTO-LUNA-v3.md`. Não executar as instruções abaixo: elas contêm estado, commit e decisões de fotos já superados.

## Missão

Implementar a arquitetura descrita em `docs/ARQUITETURA-v2-feedbacks.md`, usando `docs/PRD-mvp-selecao-stakeholders.md` como contrato atualizado. A arquitetura v2 prevalece sobre decisões antigas conflitantes.

## Estado de partida

- Repositório: `Kaluanbernardo/senai-parceiros`.
- Branch: `codex/enriquece-perfis-institucionais`.
- Último commit funcional: `68e2381` (`Adiciona radar EPT com filtros e fontes`).
- Testes antes desta arquitetura: 8 testes aprovados.
- Build Vite antes desta arquitetura: aprovado.
- Vercel está vinculado e a prévia atual funciona; não publicar em produção sem solicitação explícita.
- Credenciais e segredos ficam somente em `.env.local`/Vercel; nunca registrar valores em commits, logs ou documentação.

## Arquivos do usuário a preservar

Não adicionar, mover, apagar ou alterar estes arquivos não rastreados:

- `public/fotos/Souvik Mukherjee, 2017 - Videogames and Postcolonialism - Empire Plays Back.pdf`
- `src/data/apply_stake_desc_1.cjs`

## Regras de execução

1. Executar por ondas, na ordem da arquitetura.
2. Manter React/Vite/MUI e fazer migração incremental; não reescrever o aplicativo.
3. Escrever testes no seam dos módulos antes de substituir comportamento.
4. Não persistir respostas ou resultados de seleção.
5. O Radar pode persistir somente conteúdo público, proveniência e saúde das fontes.
6. Não expor chain-of-thought; manter justificativas estruturadas.
7. Não preencher shortlist com candidato eliminado ou risco grave apenas para atingir cinco.
8. Não remover `ui-avatars` antes de haver imagem real aprovada para todos os perfis.
9. Remover bibliotecas de PDF/DOCX/PPTX somente depois de validar o novo XLSX.
10. Usar adapters para OpenRouter/Azure, Vercel Cron/Azure Timer e Local/Azure Blob.

## Primeiro lote recomendado

Começar pelas Ondas 0 e 1:

- consolidar schemas e testes de contrato;
- criar `ToolRegistry`;
- criar tokens e primitivos do design system;
- refazer AppShell e Home sem feature dominante;
- preservar rotas e comportamento funcional existentes;
- executar testes, build e smoke visual;
- revisar o diff antes do primeiro commit.

Depois continuar automaticamente para a Onda 2, salvo bloqueio real de dados, credenciais ou decisão de produto.

## Definição de pronto por onda

- testes novos e antigos passam;
- build passa;
- nenhum segredo é rastreado;
- arquivos não relacionados permanecem intactos;
- documentação de handoff é atualizada;
- commit é pequeno e descreve uma mudança coesa;
- preview Vercel somente após gates locais.
