# Plano canônico de produto e execução — Luna v3

Atualizado em 17/07/2026. Este é o mapa vigente do próximo ciclo. Em caso de conflito, ele prevalece sobre `ARQUITETURA-v2-feedbacks.md`, `PLANO-ONDAS-2-6.md`, `HANDOFF-LUNA-v2.md` e decisões históricas sobre fotos.

## Objetivo do ciclo

Entregar uma ferramenta pública de MVP realmente funcional para profissionais da Gerência de Educação do SENAI-SP que:

1. ajuda uma pessoa leiga a descobrir e estruturar sua necessidade;
2. formula cada nova pergunta a partir do significado das respostas anteriores;
3. recomenda de 5 a 10 pesquisadores, escolas ou organizações já cadastrados;
4. mostra diferenças, evidências, riscos, lacunas e rastreabilidade completa;
5. exporta uma planilha XLSX rica, sem persistir entrevista ou resultado;
6. importa para o catálogo planilhas XLSX geradas por pesquisas orientadas pelo Gerador de Prompt;
7. mantém um radar alimentado por fontes acadêmicas, governamentais e internacionais;
8. preserva fronteiras substituíveis para futura migração ao Azure do SENAI-SP.

## Estado confirmado do produto

### Concluído ou suficientemente encaminhado

- autenticação do MVP com papéis de usuário e administrador;
- navegação principal por ferramentas: Início, Seleção, Catálogo, Radar e Prompt;
- Home sem privilegiar uma única feature;
- catálogo unificado com pesquisadores, escolas e organizações;
- gerador de prompt para deep research com saída estruturada;
- shortlist local com testes para 5 a 10 resultados, diversidade e risco grave;
- matriz com tratamento de sobreposição e radar comparativo/individual;
- interface com um único botão de exportação XLSX e workbook de nove abas;
- pesquisadores sem fotos, avatares, iniciais ou placeholders de mídia;
- 61 testes automatizados aprovados e build de produção aprovado na execução atual.

### Lacunas críticas remanescentes

1. O ranking já recebe o briefing e faz pré-seleção diversa para a IA, mas ainda precisa de calibração com casos reais para ampliar a diferença entre trade-offs.
2. A importação XLSX já tem contrato compartilhado, template, prévia, decisões por linha, idempotência, histórico e rollback; há adapters `file` e `vercel_blob` privados, faltando apenas configurar credencial corporativa/Blob Store.
3. O Radar já consulta fontes RSS institucionais, OpenAlex e Crossref, mantém snapshot válido, status por fonte e endpoint de refresh protegido por cron; há adapter `file`/`vercel_blob`, faltando ampliar a allowlist editorial.
4. A remoção de PDF, Word e PowerPoint foi aplicada ao fluxo e às dependências diretas; a limpeza de artefatos históricos deve ser confirmada no handoff.
5. A autenticação corporativa/Entra ID, rate limit compartilhado, quotas, alertas e o adapter Azure ainda precisam ser ligados sem levar credenciais pessoais.

## Decisões de produto vigentes

- A seleção de stakeholders é a feature principal; Radar é complementar.
- A primeira escolha é sempre: pesquisador, escola ou outra organização.
- A IA formula a próxima pergunta, mas regras determinísticas controlam cobertura, limites, segurança e encerramento.
- A entrevista deve ter entre 8 e 20 perguntas, variando conforme clareza, incertezas e respostas.
- Exemplos devem usar a categoria, objetivo e contexto atuais; escola para benchmarking não recebe exemplo de palestra sobre IA.
- Ranking limitado ao catálogo cadastrado, com shortlist normal de 5 a 10. Candidatos eliminados ou com risco grave não podem ser reintroduzidos apenas para completar cinco.
- Matriz principal: valor estratégico × viabilidade. Radar: impacto, alinhamento, credibilidade, colaboração, viabilidade e risco controlado.
- Risco grave confirmado zera o valor estratégico e registra a regra aplicada.
- Nada da entrevista, ranking ou resultado é persistido. A pessoa pode revisar respostas e exportar a rastreabilidade.
- Pesquisadores permanecem sem qualquer mídia de perfil. Google Scholar serve apenas para identidade, afiliação e produção.
- Apenas informações públicas entram no catálogo e no Radar.
- Importação XLSX é exclusiva do administrador, sempre passa por prévia e não sobrescreve registros automaticamente.
- O Gerador de Prompt e o importador usam o mesmo schema versionado; mudanças de colunas não podem ocorrer em apenas um dos lados.
- A aplicação nunca recebe credenciais pessoais no código. Segredos ficam somente no servidor e devem ser removidos/rotacionados no handoff.

## Estratégia de IA

Fronteira única no servidor:

```text
AiProvider.generateNextQuestion(interviewState)
AiProvider.evaluateCandidates(selectionBrief, candidates)
AiProvider.classifyRadarItem(publicItem)  // etapa posterior e opcional
```

Ordem de configuração:

1. OpenAI Platform API, somente se existir `OPENAI_API_KEY` com faturamento próprio de API;
2. OpenRouter (`openrouter/auto`) quando a OpenAI Platform não estiver disponível;
3. planejador e avaliador locais como fallback seguro.

A assinatura pessoal do ChatGPT não fornece automaticamente créditos ou uma chave utilizável pela aplicação. O Luna deve detectar apenas a presença das variáveis, nunca imprimir seus valores.

