# Runbook de handoff — SENAI-SP Parceiros

Este runbook descreve o que o time de TI precisa configurar ou substituir. Nenhuma credencial pessoal deve ser copiada para o repositório, para a planilha ou para o navegador.

## Estado atual do MVP

- Branch de referência: `codex/enriquece-perfis-institucionais`.
- Autenticação provisória: dois papéis (`admin` e `user`) com credenciais server-only.
- IA: OpenAI Platform, OpenRouter (`openrouter/auto`) ou Azure OpenAI por adapter, escolhidos por `AI_PROVIDER`.
- Catálogo/Radar: memória para desenvolvimento e MVP público; `file` para execução controlada local; `vercel_blob` para armazenamento privado compartilhado na etapa corporativa.
- Rate limit e orçamento de IA: o contrato atômico server-only já está implementado; `file` usa lock exclusivo e `vercel_blob` usa compare-and-swap (`ifMatch`) com retry. A configuração compartilhada ainda precisa ser ligada no ambiente corporativo.
- Alertas: adapter server-only opcional por webhook HTTPS, com payload sanitizado e deduplicação; nenhum prompt, resposta, token ou IP é enviado.
- Radar: refresh protegido em `/api/radar/refresh`, agendado diariamente às 09:00 UTC em `vercel.json`, compatível com o plano Hobby do Vercel. A migração futura pode aumentar a frequência por Azure Timer/Functions.
- O `vite preview` local também monta os handlers `/api/*`, permitindo testar o build de produção com autenticação, catálogo, Radar e status antes do deploy.
- No Vercel Hobby, os handlers administrativos são consolidados em `/api/admin/[action]` e encaminhados às implementações de `server/routes/admin`; isso mantém as rotas externas estáveis e reduz o pacote atual a 10 funções publicáveis. Testes não devem voltar para `api/`, pois seriam contados como funções pelo Vercel.
- Seleção: respostas, briefings e resultados não são persistidos; somente a planilha exportada sai pelo navegador.
- Pesquisadores não possuem foto, avatar, iniciais ou placeholder de mídia.

## Configuração Vercel MVP

1. Criar um Blob Store privado e conectar o projeto.
2. Definir `CATALOG_STORE_DRIVER=vercel_blob` e `RADAR_STORE_DRIVER=vercel_blob`.
3. Definir `BLOB_STORE_ID` e usar OIDC do projeto ou `BLOB_READ_WRITE_TOKEN` gerenciado pela equipe; nunca usar chave pessoal.
4. Definir `CATALOG_BLOB_PATH` e `RADAR_BLOB_PATH` com caminhos estáveis.
5. Definir `RADAR_CRON_SECRET`/`CRON_SECRET` como segredo aleatório rotacionável.
6. Cadastrar feeds adicionais somente em `RADAR_EXTRA_FEEDS_JSON`; o servidor aceita apenas fontes oficiais já allowlisted e URLs HTTPS. As páginas HTML institucionais padrão já estão no código e também são observadas no status do Radar.
7. Definir `AUTH_PROVIDER=local` no MVP, `AUTH_SESSION_SECRET`, credenciais provisórias e limites de IA no ambiente de produção, nunca em `VITE_*`. O adapter server-only de Entra ID já está implementado em `server/lib/entra.js`, com entrada em `POST /api/auth/entra`; para ativá-lo, registrar o aplicativo e os grupos no tenant corporativo, preencher as variáveis `ENTRA_*` abaixo e trocar para `AUTH_PROVIDER=entra`. O login local continuará desabilitado nesse modo.
8. Validar `GET /api/radar/refresh` com o segredo de cron e conferir `lastRun`, `itemCount`, `sourceStatus`, feeds configurados e `store.durable=true`.
9. Como administrador, validar `GET /api/admin/status`; o retorno deve conter apenas flags de configuração e status dos stores, nunca segredos, prompts, respostas ou IPs. O bloco `handoff` resume a prontidão do MVP (`handoff.mvp`) e lista os bloqueadores corporativos (`handoff.corporate.blockers`), incluindo Entra ID, armazenamento atômico, alertas, cron e feeds definitivos.
10. Para alertas, definir `OPS_ALERT_WEBHOOK_URL` somente com endpoint HTTPS corporativo e, opcionalmente, `OPS_ALERT_COOLDOWN_SECONDS`/`AI_ALERT_THRESHOLD`. Testar um evento de orçamento em ambiente de homologação antes de ativar produção.
11. Para aceitar o MVP atual, executar `npm run handoff:preflight:mvp`; o comando retorna somente checks e status sanitizado e deve terminar com `ok: true` sem imprimir valores de ambiente. Quando o TI provisionar Azure/Entra, executar adicionalmente `npm run handoff:preflight:corporate` para validar a migração futura.

