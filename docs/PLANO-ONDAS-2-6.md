# Plano de execução — Correções UX e Ondas 2 a 6

## Objetivo

Evoluir o MVP publicado a partir do commit `2f19e1b`, priorizando a seleção de stakeholders como principal valor do produto e mantendo Radar e atualização de perfis como trilhas posteriores. O trabalho continua incremental em React/Vite/MUI, sem persistir entrevistas ou resultados de seleção.

## Decisões consolidadas

- A seleção usa somente stakeholders já cadastrados.
- A entrevista guia um usuário leigo e não possui quantidade fixa: termina quando o contexto possui informação suficiente para diferenciar candidatos, respeitando o máximo de 20 perguntas.
- A shortlist tem de 5 a 10 candidatos elegíveis; risco grave confirmado ou critério eliminatório nunca é relaxado para completar a quantidade.
- A IA estrutura subnotas, evidências, hipóteses e lacunas; a fórmula final permanece determinística.
- A rastreabilidade expõe justificativas estruturadas, não raciocínio interno do modelo.
- O header apresenta somente as ferramentas principais; pesquisadores, escolas e organizações são categorias internas do Catálogo.
- Exemplos da entrevista são contextuais e nunca introduzem um tema incompatível com a categoria, o objetivo ou as respostas já fornecidas.
- Imagens e ilustrações devem apoiar orientação e confiança, com ativos locais, acessíveis e leves; não são decoração aleatória.
- A única exportação final será uma planilha XLSX rica com nove abas.
- Fotos são armazenadas no projeto/storage, nunca por hotlink, e mantêm origem e status.
- O Radar persiste apenas conteúdo público e proveniência; entrevistas e resultados continuam temporários.
- OpenRouter, armazenamento local e Vercel Cron são adapters substituíveis pelos serviços internos/Azure.

## Mapa de dependências

```text
P0 — restaurar seleção multirresultado ──> Onda 1.1 — correções UX
                                          │
                                          └──> Onda 2 — entrevista e ranking

Onda 2 — entrevista e ranking ──> Onda 3 — XLSX único
        │
        └──────────────> contrato estável para o handoff Azure

Onda 4 — imagens ───────────────> Azure Blob adapter

Onda 5 — Radar persistente ─────> Azure DB/Timer/IA adapters

Ondas 2–5 ──────────────────────> Onda 6 — hardening e handoff
```

O bloqueador P0 deve ser corrigido e publicado antes de qualquer melhoria visual. Onda 1.1 entra antes da Onda 2. Onda 4 pode avançar em paralelo com as Ondas 1.1, 2 e 3. A Onda 5 só deve entrar em implementação completa depois da escolha do banco do MVP. A documentação e os testes de contrato da Onda 6 podem avançar antes dos recursos Azure existirem.

## Fronteira imediata

### Trilha principal

Restaurar imediatamente a visualização multirresultado. Depois executar Onda 1.1 e começar pela Onda 2.1, seguindo até 2.6 sem trocar o contrato no meio da Onda 3.

### Trilha paralela segura

Executar Onda 4.1 imediatamente: vincular as nove fotos já existentes, publicar a primeira melhoria visível no Catálogo e preparar lotes revisáveis para as 91 restantes.

### Bloqueado por decisão externa

- Onda 5 completa: escolha e provisionamento de PostgreSQL para o MVP.
- Onda 6 Azure: recursos, Entra ID, Key Vault, storage, banco, scheduler e endpoint de IA fornecidos pelo SENAI-SP.

## P0 — restaurar a seleção multirresultado

### Diagnóstico reproduzido

- Os catálogos possuem 100 pesquisadores, 134 escolas e 100 organizações; não há falta de candidatos.
- O fallback local retorna cinco itens, mas produz dimensões e coordenadas idênticas para candidatos diferentes.
- Em um cenário de organizações, quatro candidatos receberam exatamente valor estratégico `82` e viabilidade `71`, ficando desenhados no mesmo ponto da matriz.
- O radar atual renderiza deliberadamente apenas o candidato selecionado, o que reforça a impressão de que existe uma única possibilidade.
- O problema combina baixa diferenciação das notas com visualizações que ocultam sobreposição; não deve ser resolvido apenas forçando a quantidade da shortlist.