## Fronteira executável

Os tickets abaixo são o trabalho pronto para execução. A ordem indicada por dependências deve ser respeitada; itens sem dependência entre si podem ser paralelizados.

1. [Estabelecer baseline e contratos de regressão](luna-v3/00-baseline-e-contratos.md) — primeiro ticket obrigatório.
2. [Tornar a entrevista semanticamente adaptativa](luna-v3/01-entrevista-adaptativa.md) — bloqueado pelo baseline.
3. [Aprofundar avaliação e diferenciação da shortlist](luna-v3/02-avaliacao-e-shortlist.md) — bloqueado pela entrevista adaptativa.
4. [Canonizar e deduplicar pesquisadores e escolas](luna-v3/03-catalogos-canonicos.md) — bloqueado pelo baseline; pode avançar em paralelo com a entrevista.
5. [Importar stakeholders de planilhas XLSX](luna-v3/03b-importacao-xlsx.md) — bloqueado pelos catálogos canônicos; atualiza também o Gerador de Prompt.
6. [Colocar o Radar em ingestão real](luna-v3/04-radar-real.md) — bloqueado pelo baseline; pode avançar em paralelo, sem atrasar a seleção.
7. [Consolidar XLSX, segurança e handoff Azure](luna-v3/05-xlsx-hardening-azure.md) — bloqueado pela shortlist, pelos catálogos e pela importação; a parte Azure final também depende do Radar.

## Ordem de valor recomendada

1. Entrevista adaptativa.
2. Diferenciação e rastreabilidade do ranking.
3. Deduplicação dos catálogos.
4. Importação XLSX integrada ao Gerador de Prompt.
5. Radar real com um thin slice por seção.
6. Remoção dos exportadores legados e hardening Azure.

## Gates comuns

Cada ticket termina somente quando:

- testes novos e antigos passam;
- `npm run build` passa;
- smoke funcional e visual cobre desktop e celular;
- nenhum segredo, resposta de entrevista ou resultado é persistido ou enviado ao frontend indevidamente;
- falha de IA ou fonte externa mantém fallback útil;
- diff é revisado e arquivos temporários não relacionados permanecem fora do commit;
- há commit coeso e push da branch;
- preview Vercel é publicado somente depois dos gates locais; produção exige solicitação explícita.

## Definição de pronto do ciclo

- duas respostas semanticamente distintas produzem próximas perguntas materialmente distintas;
- entrevista vaga aprofunda e entrevista completa evita redundância, sempre entre 8 e 20 perguntas;
- shortlist contém possibilidades realmente diferentes e explica seus trade-offs;
- nenhuma pessoa ou escola canônica aparece duas vezes no catálogo ou ranking;
- uma pesquisa orientada pelo Gerador de Prompt produz um XLSX aceito pelo importador, com prévia, deduplicação, idempotência e persistência quando o adapter durável está configurado;
- XLSX permite reconstruir briefing, pesos, notas, evidências, lacunas, exclusões e proveniência;
- as três seções do Radar exibem itens externos atuais, clicáveis e deduplicados;
- troca futura de OpenRouter/Vercel por provider e infraestrutura Azure ocorre por adapters e configuração;
- nenhum pesquisador volta a exibir foto, avatar, iniciais ou placeholder de mídia.

## Estado de execucao em 17/07/2026

As ondas de baseline, entrevista adaptativa, catálogos canônicos, importação XLSX e ingestão RSS foram implementadas nesta branch. A seleção agora registra diferenciais comparativos, trade-offs, calibração por objetivo e pré-seleção diversa para o provider; a entrevista consulta OpenAI Platform ou OpenRouter no servidor, com fallback local, sem persistir respostas. O Gerador de Prompt e o importador compartilham o contrato `senai_catalog_v1`, a importação é idempotente e auditável, o Radar mantém snapshot e refresh protegido, e a exportação da seleção ficou restrita a uma planilha rica XLSX.

### Proximos passos para o Luna

1. Fechar avaliacao e shortlist: fazer as notas diferenciarem trade-offs, risco, evidencias e lacunas, mantendo de 5 a 10 resultados somente do catalogo.
2. Configurar o adapter `vercel_blob` privado do catálogo/Radar no ambiente MVP e preparar o mesmo contrato para Azure Blob/Storage Table ou banco corporativo.
3. Ampliar allowlist editorial e configurar o cron com segredo rotacionável.
4. Consolidar Entra ID, rate limit/quotas compartilhados, alertas, smoke visual e runbook de rotação/backup/restore para o handoff Azure.

O item 2 e o item 3 sao um unico fluxo de produto: qualquer mudanca de coluna deve ser feita no contrato compartilhado e refletida simultaneamente no prompt, no template XLSX, na previa e no catalogo canonico.

## Fog — decisões que não bloqueiam o próximo ticket

- banco definitivo do Radar no MVP e serviço equivalente na Azure;
- allowlist editorial final e responsáveis por revisar itens em quarentena;
- parâmetros corporativos de Entra ID, rede, observabilidade e retenção;
- templates oficiais de planilha e relatórios, quando forem enviados pelo usuário;
- atualização automática dos perfis públicos, que entra depois da estabilidade da seleção e do Radar.
