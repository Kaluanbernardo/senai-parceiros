# Ticket — Importar stakeholders de planilhas XLSX

## Objetivo

Permitir que um administrador importe para o catálogo uma planilha produzida a partir do Gerador de Prompt, com validação, deduplicação, prévia e rastreabilidade. A importação deve adicionar ou enriquecer registros; nunca substituir silenciosamente um catálogo inteiro.

## Estado atual e lacunas de handoff

O fluxo funcional já foi implementado nesta branch: o Gerador de Prompt e o importador usam o contrato compartilhado `senai_catalog_v1`; o painel administrativo oferece upload XLSX, prévia, decisões por linha, deduplicação, idempotência, histórico, rollback protegido contra alterações posteriores e reidratação do catálogo após login.

O trabalho restante deste ticket é operacional e de QA:

- configurar o adapter durável privado no ambiente MVP e preparar a troca por Azure Blob/Storage Table;
- validar o round-trip com planilhas reais produzidas pelo Gerador de Prompt para pesquisador, escola e organização;
- confirmar no handoff que a mesma definição de colunas é usada pelo prompt, template, prévia, catálogo e exportação;
- revisar limites, retenção e rotação de credenciais sem persistir dados privados, fotos ou avatares.

## Contrato compartilhado

1. Criar um único módulo versionado, por exemplo `catalogImportSchema`, consumido pelo Gerador de Prompt e pelo importador.
2. Versão inicial: `senai_catalog_v1`.
3. Workbook obrigatório:
   - aba `Stakeholders`: uma linha de cabeçalho, uma entidade por linha, sem células mescladas, fórmulas, macros ou texto fora da tabela;
   - aba opcional `Metadados`: contexto da pesquisa, critérios, limitações, fontes que falharam e data de geração.
4. Colunas comuns obrigatórias ou recomendadas:
   - `schema_version`, `tipo_registro`, `nome`, `pais`, `cidade_estado`;
   - `resumo`, `descricao`, `areas_temas`, `aderencia_contexto`;
   - `website_oficial`, `contato_publico`;
   - `fontes`, `data_consulta`, `confianca`, `dados_nao_localizados`.
5. Identificadores devem ter colunas próprias, não uma lista opaca:
   - pesquisador: `orcid`, `google_scholar_url`, `openalex_id`;
   - escola/organização: `dominio_oficial`, `identificador_publico`, quando existir.
6. Colunas específicas:
   - pesquisador: `instituicao_atual`, `cargo`, `areas_especialidade`, `linhas_pesquisa`, `publicacoes_relevantes`, `citacoes`;
   - escola: `tipo_instituicao`, `nivel_rede`, `areas_formacao`, `niveis_oferta`, `relacao_industria`, `escala`, `acreditacoes`;
   - organização: `natureza_juridica`, `categoria`, `setor`, `atuacao`, `programas_relevantes`, `parcerias_industriais`, `alcance_geografico`.
7. Listas usam `;` como separador. Publicações usam formato documentado e parseável: `Título | URL | ano; ...`.
8. O contrato não contém foto, avatar ou qualquer campo de mídia para pesquisadores.

## Atualização do Gerador de Prompt

1. Substituir os schemas isolados pelo contrato compartilhado do catálogo.
2. Exigir os nomes e a ordem exatos das colunas da categoria escolhida.
3. Exigir `schema_version=senai_catalog_v1` e `tipo_registro` com valor controlado: `researcher`, `school` ou `organization`.
4. Incluir, além dos dados básicos, os campos que permitem ao catálogo selecionar e diferenciar stakeholders: aderência ao contexto, áreas/temas, evidências, fontes, confiança e lacunas.
5. Incluir os campos específicos da categoria: identificadores e produção pública de pesquisadores; oferta, escala e relação com a indústria de escolas; natureza, setor, programas, parcerias e alcance de organizações.
6. Proibir colunas extras, fórmulas, macros, títulos acima do cabeçalho e células mescladas.
7. Mover resumo, lacunas e limitações para a aba `Metadados`; não permitir prosa misturada às linhas importáveis.
8. Manter CSV UTF-8 apenas como fallback de pesquisa, deixando claro que o importador principal aceita XLSX. A conversão de CSV pode ser uma etapa posterior.
9. Oferecer download de um template XLSX vazio por categoria, gerado a partir do mesmo schema.