### Correção mínima antes das outras ondas

- Criar teste de regressão com cinco candidatos e coordenadas idênticas.
- Garantir que comparação, matriz e radar representem todos os integrantes da shortlist.
- Aplicar collision handling na matriz: deslocamento controlado, agrupamento expansível ou outra técnica que preserve as coordenadas reais e torne cada candidato acessível.
- Mostrar na área de radar uma comparação dos cinco primeiros por pequenos múltiplos ou controle equivalente; manter radar individual para aprofundamento dos demais.
- Exibir legenda, nome, posição e alternativa textual; nenhum candidato pode existir apenas “atrás” de outro ponto.
- Instrumentar a trace com `catalogSize`, quantidade elegível, quantidade avaliada, quantidade retornada e motivos de exclusão.
- Testar também o caminho online com IA e o fallback local.

**Gate:** quando a shortlist tiver cinco a dez candidatos, todos aparecem na lista, na comparação e nas visualizações; candidatos com notas iguais continuam individualmente identificáveis.

## Onda 1.1 — correções visuais e navegação

### 1.1.1 Header orientado a ferramentas

- Manter no header somente Início, Seleção, Catálogo, Radar e Gerador de prompt.
- Remover links separados de Pesquisadores, Escolas e Organizações.
- Manter as três categorias visíveis e acessíveis dentro da página do Catálogo.
- Garantir que a pessoa sempre consiga identificar a ferramenta ativa e voltar ao Catálogo.

**Gate:** nenhuma categoria aparece duplicada no header; as três continuam acessíveis em até um clique depois de abrir o Catálogo.

### 1.1.2 Nova direção de cores

- Revisar contraste e hierarquia do tema atual antes de apenas adicionar mais cores.
- Manter azul institucional e vermelho SENAI como marca, com superfícies neutras mais claras.
- Aplicar cores temáticas mais expressivas e consistentes: seleção em violeta, catálogo em azul, Radar em teal e prompt em âmbar.
- Reduzir cinzas sem função, bordas pesadas e áreas excessivamente monocromáticas.
- Validar a paleta em Home, header, Catálogo, entrevista e resultados, incluindo estados hover, foco, erro, alerta e sucesso.

**Gate:** contraste AA, hierarquia perceptível sem depender somente da cor e nenhuma tela com mistura arbitrária de paletas.

### 1.1.3 Linguagem visual com imagens

- Criar ou selecionar uma imagem/ilustração leve para cada uma das quatro ferramentas da Home, mantendo peso visual equivalente.
- Usar ativos locais em WebP/SVG, sem hotlink, com `alt` informativo ou vazio quando decorativo.
- Usar retratos reais nos cards do Catálogo e resultados assim que cada imagem for aprovada.
- Considerar ilustrações contextuais discretas na entrada da entrevista e em estados vazios, sem competir com as perguntas.
- Definir orçamento de tamanho e lazy loading para não piorar o carregamento inicial.

**Gate:** as quatro ferramentas têm apoio visual coerente; imagens ajudam a distinguir funções; celular e conexão lenta continuam utilizáveis.

**Estimativa relativa:** S/M. Deve gerar um preview próprio antes da Onda 2.

## Onda 2 — entrevista, avaliação e shortlist

### 2.1 Semântica e contratos

- Fixar `Question`, `InterviewState`, `SelectionBrief`, subcritérios, evidências, eliminação e `SelectionResult`.
- Renomear a dimensão ambígua `risk` para um conceito inequívoco: `riskControl` quando nota alta significa risco mais controlado, ou aplicar penalidade explícita se o campo representar exposição.
- Criar compatibilidade temporária com o resultado atual, sem manter dois contratos permanentes.
- Criar fixtures para pesquisador, escola e organização.

**Gate:** contratos cobrem todos os campos do briefing e da rastreabilidade; testes antigos continuam passando.

### 2.2 InterviewEngine adaptativo