## Migração para Azure

Substituir somente adapters e configuração:

- `CatalogStore`: Azure Blob Storage, Table Storage ou banco corporativo, preservando `previewImport`, `commitImport`, `rollbackImport`, idempotência por hash e manifesto de lotes.
- `RadarStore`: Blob/Cosmos/SQL com snapshot imutável, checkpoint e retenção definida.
- IA: `AI_PROVIDER=azure`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` e segredo em Key Vault.
- Refresh: Azure Timer/Functions chama o mesmo contrato do endpoint protegido, com identidade gerenciada e sem segredo no código.
- Autenticação: ativar o adapter server-side de Entra ID, mantendo os papéis de usuário e administrador mapeados por grupo. O contrato de sessão e os endpoints protegidos permanecem os mesmos.
- Rate limit/orçamento: o MVP oferece adapters `memory`, `file` e `vercel_blob`; os caminhos compartilhados usam transação atômica (lock de arquivo ou CAS de Blob), sem IP bruto, prompts ou respostas. Na Azure, substituir o mesmo contrato por Redis/Storage e manter os alertas sanitizados.

### Contrato mínimo de Entra ID

O adapter corporativo já substitui o login local HMAC sem exigir mudança nas páginas React ou nos endpoints protegidos. O cliente corporativo deve obter um token OIDC pela integração aprovada pelo time de TI e enviá-lo uma única vez para `POST /api/auth/entra`, no corpo JSON (`{"token":"..."}`) ou no header `Authorization: Bearer ...`; o servidor valida o token e devolve apenas a sessão HttpOnly. O segundo formato permite usar Azure Easy Auth ou um proxy corporativo sem expor token ao React.

- validar assinatura e claims (`iss`, `aud`, `exp`, `nbf`) contra o tenant corporativo e JWKS oficial;
- mapear grupos corporativos para os papéis `admin` e `user`; ausência de grupo autorizado resulta em resposta genérica `401` no endpoint de troca de token (sem revelar se o grupo existe);
- rejeitar tokens expirados, de outro tenant, de outra aplicação ou com assinatura inválida;
- manter `requireSession(req, res, roles)` como fronteira única para as APIs existentes;
- emitir apenas uma sessão HttpOnly, Secure e SameSite apropriada, sem devolver token ao frontend;
- desabilitar o formulário de usuário/senha quando `AUTH_PROVIDER=entra`; o fallback local só pode existir explicitamente no ambiente MVP;
- se Azure Easy Auth ou um proxy corporativo for usado, definir `ENTRA_TRUST_PROXY_HEADERS=true` somente atrás desse proxy; o endpoint de sessão aceitará o header `x-ms-token-aad-id-token` e fará a mesma validação antes de criar a sessão;
- usar identidade gerenciada/Key Vault para segredos e registrar somente eventos operacionais, nunca tokens ou claims integrais. Tokens com group overage (`_claim_names.groups`/`hasgroups`) são rejeitados até que TI forneça uma integração Graph aprovada.

Configuração mínima (valores de produção ficam somente no ambiente corporativo):

```text
AUTH_PROVIDER=entra
ENTRA_TENANT_ID=<tenant GUID>
ENTRA_CLIENT_ID=<application/client ID>
ENTRA_ADMIN_GROUP_ID=<group GUID>
ENTRA_USER_GROUP_ID=<group GUID>
ENTRA_ISSUER=https://login.microsoftonline.com/<tenant GUID>/v2.0
ENTRA_JWKS_URL=https://login.microsoftonline.com/<tenant GUID>/discovery/v2.0/keys
ENTRA_TRUST_PROXY_HEADERS=false
```

O repositório não deve receber `client_secret`, certificado, token ou valor de produção. A Microsoft documenta os claims de acesso e o discovery OIDC/JWKS usados por essa validação: [claims de access token](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference) e [OIDC/discovery](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc).

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

## Gate de aceite do MVP

`npm test -- --run`, `npm run build` e `npm run handoff:preflight:mvp` devem passar. Depois, validar login, seleção, importação XLSX com replay idempotente, rollback, Radar com fonte indisponível e refresh autenticado. A revisão visual deve ser feita antes da publicação do MVP.

O preflight corporativo não bloqueia esta entrega; ele é o gate da migração futura e permanece documentado para o time de TI.
