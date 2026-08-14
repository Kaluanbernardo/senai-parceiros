# PRD — Plataforma de Inteligência de Stakeholders SENAI-SP

## 1. Objetivo

Permitir que profissionais da Gerência de Educação do SENAI-SP, mesmo sem uma demanda inicialmente bem formulada, descubram, comparem e justifiquem a escolha de stakeholders para iniciativas ligadas à educação profissional de qualidade e ao desenvolvimento da indústria paulista.

O produto deve transformar um contexto ainda impreciso em uma shortlist defensável de cinco a dez stakeholders já cadastrados, com rastreabilidade integral, e também ajudar a produzir prompts padronizados para pesquisas externas mais amplas.

> Atualização v3: o plano vigente e as decisões mais recentes estão em `docs/PLANO-PRODUTO-LUNA-v3.md`. Em caso de conflito, o plano v3 prevalece.

## 2. Prioridade de entrega

### Fase 1 — núcleo funcional

1. Autenticação do site com dois papéis: usuário e administrador.
2. Página inicial com apresentação equilibrada das ferramentas, sem priorizar uma única feature.
3. Catálogo existente de pessoas especialistas, instituições de educação e organizações.
4. Seleção guiada de stakeholders nas três categorias.
5. Avaliação multidimensional aprofundada, shortlist diversa de cinco a dez resultados e revisão das respostas.
6. Comparação por ranking, faixas de decisão, matriz de valor estratégico × viabilidade com tratamento de sobreposição e radar comparativo + individual.
7. Rastreabilidade de perguntas, respostas, critérios, pesos, evidências, fórmula, modelo e confiança.
8. Exportação única em uma planilha XLSX rica e auditável.
9. Gerador de Prompt para Deep Research com esquema padronizado por categoria.
10. Importação administrativa do XLSX resultante para o catálogo, com prévia, validação e deduplicação.

### Fase 2 — enriquecimento e monitoramento

1. Atualização automática e periódica dos perfis públicos.
2. Radar EPT completo: novas pesquisas das pessoas com atuação acadêmica cadastradas, novidades governamentais e publicações internacionais, com ingestão automática, persistência, classificação e proveniência.
3. Fontes permitidas, quarentena, proveniência por campo, bloqueios manuais e rotinas de atualização.
4. Catálogo textual de pessoas especialistas sem fotos, avatares, iniciais ou placeholders de mídia.

O Radar atual é uma base de transição. A versão v2 remove seeds e modo demonstração da leitura e passa a servir somente conteúdo processado por uma rotina de ingestão persistente.

## 3. Usuário principal

Profissional da Gerência de Educação do SENAI-SP que procura parceiros, referências, especialistas e convidados; frequentemente começa com uma necessidade pouco estruturada e precisa apresentar uma recomendação detalhada a leitores tecnicamente exigentes.

## 4. Fluxo de seleção

1. Escolher uma categoria: pessoa especialista, instituição de educação ou outra organização.
2. Escolher a finalidade: convidado/palestrante, parceiro de projeto, referência para benchmarking, apoio a pesquisa ou orientação totalmente guiada.
3. Responder uma pergunta por tela em uma entrevista adaptativa, com exemplos, escolhas guiadas, opção “não sei ainda”, retorno e progresso aproximado.
4. Revisar e, se necessário, alterar qualquer resposta.
5. Avaliar apenas registros existentes no catálogo.
6. Receber de cinco a dez resultados elegíveis; resultados abaixo da faixa recomendada aparecem como exploratórios, com lacunas explícitas.
7. Examinar possibilidades materialmente distintas na comparação, matriz, radares, ficha técnica e evidências.
8. Exportar o resultado. Nada da avaliação é persistido pela aplicação.

A entrevista não possui quantidade fixa. Um planejador adaptativo usa categoria, objetivo, respostas, cobertura e incertezas para decidir o próximo aprofundamento e encerrar quando houver informação suficiente para diferenciar candidatos, com limite máximo de 20 perguntas. Perguntas redundantes são puladas e falha da IA aciona um fluxo determinístico equivalente.

## 5. Modelo de avaliação

Dimensões fixas, pontuadas de 0 a 100:

- impacto potencial;
- alinhamento estratégico contextual;
- credibilidade;
- capacidade de colaboração;
- viabilidade de engajamento;
- risco controlado, em que pontuação maior representa menor risco conhecido.

O sistema pode adaptar subcritérios e pesos a partir das respostas, mas o usuário não edita pesos diretamente. A interface explica os pesos aplicados. Risco grave, confirmado por evidência objetiva e autoritativa, zera o valor estratégico; alegações isoladas não recebem esse tratamento.