- Implementar `start`, `answer`, `revise` e `finalize` como funções puras.
- Criar um `InterviewPlanner` híbrido: regras determinísticas definem dimensões obrigatórias e limites; o adapter de IA escolhe o próximo aprofundamento, formula a pergunta e propõe exemplo contextual.
- Ramificar por categoria, objetivo, respostas anteriores, lacunas e nível de confiança do briefing.
- Cobrir contexto, resultado desejado, público, temas, contribuição, evidências, colaboração, viabilidade, restrições, risco, diversidade e incertezas.
- Manter uma pergunta por tela, exemplos simples, opção “não sei”, progresso por cobertura e revisão antes do cálculo.
- Substituir exemplos literais fixos por um `ExampleResolver` orientado pela IA que recebe categoria, objetivo, pergunta atual e respostas anteriores.
- Usar primeiro as palavras e o cenário informados pela pessoa; quando ainda não houver contexto suficiente, usar fallback específico para categoria + objetivo.
- Nunca sugerir evento, IA, indústria, escola, palestrante ou outro cenário que contradiga o fluxo atual.
- Exemplos esperados: escola para benchmarking recebe referência a prática, governança ou modelo pedagógico; pesquisador para palestra recebe referência a formato, público e contribuição; organização parceira recebe referência a projeto, recursos e execução.
- Após cada resposta, calcular cobertura e incerteza por dimensão; perguntar novamente somente quando a informação adicional puder mudar filtros, pesos ou diferenciação dos candidatos.
- Encerrar quando dimensões obrigatórias estiverem suficientemente cobertas e não houver lacuna crítica; contextos claros podem ter entrevistas curtas e contextos vagos exigem mais aprofundamento.
- Limitar a 20 perguntas, impedir repetição sem propósito e registrar apenas um `reasonTag` estruturado para cada pergunta, nunca chain-of-thought.
- Se a IA falhar, continuar com o planejador determinístico e exemplos seguros por categoria + objetivo.

**Gate:** a quantidade de perguntas varia conforme cobertura e incerteza, com máximo de 20; revisão altera o briefing sem reiniciar a sessão; nenhum dado é persistido; os exemplos mudam quando categoria, objetivo ou contexto mudam.

### 2.3 Briefing, pesos e pré-filtro

- Gerar `SelectionBrief` estruturado a partir das respostas.
- Derivar pesos dentro de faixas controladas; o usuário não edita percentuais.
- Aplicar critérios eliminatórios antes da IA.
- Extrair features com campo/URL de origem e pré-classificar todo o catálogo.
- Selecionar 20–30 candidatos para avaliação profunda.

**Gate:** contextos contrastantes geram briefings, pesos e conjuntos de candidatos materialmente diferentes.

### 2.4 Avaliação por IA em lotes

- Evoluir o adapter OpenRouter para resposta estruturada por subcritério.
- Processar lotes pequenos com timeout, retry controlado, limite de chamadas e fallback determinístico.
- Validar toda evidência sugerida pela IA contra campos e URLs do catálogo.
- Recalcular notas no servidor; a IA não fornece o total final.

**Gate:** falha ou ausência de chave conclui o fluxo localmente; schema inválido nunca chega à UI; custo e quantidade de lotes ficam registrados na trace.

### 2.5 Recomposição, risco e diversidade

- Calcular as seis dimensões a partir dos subcritérios e pesos do briefing.
- Zerar o fit estratégico em risco grave confirmado e registrar a regra aplicada.
- Reranquear por similaridade e cobertura, com bônus/penalidade visíveis.
- Produzir 5–10 resultados dentro de uma janela de qualidade.
- Marcar candidatos elegíveis de menor confiança como exploratórios; nunca reintroduzir eliminados.
- Se houver menos de cinco elegíveis, explicar o impedimento e oferecer revisão de restrição.
- Penalizar resultados excessivamente semelhantes e premiar cobertura de abordagens, geografias, instituições e tipos de contribuição, sempre sem ultrapassar o fit contextual.

**Gate:** testes provam eliminação, risco grave, diversidade auditável e limites 5–10.

### 2.6 Resultados e rastreabilidade