## Fluxo de importação

1. Disponível somente no painel administrativo.
2. Administrador escolhe a categoria ou permite detecção por `tipo_registro`.
3. Upload aceita somente `.xlsx`, com limites configuráveis de tamanho e quantidade de linhas; `.xlsm` e `.xls` são rejeitados.
4. Parser lê valores, nunca executa fórmulas, links, macros ou conteúdo externo.
5. Validar versão, aba, cabeçalhos, tipos, URLs, datas, campos obrigatórios e informações públicas.
6. Normalizar cada linha para o modelo canônico sem gerar IDs no cliente.
7. Comparar com o catálogo canônico e classificar linhas como:
   - novo registro;
   - atualização segura do registro existente;
   - possível duplicata ou conflito;
   - inválida.
8. Mostrar prévia com contagens, diferenças por campo, erros e fonte. Nenhuma gravação ocorre antes da confirmação.
9. Em conflito, permitir `manter existente`, `usar importado`, `mesclar campos` ou `ignorar linha`. A opção padrão é manter e revisar.
10. Confirmar o lote no servidor e devolver relatório com criados, atualizados, ignorados, conflitos e erros.
11. Registrar um `importBatchId`, operador, data, hash do arquivo, schema, decisões e IDs afetados, sem guardar o arquivo original além do necessário.
12. Permitir rollback administrativo do lote enquanto não houver edição posterior conflitante.

## Persistência e arquitetura

1. Criar `CatalogStore` server-side. O catálogo empacotado em JSON continua como seed, não como destino mutável.
2. Padrão recomendado para o MVP: batches imutáveis e manifesto versionado em Vercel Blob, com fake em memória para testes. Se já houver um banco provisionado, ele pode implementar o mesmo contrato sem alterar domínio ou UI.
3. O adapter Azure futuro usa Azure Blob ou banco corporativo por configuração, mantendo o mesmo contrato.
4. Operações mínimas: `previewImport`, `commitImport`, `rollbackImport`, `findCanonicalMatch` e `listImportBatches`.
5. Importação é idempotente por hash da linha + identificadores públicos; reenviar o mesmo arquivo não cria duplicatas.
6. Catálogo, busca e seleção leem a composição do seed canônico com registros persistidos pelo store.

## Segurança e limites

- autenticação de administrador e proteção CSRF/origin nas rotas de mutação;
- limite inicial recomendado: 5 MB e 1.000 linhas por lote;
- rejeitar fórmulas, arquivos protegidos, macros e estruturas XLSX anômalas;
- sanitizar valores contra formula injection em relatórios e reexportações;
- não importar dados privados, credenciais, documentos anexos ou contatos não publicados;
- nenhum import pode introduzir `foto` ou `image` em pesquisadores;
- logs não contêm o conteúdo integral das linhas.

## Testes de aceite

- planilha gerada conforme um prompt atual entra sem remapeamento manual;
- pesquisador, escola e organização passam por round-trip `template → pesquisa → XLSX → prévia → catálogo`;
- cabeçalho divergente aponta coluna exata e não grava nada;
- duplicata por Scholar/ORCID/domínio é detectada antes do commit;
- lote misto mostra novos, atualizações, conflitos e erros separadamente;
- reenviar o mesmo arquivo não duplica registros;
- rollback restaura o estado anterior quando permitido;
- catálogo e seleção passam a enxergar registros confirmados após o commit;
- recarregar ou redeployar não apaga a importação;
- usuário comum não acessa nem executa a importação.