O valor estratégico institucional considera competitividade e desenvolvimento sustentável da indústria, educação profissional conectada ao trabalho, inovação, tecnologia, empreendedorismo industrial, desenvolvimento regional, sustentabilidade, transformação digital, parcerias, Indústria 4.0, ESG, descarbonização e economia circular. O contexto informado pelo usuário determina a aderência específica de cada avaliação.

## 6. IA e arquitetura

- Provedor inicial: OpenRouter, modelo `openrouter/auto`, equilíbrio custo/qualidade 7.
- A chave existe apenas no servidor e deve ter limite de crédito.
- Toda resposta usada pelo sistema deve obedecer a esquema estruturado e ser validada.
- O modelo efetivamente escolhido, versão do avaliador, uso e horário aparecem na rastreabilidade.
- Falha, indisponibilidade ou resposta inválida aciona avaliação local determinística.
- A integração é acessada por uma interface de provedor, substituível por Azure OpenAI ou serviço interno.
- Nenhum segredo fica no código, navegador, exportação ou log de conteúdo.

## 7. Privacidade e autenticação

- O site exige autenticação; há uma credencial de usuário e uma de administrador.
- Credenciais e segredo de sessão ficam em variáveis protegidas do servidor.
- Chamadas de IA exigem sessão válida e possuem limitação de frequência.
- Respostas e avaliações vivem apenas na memória da página atual; atualizar ou fechar elimina o conteúdo.
- Respostas não devem ser registradas em logs da aplicação.
- Antes do handoff, chaves pessoais devem ser removidas e revogadas.
- A camada de autenticação deve permitir substituição futura por Microsoft Entra ID pelo time de TI.

## 8. Gerador de Prompt

O gerador não executa a pesquisa. Ele entrevista o usuário, produz um prompt independente de fornecedor e exige:

- schema versionado compartilhado com o importador, com nomes, ordem e tipos exatos das colunas;
- planilha XLSX quando suportada e CSV UTF-8 como alternativa obrigatória;
- fontes públicas, evidências e data de consulta;
- indicação “não localizado” para ausência de informação;
- proibição de inventar colunas ou fatos;
- núcleo comum e campos específicos para pessoa, instituição de educação ou organização; dados acadêmicos são opcionais dentro de pessoa.

O XLSX importável usa uma aba `Stakeholders`, sem prosa, fórmulas, macros, células mescladas ou colunas extras. Contexto e limitações ficam em uma aba opcional `Metadados`.

## 9. Importação de stakeholders

- Disponível apenas para administrador.
- Aceita `.xlsx` conforme o schema vigente e oferece template vazio por categoria.
- Mostra prévia com novos registros, atualizações, possíveis duplicatas, conflitos e linhas inválidas.
- Nunca substitui silenciosamente o catálogo completo; conflitos exigem decisão explícita.
- Usa identificadores públicos, aliases e regras canônicas para deduplicação.
- Persiste o lote no servidor com rastreabilidade e possibilidade de rollback seguro.
- Registros importados passam a ser consumidos pelo catálogo, busca e seleção.
- Somente informações públicas podem ser incorporadas.

## 10. Critérios de aceite

- Um usuário leigo conclui o fluxo sem ajuda em até dez minutos.
- A lista contém de cinco a dez candidatos elegíveis; itens exploratórios são identificados e nunca apresentados como equivalentes aos recomendados.
- Todos os integrantes da shortlist ficam individualmente visíveis na comparação, matriz e radares, mesmo quando possuem notas ou coordenadas iguais.
- Cada candidato explicita diferenças, trade-offs e contribuição complementar em relação aos demais.
- Quando houver dez candidatos adequados, um avaliador especialista considera ao menos oito defensáveis e materialmente distintos entre si.
- Todo valor exibido pode ser ligado a uma resposta, critério ou campo de origem.
- Não há afirmação factual material sem suporte nos dados fornecidos.
- Alterar uma resposta recalcula toda a avaliação de forma coerente.
- A planilha XLSX abre sem reparo e representa integralmente contexto, shortlist, subcritérios, evidências, riscos, respostas e metodologia.
- Uma planilha produzida conforme o Gerador de Prompt entra no catálogo sem remapeamento manual e sem criar duplicatas silenciosas.
- Sem configuração de IA, o fallback local conclui o fluxo.
- A chave do OpenRouter nunca aparece no pacote do navegador ou no repositório.

## 11. Fora do escopo da fase 1

- descoberta automática de novos stakeholders para o ranking;
- histórico de avaliações, contas individuais ou banco de respostas;
- alertas por e-mail, push ou preferências pessoais;
- equivalência móvel para visualizações analíticas avançadas;
- integração corporativa com Entra ID;
- personalização final dos relatórios antes do recebimento dos templates institucionais.