- Atualizar comparação, matriz com tratamento de colisões e radar comparativo + individual para a nova shortlist.
- Exibir por subcritério: nota, peso, evidência, regra, confiança, lacuna e ajuste de diversidade.
- Diferenciar recomendado, exploratório, eliminado e informação ausente.
- Explicar em linguagem direta por que cada possibilidade difere das demais e qual trade-off ela representa.
- Manter revisão das respostas e recalcular o resultado.
- Oferecer alternativa textual para gráficos e navegação completa por teclado.

**Gate:** um avaliador técnico consegue reconstruir todas as notas usando somente a trace exibida.

### Testes essenciais da Onda 2

- Máquina de entrevista: ramificação, skip, revisão, máximo de perguntas e finalização.
- Planejador adaptativo: contexto claro encerra antes; contexto vago aprofunda; cobertura e incerteza determinam a próxima pergunta.
- Adapter de entrevista: schema inválido, timeout e ausência de chave acionam fallback determinístico sem interromper o usuário.
- Exemplos contextuais: escola + benchmarking nunca recebe exemplo de evento sobre IA; alteração do tema atualiza os exemplos seguintes sem apagar respostas.
- Briefing: normalização, pesos em faixa e incertezas.
- Cenários contrastantes: economia circular versus IA industrial, com rankings diferentes.
- Pré-filtro: todos os candidatos considerados e eliminados com motivo.
- Adapter: lote válido, schema inválido, timeout, retry e fallback.
- Fórmula: recomposição, risco grave e limites 0–100.
- Diversidade: penalidade de similaridade e cobertura registradas.
- Visualização multirresultado: pontos coincidentes permanecem acessíveis e cinco radares comparativos representam cinco candidatos diferentes.
- Fluxo integrado: login, entrevista, revisão e resultado em desktop e celular.

**Estimativa relativa:** XL. Há um primeiro preview útil após 2.2 e um preview decisório após 2.5.

## Onda 3 — planilha XLSX única

### Sequência

1. Congelar `snapshotSelection()` como fonte compartilhada entre UI e workbook.
2. Criar `SelectionWorkbook` atrás da API atual de exportação.
3. Implementar helpers para hyperlinks, sanitização contra formula injection, estilos, filtros, freeze panes, wrap e larguras.
4. Criar as nove abas na ordem fixa:
   - `Leia-me`;
   - `Contexto`;
   - `Shortlist`;
   - `Comparação detalhada`;
   - `Evidências`;
   - `Riscos e lacunas`;
   - `Respostas`;
   - `Metodologia`;
   - `Catálogo considerado`.
5. Testar round-trip com ExcelJS e smoke em Excel/LibreOffice.
6. Trocar a interface para um único botão XLSX.
7. Somente depois dos gates, remover PDF, DOCX, PPTX e suas dependências.

### Critérios de aceite

- O workbook abre sem reparo e possui exatamente nove abas.
- Site e planilha exibem os mesmos candidatos, notas, pesos, evidências, riscos, lacunas e regras.
- Shortlist exportada respeita 5–10 e identifica exploratórios.
- Catálogo considerado inclui elegibilidade e motivo de exclusão.
- Hyperlinks são clicáveis; filtros e painéis congelados funcionam; Unicode é preservado.
- Nenhum segredo, token, cookie ou raciocínio interno aparece no arquivo.

**Estimativa relativa:** L, depois que o `SelectionResult` da Onda 2 estiver estável.

## Onda 4 — imagens dos pesquisadores

### Sequência

1. Adicionar schema `image` e manifesto por `researcherId`.
2. Vincular e validar as nove imagens locais já existentes como primeiro incremento visível, antes da pesquisa das demais.
3. Implementar `ResearcherMedia` e `LocalImageStore`, mantendo o seam para Azure Blob.
4. Gerar WebP 320/640, checksum, dimensões e fallback acessível.
5. Pesquisar as 91 imagens restantes em lotes de 10–20.
6. Registrar origem, tipo, licença, atribuição, data, confiança e status.
7. Fazer revisão nominal/contextual; não usar reconhecimento facial.
8. Remover `ui-avatars` somente quando a cobertura aprovada atingir 100/100.
9. Exibir cobertura `approved / needs-review / missing` no manifesto para impedir que placeholders sejam confundidos com fotos concluídas.

### Critérios de aceite

