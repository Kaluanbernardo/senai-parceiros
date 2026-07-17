# Ticket — Colocar o Radar em ingestão real

## Objetivo

Substituir o modo de demonstração por conteúdo público atual, deduplicado e rastreável nas três seções.

## Thin slice obrigatório

1. Pesquisa: OpenAlex + Crossref, preferencialmente por identidades confirmadas dos pesquisadores cadastrados.
2. Governo: ao menos uma fonte federal e uma paulista com RSS/API ou HTML público estável.
3. Internacional: ao menos uma fonte entre OCDE, OIT, UNESCO-UNEVOC, Cedefop, ETF, Banco Mundial e BID.

## Arquitetura

1. Adapters independentes de coleta; IA não é necessária para descobrir nem preservar título, URL e data.
2. Normalização e deduplicação por DOI, OpenAlex ID, URL canônica ou hash.
3. `RadarStore` substituível com último snapshot válido; escolher armazenamento persistente do MVP sem acoplar domínio à Vercel.
4. Cron protegido, idempotente, com checkpoint, retry/backoff e timeout.
5. IA opcional para resumo em português, tema e relevância, sempre mantendo conteúdo original e proveniência.
6. Leitura nunca consulta fontes externas diretamente; falha de uma fonte não derruba o Radar.
7. UI mostra modo, última atualização, fonte, filtros, freshness e estado de erro/desatualização.

## Aceite

- três seções exibem itens externos atuais e clicáveis;
- filtros operam sobre dados ingeridos, não seeds;
- duplicatas aparecem uma vez com proveniência preservada;
- endpoint serve o último snapshot válido durante falhas;
- execução registra quantidade, erros, duração e atualização;
- nenhuma chave aparece no browser ou nos logs.

## Expansão após o thin slice

- federal: MEC/SETEC, CNE, INEP, MTE, MDIC, ABDI, IPEA e DOU;
- São Paulo: Governo de SP, Centro Paula Souza, CEE-SP, SEADE, FAPESP e InvestSP;
- internacional: ampliar a allowlist após validar qualidade editorial.
