# Runbook de handoff — SENAI-SP Parceiros

Este runbook descreve o que o time de TI precisa configurar ou substituir. Nenhuma credencial pessoal deve ser copiada para o repositório, para a planilha ou para o navegador.

## Estado atual do MVP

- Branch de referência: `codex/enriquece-perfis-institucionais`.
- Autenticação provisória: dois papéis (`admin` e `user`) com credenciais server-only.
- IA: OpenAI Platform, OpenRouter (`openrouter/auto`) ou Azure OpenAI por adapter, escolhidos por `AI_PROVIDER`.
- Catálogo/Radar: memória para desenvolvimento; `file` para execução controlada local; `vercel_blob` para armazenamento privado compartilhado.
- Radar: refresh protegido em `/api/radar/refresh`, agendado a cada seis horas em `vercel.json`.
- Seleção: respostas, briefings e resultados não são persistidos; somente a planilha exportada sai pelo navegador.
- Pesquisadores não possuem foto, avatar, iniciais ou placeholder de mídia.

## Configuração Vercel MVP

1. Criar um Blob Store privado e conectar o projeto.
2. Definir `CATALOG_STORE_DRIVER=vercel_blob` e `RADAR_STORE_DRIVER=vercel_blob`.
3. Definir `BLOB_STORE_ID` e usar OIDC do projeto ou `BLOB_READ_WRITE_TOKEN` gerenciado pela equipe; nunca usar chave pessoal.
4. Definir `CATALOG_BLOB_PATH` e `RADAR_BLOB_PATH` com caminhos estáveis.
5. Definir `RADAR_CRON_SECRET`/`CRON_SECRET` como segredo aleatório rotacionável.
6. Definir `AUTH_SESSION_SECRET`, credenciais provisórias e limites de IA no ambiente de produção, nunca em `VITE_*`.
7. Validar `GET /api/radar/refresh` com o segredo de cron e conferir `lastRun`, `itemCount`, `sourceStatus` e `store.durable=true`.

## Migração para Azure

Substituir somente adapters e configuração:

- `CatalogStore`: Azure Blob Storage, Table Storage ou banco corporativo, preservando `previewImport`, `commitImport`, `rollbackImport`, idempotência por hash e manifesto de lotes.
- `RadarStore`: Blob/Cosmos/SQL com snapshot imutável, checkpoint e retenção definida.
- IA: `AI_PROVIDER=azure`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` e segredo em Key Vault.
- Refresh: Azure Timer/Functions chama o mesmo contrato do endpoint protegido, com identidade gerenciada e sem segredo no código.
- Autenticação: substituir a sessão provisória por Entra ID, mantendo os papéis de usuário e administrador mapeados por grupo.
- Rate limit/orçamento: mover o contador de memória para Redis/Storage com operação atômica e alertas.

## Backup, restore e rollback

- Catalogar o manifesto de catálogo e o snapshot do Radar antes de qualquer migração.
- Guardar versões imutáveis por data e hash; não sobrescrever o backup anterior.
- Para rollback de importação, usar o `importBatchId` e o endpoint administrativo enquanto não houver edição posterior conflitante.
- Para rollback de release, retornar ao commit anterior da branch e preservar o store; não apagar dados sem aprovação do responsável.
- Testar restore em ambiente separado e registrar data, operador e resultado.

## Rotação e encerramento das credenciais pessoais

1. Criar credenciais corporativas novas.
2. Atualizar os ambientes de preview e produção.
3. Confirmar logs sem tokens, cookies, prompts ou respostas.
4. Revogar chaves pessoais de OpenAI/OpenRouter, Blob e Vercel usadas no MVP.
5. Remover `.env.local` e qualquer cópia local antes de transferir o repositório.
6. Confirmar que o build e os testes passam sem nenhuma variável pessoal.

## Gate de aceite

`npm test -- --run` e `npm run build` devem passar. Depois, validar login, seleção, importação XLSX com replay idempotente, rollback, Radar com fonte indisponível e refresh autenticado. A revisão visual deve ser feita no navegador corporativo antes da publicação.
