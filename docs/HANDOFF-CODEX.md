# Handoff para o Codex — Radar EPT e MVP público

Data: 30/07/2026
Branch: `claude/project-status-check-4y0jmf` · PR #8 (draft)
Base: `2138f9b` (merge do PR #7) · Topo: `014911b`
Preview: `https://senai-parceiros-git-claude-proj-ae86a6-kaluanbernardos-projects.vercel.app`

Decisão do produto registrada nesta sessão: **o MVP tem que funcionar na
Vercel**. Não planeje nada contando com o ambiente interno da Azure.

---

## 1. O problema aberto, e por onde começar

A aba **Novidades governamentais** mostra 2 itens, e os dois são os seeds
curados de `src/data/radar-seeds.json`. Nenhum ato do DOU aparece.

O que torna isso confuso: **a coleta funciona**. O último diagnóstico
(19:35) reporta, dentro de `sourceStatus.DOU.diagnostics`:

```
candidates: 4000   shortlisted: 811   retrieved: 19   eligible: 4
```

Quatro atos são descobertos, baixados, aprovados na elegibilidade e
contados. `DOU.count: 4`, `status: ok`. E a tela continua com 2.

### Hipótese principal, não verificada

`radarStore.hydrate()` só relê o Blob quando `force` é verdadeiro:

```js
// server/lib/radarStore.js
async hydrate({ force = false } = {}) {
  if (this.driver !== 'vercel_blob' || (!force && this.remoteHydrated)) return this.status();
```

E a leitura chama sem forçar:

```js
// server/lib/radar.js, getRadarItems
const hydrateError = await safeStoreCall(() => radarStore.hydrate({ force: live }));
```

`GET /api/radar/items` roda com `live: false`, então `force` é `false`.
Uma instância serverless que já hidratou **nunca mais relê o Blob**
enquanto estiver quente. O refresh grava o snapshot novo e atualiza a
memória da instância dele; qualquer outra instância continua servindo a
cópia antiga até ser reciclada.

Isso explica o sintoma inteiro: coleta correta, gravação correta, leitura
servindo um snapshot anterior ao DOU passar a funcionar.

**Como confirmar antes de mexer:** comparar `fetchedAt` devolvido pelo
`GET /api/radar/items` com o `fetchedAt` do refresh que acabou de rodar.
Se o GET responder uma data mais antiga, a hipótese está certa.

**Cuidado ao corrigir:** forçar `hydrate` em toda leitura resolve a
obsolescência e custa uma leitura de Blob por request. Vale considerar uma
hidratação com TTL curto, ou invalidação por ETag, em vez de `force: true`
incondicional.

### Hipóteses já descartadas nesta sessão

- **`provenance` perdido na normalização** — não é. `normalizeRadarItem`
  preserva `provenance` por spread (`src/domain/radar.js:75`).
- **Falha de gravação no Blob** — resolvida, ver seção 3.
- **Elegibilidade reprovando os atos** — `eligible: 4` prova que passam.

---

## 2. Estado por seção

| Seção | Situação | Fontes que entregam |
|---|---|---|
| Pesquisas | Funcionando | OpenAlex 12, Crossref 1, pesquisadores 1 |
| Internacional | Funcionando | OIT 5, ETF 4, OCDE 2 |
| Governo | **Quebrado** | só os 2 seeds; DOU coleta 4 mas não aparecem |

Fontes governamentais que respondem `ok` com zero itens: MEC/SETEC, INEP,
FAPESP, CEE-SP, InvestSP, Agência SP (RSS) e UNESCO-UNEVOC (RSS).
SEADE responde `web_403`. Centro Paula Souza oscila entre 1 item e
timeout. A raspagem genérica de `fetchWebItems` não casa com o HTML desses
portais, e isso é falha silenciosa: `status: ok`, `count: 0`.

Duração da coleta: entre 11s e 46s conforme a janela e os timeouts do
`in.gov.br`. Hoje em ~29s com janela de 7 dias.

---

## 3. O que foi resolvido, para não ser refeito

**Login no Preview.** As variáveis existiam mas estavam presas à branch
`codex/enriquece-perfis-institucionais`, já mergeada. Hoje valem para
todas as branches de Preview.

**Persistência do radar (era o bloqueio central).** `flush()` mandava
`ifMatch` sem nenhuma recuperação: um único `ETag mismatch` tornava-se
permanente, porque nada re-sincronizava o ETag local. O radar nunca
gravou nada até isso ser corrigido. Agora há CAS com retry limitado, e a
releitura usa `head` e não `hydrate` — `hydrate` substituiria o estado
local e descartaria o snapshot que se quer gravar. Ver
`server/lib/radarStore.js` e `radarStore.test.js`.

**Três filtros descartavam item sem data em silêncio**, sendo o primeiro
deles dentro de `fetchWebItems`, o que tornava os outros dois
irrelevantes. Critério unificado em `isEligibleRadarItem`.

**Leitura do DOU.** A edição não expõe os atos em âncoras — as 57 âncoras
da página são navegação e nenhuma aponta para `/web/dou/`. Os atos estão
no payload `<script id="params">`, chave `jsonArray`, ~7800 por janela.
Confirmado por impressão estrutural, não por suposição.

**Seleção por sinal temático.** Uma edição lista milhares de atos e uma
mão cheia é de EPT; pegar os 20 primeiros gastava toda requisição em ato
sem relação. `douCandidateSignal` filtra por título e órgão emissor antes
de gastar rede: 4000 → 811 → 20 buscados.

**Botão "Coletar agora"** visível só para admin, com diagnóstico por fonte
e bloco recolhível com o `lastRun` bruto. O botão "Atualizar" anterior
apenas relia o snapshot e induzia ao erro; virou "Recarregar".

**Bundle inicial** de 1.462 kB para 498 kB (rotas e catálogo semente sob
demanda).

---

## 4. Armadilhas que custaram caro aqui

Registro porque cada uma consumiu um ciclo inteiro de deploy.

**Um teste pode validar uma ficção.** O fixture `dou-edition.html` era
HTML escrito à mão com âncoras simples. A suíte passava enquanto a
produção retornava zero, porque a página real não tem âncoras de ato.
Ao mexer em coletor, verifique se o fixture corresponde à página real.

**Uma condição pode impedir que a própria hipótese seja testada.** O
parser de payload foi escrito com `anchored.length ? [] : parseEmbedded(...)`.
Como a navegação sempre produz âncoras, ele nunca rodou. O commit que
introduziu a hipótese também a tornou inobservável.

**Reavaliar com menos evidência que a decisão original inverte o
resultado.** A elegibilidade do DOU é decidida sobre o texto integral do
ato (até 12 mil caracteres); o que fica gravado é um resumo de 80
palavras. Reavaliar o item gravado pelo resumo reprovava o que a coleta
aprovara. Por isso a decisão passou a ser registrada em
`provenance.eligibility`.

**Contagem bruta engana.** `anchorItems: 26` parecia sucesso; após
deduplicação eram `1`. Sempre reporte o número depois do funil, não antes.

**O snapshot acumula.** Itens seguem entre execuções e não eram
reavaliados, então corrigir um filtro impedia erro novo mas nunca removia
o já gravado. Hoje há `storedItemStillQualifies`.

**`sanitizeProviderError` reduzia a mensagem à primeira palavra.** Um
timeout chegava rotulado como `"this"`, de `"This operation was aborted"`.

---

## 5. Método que funcionou

Depois de várias tentativas erradas por inferência, o que destravou foi
**instrumentar antes de corrigir**. O bloco `diagnostics` do DOU
(`editionsRead`, `anchorItems`, `embeddedItems`, `uniqueCandidates`,
`candidates`, `shortlisted`, `retrieved`, `eligible`, `markers`) permite
localizar a etapa exata da perda em uma única coleta.

`markers` reporta contagens e **nomes de chave** de JSON embutido, nunca
valores nem texto de página — há teste garantindo isso
(`directOfficial.test.js`). Preserve essa restrição ao estender.

Um ambiente de desenvolvimento sem acesso a `gov.br`, `in.gov.br` e
`openalex.org` não consegue validar coletor nenhum localmente. Toda
validação real desta sessão veio do Preview.

---

## 6. Sugestão de ordem

1. **Confirmar a obsolescência de leitura** comparando `fetchedAt` do GET
   com o do refresh. É a explicação mais provável dos 2 itens e não exige
   tocar em coletor.
2. **Verificar a pertinência dos 4 atos do DOU** assim que aparecerem. Um
   ato sobre terapia renal chegou a entrar antes de a elegibilidade passar
   a exigir termo explícito de EPT; o risco de falso positivo é real.
3. **Decidir o destino dos portais institucionais.** Sete fontes
   respondem `ok` com zero há toda a sessão. Ou se escreve coletor
   dedicado para cada uma, ou se as remove da lista — hoje elas aparecem
   no filtro "Fonte" e nunca produzem nada, o que promete mais do que
   entrega. A allowlist `RADAR_SOURCE_POLICY` tem 23 nomes e apenas uma
   parte é efetivamente coletada.
4. **Reduzir a duração da coleta**, hoje em ~29s com picos de 46s. O
   `in.gov.br` dá timeout com frequência.

## 7. Verificações antes de publicar

```
npm test          # 40 arquivos, 165 testes
npm run build     # alerta de chunk grande só do exceljs, que é dinâmico
node scripts/handoff-preflight.mjs --profile=mvp
```

Regras de continuidade do projeto seguem valendo, em especial: não
apresentar fallback como conteúdo gerado por IA, não inventar método,
resultado ou vínculo sem evidência pública, e produção somente com
autorização explícita.
