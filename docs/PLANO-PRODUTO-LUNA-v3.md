# Plano canônico de produto e execução — Luna v3

Atualizado em 17/07/2026. Este é o mapa vigente do próximo ciclo. Em caso de conflito, ele prevalece sobre `ARQUITETURA-v2-feedbacks.md`, `PLANO-ONDAS-2-6.md`, `HANDOFF-LUNA-v2.md` e decisões históricas sobre fotos.

## Objetivo do ciclo

Entregar uma ferramenta pública de MVP realmente funcional para profissionais da Gerência de Educação do SENAI-SP que:

1. ajuda uma pessoa leiga a descobrir e estruturar sua necessidade;
2. formula cada nova pergunta a partir do significado das respostas anteriores;
3. recomenda de 5 a 10 pesquisadores, escolas ou organizações já cadastrados;
4. mostra diferenças, evidências, riscos, lacunas e rastreabilidade completa;
5. exporta uma planilha XLSX rica, sem persistir entrevista ou resultado;
6. mantém um radar alimentado por fontes acadêmicas, governamentais e internacionais;
7. preserva fronteiras substituíveis para futura migração ao Azure do SENAI-SP.

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
- 31 testes automatizados aprovados e build de produção aprovado no commit `6e2fa14`.

### Lacunas críticas

1. A entrevista ainda é planejada localmente e não interpreta semanticamente cada resposta. Não existe `POST /api/selection/interview/next`.
2. O provider de IA só implementa avaliação via OpenRouter; não há contrato completo para gerar a próxima pergunta nem implementação OpenAI.
3. O ranking ainda depende de um briefing pouco profundo e pode produzir candidatos com notas e justificativas semelhantes.
4. Há 10 grupos óbvios de pesquisadores duplicados por nome, totalizando 22 registros envolvidos.
5. Escolas são concatenadas de duas bases sem catálogo canônico; SENAI, SENAC e outras redes podem aparecer duplicados.
6. O Radar publicado usa seeds por padrão. OpenAlex/Crossref são opcionais e não existem coletores completos para fontes governamentais e internacionais.
7. Os builders e pacotes antigos de PDF, DOCX e PPTX ainda existem, embora não apareçam mais na interface.

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
5. [Colocar o Radar em ingestão real](luna-v3/04-radar-real.md) — bloqueado pelo baseline; pode avançar em paralelo, sem atrasar a seleção.
6. [Consolidar XLSX, segurança e handoff Azure](luna-v3/05-xlsx-hardening-azure.md) — bloqueado pela shortlist e pelos catálogos; a parte Azure final também depende do Radar.

## Ordem de valor recomendada

1. Entrevista adaptativa.
2. Diferenciação e rastreabilidade do ranking.
3. Deduplicação dos catálogos.
4. Radar real com um thin slice por seção.
5. Remoção dos exportadores legados e hardening Azure.

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
- XLSX permite reconstruir briefing, pesos, notas, evidências, lacunas, exclusões e proveniência;
- as três seções do Radar exibem itens externos atuais, clicáveis e deduplicados;
- troca futura de OpenRouter/Vercel por provider e infraestrutura Azure ocorre por adapters e configuração;
- nenhum pesquisador volta a exibir foto, avatar, iniciais ou placeholder de mídia.

## Fog — decisões que não bloqueiam o próximo ticket

- banco definitivo do Radar no MVP e serviço equivalente na Azure;
- allowlist editorial final e responsáveis por revisar itens em quarentena;
- parâmetros corporativos de Entra ID, rede, observabilidade e retenção;
- templates oficiais de planilha e relatórios, quando forem enviados pelo usuário;
- atualização automática dos perfis públicos, que entra depois da estabilidade da seleção e do Radar.
