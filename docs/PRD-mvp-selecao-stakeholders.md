# PRD — Plataforma de Inteligência de Stakeholders SENAI-SP

## 1. Objetivo

Permitir que profissionais da Gerência de Educação do SENAI-SP, mesmo sem uma demanda inicialmente bem formulada, descubram, comparem e justifiquem a escolha de stakeholders para iniciativas ligadas à educação profissional de qualidade e ao desenvolvimento da indústria paulista.

O produto deve transformar um contexto ainda impreciso em uma shortlist defensável de cinco a dez stakeholders já cadastrados, com rastreabilidade integral, e também ajudar a produzir prompts padronizados para pesquisas externas mais amplas.

> Atualização v2: os feedbacks mais recentes e a arquitetura de execução estão detalhados em `docs/ARQUITETURA-v2-feedbacks.md`. Em caso de conflito, a arquitetura v2 prevalece.

## 2. Prioridade de entrega

### Fase 1 — núcleo funcional

1. Autenticação do site com dois papéis: usuário e administrador.
2. Página inicial orientada à tarefa.
3. Catálogo existente de pesquisadores, escolas e organizações.
4. Seleção guiada de stakeholders nas três categorias.
5. Avaliação multidimensional aprofundada, shortlist diversa de cinco a dez resultados e revisão das respostas.
6. Comparação por ranking, faixas de decisão, matriz de valor estratégico × viabilidade e radar individual.
7. Rastreabilidade de perguntas, respostas, critérios, pesos, evidências, fórmula, modelo e confiança.
8. Exportação única em uma planilha XLSX rica e auditável.
9. Gerador de Prompt para Deep Research com esquema padronizado por categoria.

### Fase 2 — enriquecimento e monitoramento

1. Atualização automática e periódica dos perfis públicos.
2. Radar EPT completo: novas pesquisas dos pesquisadores cadastrados, novidades governamentais e publicações internacionais, com ingestão automática, persistência, classificação e proveniência.
3. Fontes permitidas, quarentena, proveniência por campo, bloqueios manuais e rotinas de atualização.
4. Complementação das fotos reais com registro de origem e possibilidade de substituição.

O Radar atual é uma base de transição. A versão v2 remove seeds e modo demonstração da leitura e passa a servir somente conteúdo processado por uma rotina de ingestão persistente.

## 3. Usuário principal

Profissional da Gerência de Educação do SENAI-SP que procura parceiros, referências, especialistas e convidados; frequentemente começa com uma necessidade pouco estruturada e precisa apresentar uma recomendação detalhada a leitores tecnicamente exigentes.

## 4. Fluxo de seleção

1. Escolher uma categoria: pesquisador, escola ou outra organização.
2. Escolher a finalidade: convidado/palestrante, parceiro de projeto, referência para benchmarking, apoio a pesquisa ou orientação totalmente guiada.
3. Responder uma pergunta por tela em uma entrevista adaptativa, com exemplos, escolhas guiadas, opção “não sei ainda”, retorno e progresso aproximado.
4. Revisar e, se necessário, alterar qualquer resposta.
5. Avaliar apenas registros existentes no catálogo.
6. Receber de cinco a dez resultados elegíveis; resultados abaixo da faixa recomendada aparecem como exploratórios, com lacunas explícitas.
7. Examinar comparação, matriz, radar, ficha técnica e evidências.
8. Exportar o resultado. Nada da avaliação é persistido pela aplicação.

A entrevista deve durar aproximadamente oito a doze minutos, normalmente com 14 a 18 perguntas e limite de 20. Perguntas redundantes são puladas por ramificação.

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

- nomes, ordem e tipos exatos das colunas;
- planilha XLSX quando suportada e CSV UTF-8 como alternativa obrigatória;
- fontes públicas, evidências e data de consulta;
- indicação “não localizado” para ausência de informação;
- proibição de inventar colunas ou fatos;
- núcleo comum e campos específicos para pesquisador, escola ou organização.

## 9. Critérios de aceite

- Um usuário leigo conclui o fluxo sem ajuda em até dez minutos.
- A lista contém de cinco a dez candidatos elegíveis; itens exploratórios são identificados e nunca apresentados como equivalentes aos recomendados.
- Quando houver dez candidatos adequados, um avaliador especialista considera ao menos oito defensáveis e materialmente distintos entre si.
- Todo valor exibido pode ser ligado a uma resposta, critério ou campo de origem.
- Não há afirmação factual material sem suporte nos dados fornecidos.
- Alterar uma resposta recalcula toda a avaliação de forma coerente.
- A planilha XLSX abre sem reparo e representa integralmente contexto, shortlist, subcritérios, evidências, riscos, respostas e metodologia.
- Sem configuração de IA, o fallback local conclui o fluxo.
- A chave do OpenRouter nunca aparece no pacote do navegador ou no repositório.

## 10. Fora do escopo da fase 1

- descoberta automática de novos stakeholders para o ranking;
- histórico de avaliações, contas individuais ou banco de respostas;
- alertas por e-mail, push ou preferências pessoais;
- equivalência móvel para visualizações analíticas avançadas;
- integração corporativa com Entra ID;
- personalização final dos relatórios antes do recebimento dos templates institucionais.
