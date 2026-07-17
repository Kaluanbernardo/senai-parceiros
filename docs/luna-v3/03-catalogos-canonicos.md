# Ticket — Canonizar e deduplicar pesquisadores e escolas

## Objetivo

Garantir que catálogo, busca e ranking compartilhem entidades canônicas e nunca recomendem duas versões da mesma pessoa ou escola.

## Pesquisadores

1. Criar auditoria que use, nesta ordem: ID público do Scholar, ORCID, nome normalizado + instituição + país e sobreposição de produção.
2. Começar pelos 10 grupos óbvios: Christopher Winch, Elly de Bruijn, Georg Spöttl, Harmen Schaap, Jos Akkermans, Lorna Unwin, Margarita Pavlova, Marjaana Akkerman, Martin Mulder e Simon McGrath.
3. Criar tabela auditável de aliases, IDs incorporados, motivo e confiança.
4. Preservar artigos, URLs, biografia mais completa, aliases e redirecionamento de IDs antigos.
5. Scholar é fonte de identidade, nunca de foto. Nenhuma mídia de pesquisador pode voltar.

## Escolas

1. Criar `schoolCatalog` compartilhado por página e `getCandidatePool()`.
2. Normalizar nome, sigla, domínio, país, estado e cidade.
3. Modelar explicitamente rede nacional, departamento regional e unidade local.
4. Criar aliases auditáveis, começando por SENAI e SENAC.
5. Fundir grafias da mesma entidade, mas manter entidades de escopo distinto quando relevantes.
6. Preservar proveniência e regras de precedência dos campos.
7. Auditar duplicatas semânticas residuais entre `escolas.json` e `stakeholders.json`, inclusive nomes multilíngues e traduções que apontem para o mesmo domínio oficial (variantes de ITI/TVET e Shenzhen Polytechnic). A fusão só deve ocorrer quando identidade, domínio e contexto confirmarem a mesma entidade; redes, órgãos coordenadores e unidades com escopo diferente permanecem separados. Para aliases ambíguos, a chave canônica inclui domínio e país.

## Aceite

- uma pessoa aparece uma vez no catálogo e shortlist;
- IDs antigos resolvem para o canônico e nenhuma produção é perdida;
- variantes da mesma escola aparecem uma vez;
- SENAI Nacional, SENAI-SP e unidade local não são fundidos indevidamente;
- busca por alias encontra o registro canônico;
- relatório explica cada fusão e o pool de seleção usa a mesma fonte da UI.
- a auditoria de produção não deixa duas entradas canônicas para a mesma entidade quando os registros têm identificador ou domínio oficial coincidente;
- a auditoria de produção atual resulta em 154 registros escolares canônicos e nenhum nome normalizado repetido;

## Próximo desbloqueio

Desbloqueia `Importar stakeholders de planilhas XLSX`, que deve reutilizar os mesmos schemas, aliases e regras de identidade.
