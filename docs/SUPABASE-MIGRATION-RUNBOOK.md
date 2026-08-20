# Migração Vercel Blob para Supabase

Este corte preserva os blobs como rollback e só grava um documento no Supabase quando o destino ainda não existe. Um destino divergente bloqueia toda a execução antes da primeira escrita.

## Pré-requisitos

- aplicar `supabase/migrations/202608190001_pilot_storage.sql`;
- disponibilizar `BLOB_READ_WRITE_TOKEN`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no processo local autorizado;
- impedir gravações administrativas durante a janela curta de comparação e cópia;
- manter `CATALOG_BLOB_PATH`, `RADAR_BLOB_PATH`, `AI_BUDGET_BLOB_PATH` e `RATE_LIMIT_BLOB_PATH` caso os caminhos não sejam os padrões.

## Procedimento

1. Comparar e gerar backup local ignorado pelo Git:

   `npm run storage:migrate:supabase`

2. Se todos os documentos estiverem como `copy`, `already_migrated`, `destination_only` ou `empty`, executar:

   `npm run storage:migrate:supabase -- --apply`

   Quando as gravações divergentes do Supabase tiverem sido classificadas e explicitamente autorizadas para descarte, usar:

   `npm run storage:migrate:supabase -- --apply --replace-conflicts`

3. Exigir a linha final `status: verified`. O script relê cada documento copiado e compara o SHA-256 canônico.

4. Configurar produção com:

   - `CATALOG_STORE_DRIVER=supabase`
   - `RADAR_STORE_DRIVER=supabase`
   - `AI_BUDGET_STORE_DRIVER=supabase`
   - `RATE_LIMIT_STORE_DRIVER=supabase`

5. Reimplantar e validar, com sessão administrativa, o catálogo, o Radar, o status operacional e `/api/admin/ai-usage`.

6. Remover `BLOB_READ_WRITE_TOKEN` somente depois da validação. Os blobs não devem ser apagados nesta etapa; são o rollback até uma janela posterior de retenção autorizada.

Quando as credenciais existirem somente na Vercel, habilitar temporariamente `STORAGE_MIGRATION_ENABLED=true` e usar a rota administrativa `GET/POST /api/admin/storage-migration`. O `POST` exige `{ "action": "apply", "confirmation": "discard-supabase-test-writes" }`, grava o backup anterior no próprio Supabase e retorna apenas hashes e contagens. Repor a variável como `false` e reimplantar imediatamente após a verificação.

Se o Blob estiver suspenso por cota e a continuidade do produto for prioritária, a mesma rota aceita `{ "action": "bootstrap-versioned-baseline", "confirmation": "discard-supabase-test-writes" }`. Esse modo não lê o Blob: preserva backup dos documentos atuais, zera overlays de catálogo e estados operacionais e deixa o catálogo e o Radar usarem suas bases versionadas. Os blobs continuam preservados para uma recuperação posterior.

## Conflito

`conflict` significa que Blob e Supabase contêm estados diferentes. A execução normal não sobrescreve. `--replace-conflicts` exige autorização explícita, usa a versão exata lida no dry-run e mantém o estado anterior no diretório de backup.
