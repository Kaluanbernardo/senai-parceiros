# Handoff — MVP de seleção de stakeholders

> Documento histórico. Para o estado atual do produto e do handoff Azure, use `docs/HANDOFF-LUNA-v3.md`, `docs/PLANO-PRODUTO-LUNA-v3.md` e `docs/AZURE-HANDOFF-RUNBOOK.md`. Não execute instruções conflitantes deste arquivo.

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
- OPENROUTER_MODEL: openrouter/auto. Todo fluxo exige JSON Schema estrito, e um modelo que o ignora degrada em silêncio — o lote é descartado e o item mantém o texto da fonte. Meça um candidato antes de adotá-lo com `npm run ai:smoke -- --model=<id> --runs=5`.
- OPENROUTER_COST_QUALITY_TRADEOFF: 7.
- RADAR_LIVE_SOURCES: deixe false para a base curada de demonstração; use true no ambiente controlado para habilitar as buscas acadêmicas live no OpenAlex e Crossref.
- OPENALEX_API_KEY: obrigatória para o Radar de pesquisadores; a chave gratuita deve existir somente no servidor.
- OPENALEX_MAILTO: legado opcional; o OpenAlex substituiu o antigo "polite pool" por autenticação com API key.
- RADAR_SUMMARY_PROVIDER: habilita os resumos acadêmicos por IA. Deixe vazio, false ou off para desligar.
- RADAR_EDITORIAL_PROVIDER: habilita os títulos e resumos editoriais em português. Quando não definida, segue RADAR_SUMMARY_PROVIDER.
- RADAR_EDITORIAL_MAX_ITEMS: teto de itens reescritos por coleta, padrão 48.
- RADAR_EDITORIAL_DEADLINE_MS: prazo da fase editorial, padrão 25000. Ela roda depois de todos os coletores e antes da gravação do snapshot, então o prazo existe para que um timeout da função não custe à coleta tudo o que ela já reuniu.

Nunca use prefixo VITE_ nessas variáveis, não as inclua em exportações e não as envie no chat ou no repositório. Antes do handoff, remova e revogue chaves pessoais.

## Fluxos entregues

- autenticação de todo o site com papéis user/admin;
- seleção guiada de pesquisador, escola ou organização;
- avaliação local determinística com catálogo completo;
- refinamento opcional com OpenRouter Auto e saída JSON estruturada;
- shortlist de zero a cinco, faixas de decisão, matriz, radar, ficha técnica e rastreabilidade;
- exportação XLSX, PDF, Word e PowerPoint;
- Gerador de Prompt provider-independent com esquema por categoria.
- Radar EPT com abas de novas pesquisas, novidades governamentais e novidades internacionais, filtros, links originais, fontes permitidas e fallback curado.
- Radar em português: títulos e resumos editoriais em linguagem simples para atos dos diários oficiais e tradução do conteúdo publicado em inglês, sempre com o título original preservado no cartão. Sem provedor de IA configurado, valem apenas as regras determinísticas (caixa legível do ato, glossário de tipos e temas), e o cartão avisa quando o texto exibido ainda é o da fonte.

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

## Próxima sequência

- conectar adaptadores de fontes governamentais e internacionais com cache e rotina agendada;
- atualizar perfis públicos em quarentena, preservando proveniência por campo;
- complementar as imagens reais com licença/origem registrada.

## Fora desta fase

Atualização automática de perfis, coleta agendada completa de fontes, login corporativo Entra ID, persistência de catálogo e cobertura das imagens restantes.
