# Handoff — MVP de seleção de stakeholders

## Rodar localmente

1. Instale as dependências com npm install.
2. Copie .env.example para .env.local.
3. Preencha as duas credenciais, AUTH_SESSION_SECRET com pelo menos 32 caracteres e, quando desejar IA real, OPENROUTER_API_KEY.
4. Execute npm run dev.

O Vite local usa os mesmos handlers de api/ por meio de server/viteApiPlugin.js. Em Vercel, as funções de api/ são usadas diretamente.

## Variáveis protegidas

- AUTH_SESSION_SECRET: assinatura das sessões HttpOnly.
- AUTH_ADMIN_USERNAME e AUTH_ADMIN_PASSWORD: credencial administrativa.
- AUTH_USER_USERNAME e AUTH_USER_PASSWORD: credencial de usuário.
- AI_PROVIDER: atualmente openrouter.
- OPENROUTER_API_KEY: chave somente no servidor.
- OPENROUTER_MODEL: openrouter/auto.
- OPENROUTER_COST_QUALITY_TRADEOFF: 7.

Nunca use prefixo VITE_ nessas variáveis, não as inclua em exportações e não as envie no chat ou no repositório. Antes do handoff, remova e revogue chaves pessoais.

## Fluxos entregues

- autenticação de todo o site com papéis user/admin;
- seleção guiada de pesquisador, escola ou organização;
- avaliação local determinística com catálogo completo;
- refinamento opcional com OpenRouter Auto e saída JSON estruturada;
- shortlist de zero a cinco, faixas de decisão, matriz, radar, ficha técnica e rastreabilidade;
- exportação XLSX, PDF, Word e PowerPoint;
- Gerador de Prompt provider-independent com esquema por categoria.

As respostas da seleção vivem somente na memória da página. O site não grava histórico. O painel administrativo ainda edita o catálogo apenas na sessão do navegador; a persistência compartilhada será conectada na etapa Azure.

## Pontos de migração Azure/SENAI-SP

- Substitua server/lib/ai.js por um adaptador Azure OpenAI ou endpoint interno que retorne o mesmo contrato de evaluateWithProvider.
- Substitua server/lib/catalog.js por um repositório persistente e valide os registros no servidor.
- Troque a sessão HMAC de server/lib/cookies.js pelo adaptador de Microsoft Entra ID quando o time de TI disponibilizar a integração.
- Mova imagens e arquivos para o armazenamento aprovado pelo SENAI-SP.
- Preserve os contratos de rastreabilidade e os quatro formatos de exportação.

## Verificações

O comando npm test executa os testes de entrevista, pontuação e prompt. npm run build valida o pacote Vite. A geração dos quatro arquivos é carregada sob demanda; o build pode alertar sobre chunks grandes dos geradores.

O npm audit ainda reporta duas vulnerabilidades moderadas transitivas do uuid usado pelo ExcelJS. O exportador apenas gera arquivos e não abre planilhas fornecidas pelo usuário; reavalie a dependência antes de produção.

## Fora desta fase

Radar de novidades, atualização automática de perfis, coleta de fontes, login corporativo Entra ID, persistência de catálogo e cobertura das imagens restantes.