- 100/100 pesquisadores possuem imagem real aprovada.
- Nenhum card depende de hotlink ou `ui-avatars`.
- Toda imagem possui proveniência e pode ser substituída ou removida sem quebrar o perfil.
- Casos ambíguos ficam em `needs-review`, nunca como aprovados.
- Cada lote publicado aumenta a cobertura real; nenhum lote substitui um placeholder por outra imagem genérica.

**Estimativa relativa:** M técnico + XL de pesquisa e revisão de conteúdo. Pode rodar em paralelo com as Ondas 2 e 3.

## Onda 5 — Radar persistente

### Sequência

1. Escolher PostgreSQL do MVP e criar migrations/repository.
2. Implementar adapters fake e testes de ingestão idempotente.
3. Entregar um thin slice OpenAlex por identidade confirmada de pesquisador.
4. Adicionar Crossref, deduplicação e quarentena de identidade ambígua.
5. Adicionar um feed federal, um estadual de São Paulo e um organismo internacional.
6. Implementar classificação, resumo em português, proveniência e publicação/quarentena.
7. Criar cron protegido, checkpoints, retry/backoff e painel de saúde.
8. Trocar a UI para `RadarQuery` com facets, paginação e freshness.
9. Remover seeds e modo demonstração da produção.

### Critérios de aceite

- A página nunca consulta fonte externa diretamente.
- Jobs são idempotentes e falhas de coleta não derrubam a leitura.
- DOI, OpenAlex ID, URL canônica e hash impedem duplicações.
- Cada item publicado possui fonte original, data, idioma, resumo PT, temas, relevância e proveniência.
- Identidades ambíguas e itens duvidosos ficam em quarentena.
- Admin mostra última execução, falhas, itens em quarentena e fontes desatualizadas.

**Estimativa relativa:** XL e maior risco técnico. Bloqueado para produção pela escolha do banco e credenciais de cron/provider.

## Onda 6 — hardening e handoff Azure

### Sequência

1. Tornar configuração server-only, validada e fail-closed.
2. Criar contract tests para adapters OpenRouter/Azure/fake, JSON/Postgres, Local/Azure Blob e Vercel/Azure Timer.
3. Aplicar rate limiting compartilhado, quotas, timeouts, idempotência e alertas de custo.
4. Garantir logs sem respostas privadas, prompts integrais, cookies ou segredos.
5. Produzir matriz de variáveis, runbook de rotação, backup, restore, rollback e migração.
6. Remover e revogar todas as chaves pessoais no handoff.
7. Validar em homologação Azure quando os recursos do SENAI-SP estiverem disponíveis.

### Critérios de aceite

- Nenhum segredo aparece em Git, browser, exportação ou logs.
- Troca para Azure ocorre por configuração/adapters, sem fork do domínio ou da UI.
- Jobs são autenticados e idempotentes.
- Observabilidade cobre saúde, latência, erros, custo e versão de provider/modelo.
- O time de TI consegue operar, rotacionar e restaurar o sistema seguindo o runbook.

**Estimativa relativa:** L para hardening e skeleton; XL se incluir integração e homologação Azure completas.

## Gates comuns por entrega

- Testes novos e antigos passam.
- Build passa sem erro.
- Smoke responsivo e de teclado é executado.
- Smoke visual compara header, paleta, imagens, exemplos contextuais e cobertura de fotos com o incremento anterior.
- Nenhum segredo ou dado temporário é persistido.
- Os dois arquivos pessoais não rastreados permanecem intocados.
- Diff é revisado antes do commit.
- Cada incremento recebe commit coeso e preview Vercel; produção somente mediante solicitação explícita.

## Riscos e decisões futuras

- Definir PostgreSQL do MVP, backup e retenção antes da Onda 5.
- Definir quem aprova imagens `needs-review` e como tratar licença desconhecida antes do gate 100/100.
- Receber do SENAI-SP os recursos Azure, política de rede e configuração Entra ID antes da homologação.
- Confirmar allowlist editorial de fontes do Radar e responsáveis por revisar quarentena.
- Monitorar custo/latência do OpenRouter; manter fallback determinístico e teto de chamadas.
