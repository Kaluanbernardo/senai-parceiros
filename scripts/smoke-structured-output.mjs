/**
 * Measures whether a model honours the strict JSON Schema the Radar depends on.
 *
 * `.env.example` has told operators for months to "re-run the smoke before
 * adopting" a model, without shipping the smoke. Advertised support is not
 * proof: a model that lists `structured_outputs` can still return prose, drop a
 * required property, or answer in English where Portuguese was demanded. Each
 * of those degrades silently at runtime — the batch is discarded and the item
 * keeps the source's own wording — so the failure looks exactly like "there was
 * nothing to rewrite".
 *
 * This script makes that difference measurable before a model reaches
 * production:
 *
 *   npm run ai:smoke                      # the configured OPENROUTER_MODEL
 *   npm run ai:smoke -- --model=<id>      # a candidate
 *   npm run ai:smoke -- --runs=5          # more samples (default 3)
 *   npm run ai:smoke -- --task=interview  # the adaptive interview instead
 *
 * The interview task is the stricter one: besides the schema, it checks that
 * the model read the situation, weighed alternative questions and asked about
 * the venue and the audience instead of presuming them.
 *
 * It never prints a credential, and it exits non-zero when a run failed, so it
 * can gate a handoff the same way `handoff:preflight` does.
 */

import { loadServerEnv } from '../server/lib/envFile.js';

loadServerEnv();

const { generateStructured } = await import('../server/lib/structuredGeneration.js');
const { validateEditorialSummary, validateEditorialTitle } = await import('../server/lib/radar/editorialService.js');

function argValue(name, fallback) {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
}

const runs = Math.max(1, Math.min(10, Number(argValue('runs', 3)) || 3));
const model = argValue('model', '');
if (model) process.env.OPENROUTER_MODEL = model;
const task = argValue('task', 'radar');

// The same shape the editorial pass sends, so a pass here means the Radar's own
// call works — not that some simpler schema happened to succeed.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'summary', 'topics'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const SAMPLES = [
  {
    id: 'ato-1',
    modo: 'editorial',
    tipo: 'ato oficial',
    fonte: 'Diário Oficial da União',
    data: '2026-07-15',
    titulo: 'PORTARIA SETEC/MEC Nº 1.234, DE 15 DE JULHO DE 2026',
    texto: 'Autoriza a oferta do curso técnico em mecatrônica, na forma subsequente, em três institutos federais, a partir do segundo semestre letivo.',
    temas: ['EPT'],
  },
  {
    id: 'en-1',
    modo: 'editorial',
    tipo: 'publicação institucional',
    fonte: 'Cedefop',
    data: '2026-05-02',
    titulo: 'Skills forecast for the green transition',
    texto: 'The report projects which skills European labour markets will demand during the green transition, with a chapter on vocational education and training providers.',
    temas: ['green skills', 'EPT'],
  },
];

const MESSAGES = [
  {
    role: 'system',
    content: [
      'Você escreve o Radar EPT do SENAI-SP para gestores que não são especialistas em legislação nem em pesquisa acadêmica.',
      'Responda sempre em português do Brasil, mesmo quando o texto recebido estiver em inglês.',
      'Para modo "editorial": escreva um título de até 110 caracteres dizendo o que o documento faz e para quem, sem começar por número de ato, e um resumo de duas a três frases explicando em linguagem simples o que muda na prática.',
      'Em "topics", devolva os temas recebidos traduzidos para o português, na mesma ordem e na mesma quantidade.',
    ].join(' '),
  },
  { role: 'user', content: JSON.stringify(SAMPLES) },
];

/**
 * Schema conformity is necessary but not sufficient: the Radar also discards
 * output that is valid JSON and still unusable. Checking both here is what
 * makes a green smoke mean "items will actually be rewritten".
 */
function inspect(data) {
  const items = Array.isArray(data?.items) ? data.items : null;
  if (!items) return { ok: false, reason: 'sem a propriedade items' };
  if (items.length !== SAMPLES.length) return { ok: false, reason: `devolveu ${items.length} de ${SAMPLES.length} itens` };
  const problems = [];
  for (const sample of SAMPLES) {
    const entry = items.find((item) => String(item?.id) === sample.id);
    if (!entry) {
      problems.push(`${sample.id}: ausente`);
      continue;
    }
    if (!validateEditorialTitle(entry.title, { title: sample.titulo })) problems.push(`${sample.id}: título recusado`);
    if (!validateEditorialSummary(entry.summary, { title: sample.titulo })) problems.push(`${sample.id}: resumo recusado`);
    if (!Array.isArray(entry.topics) || entry.topics.length !== sample.temas.length) problems.push(`${sample.id}: temas fora do formato`);
  }
  return problems.length ? { ok: false, reason: problems.join('; ') } : { ok: true, sample: items[0] };
}

/**
 * Estado de entrevista com um buraco evidente: a pessoa descreveu um evento sem
 * dizer onde acontece nem para quem. Um modelo que presume "na escola" ou
 * "para a indústria" — em vez de perguntar — falha aqui, e é exatamente o
 * pressuposto que a entrevista não pode fazer.
 */
const INTERVIEW_STATE = {
  category: 'organization',
  objective: 'speaker',
  answers: { context: 'Queremos um encontro sobre economia circular com uma organização convidada.' },
  transcript: [{
    turn: 1,
    displayedQuestion: 'Em que conversa ou evento essa organização entraria, e por quê?',
    answer: 'Queremos um encontro sobre economia circular com uma organização convidada.',
    targetField: 'context',
    dimensions: ['impact', 'alignment'],
  }],
  askedIds: ['context'],
  coveredFields: ['context'],
  remainingRequiredFields: ['desired_outcome', 'themes', 'audience', 'geography', 'constraints'],
  lastAnswer: 'Queremos um encontro sobre economia circular com uma organização convidada.',
  minQuestions: 4,
  maxQuestions: 12,
};

const PRESUMED = /\b(na (nossa|sua) (escola|unidade)|aqui na escola|industri[áa]rios)\b/i;

/**
 * A entrevista só melhora se o modelo pensar antes de perguntar: ler a
 * situação, pesar alternativas de ângulos diferentes e escolher uma. Um modelo
 * que devolve a pergunta sem esse trabalho passa no schema e continua soando
 * como formulário — por isso o smoke checa o raciocínio, não só o JSON.
 */
function inspectInterview(result) {
  const problems = [];
  const fields = (result.candidateQuestions || []).map((item) => item.targetField);
  if (!result.situationRead) problems.push('não leu a situação (situationRead vazio)');
  if (fields.length < 2) problems.push(`considerou ${fields.length} pergunta(s) antes de escolher`);
  if (new Set(fields).size !== fields.length) problems.push('candidatas repetem o mesmo campo');
  if (!result.chosenBecause) problems.push('não justificou a escolha (chosenBecause vazio)');
  if (!result.shouldStop && !result.question.prompt) problems.push('sem pergunta');
  const shown = `${result.question.prompt} ${result.question.helper} ${result.question.example}`;
  if (PRESUMED.test(shown)) problems.push('presume local ou público em vez de perguntar');
  if (result.question.prompt === INTERVIEW_STATE.transcript[0].displayedQuestion) problems.push('repetiu a pergunta anterior');
  return problems.length
    ? { ok: false, reason: problems.join('; ') }
    : { ok: true, sample: { prompt: result.question.prompt, considered: fields, because: result.chosenBecause } };
}

const configured = process.env.OPENROUTER_MODEL || '(padrão do provedor)';
console.log(`Tarefa: ${task === 'interview' ? 'entrevista adaptativa' : 'editorial do Radar'} · modelo: ${configured} · execuções: ${runs}\n`);

let passed = 0;
let firstSample = null;
for (let run = 1; run <= runs; run += 1) {
  try {
    if (task === 'interview') {
      const { generateNextQuestionWithProvider } = await import('../server/lib/interviewProvider.js');
      const result = await generateNextQuestionWithProvider(INTERVIEW_STATE);
      const verdict = inspectInterview(result);
      if (verdict.ok) {
        passed += 1;
        firstSample = firstSample || verdict.sample;
        console.log(`  ${run}/${runs} ok · ${result.trace.provider}:${result.trace.model}`);
      } else {
        console.log(`  ${run}/${runs} FALHOU · ${verdict.reason}`);
      }
      continue;
    }
    const generated = await generateStructured({
      task: 'radar_editorial_items',
      schema: SCHEMA,
      messages: MESSAGES,
      maxOutputTokens: 1200,
    });
    const verdict = inspect(generated.data);
    if (verdict.ok) {
      passed += 1;
      firstSample = firstSample || verdict.sample;
      console.log(`  ${run}/${runs} ok · ${generated.trace.provider}:${generated.trace.model}`);
    } else {
      console.log(`  ${run}/${runs} FALHOU · ${verdict.reason}`);
    }
  } catch (error) {
    // generateStructured raises codes, never provider bodies, so this is safe
    // to print: `invalid_output` is the model ignoring the schema,
    // `ai_not_configured` a missing key, `provider_4xx` an auth or quota fault.
    console.log(`  ${run}/${runs} ERRO · ${String(error?.message || 'provider_error')}`);
  }
}

console.log(`\n${passed}/${runs} execuções válidas.`);
if (firstSample && task === 'interview') {
  console.log('\nExemplo do que a entrevista perguntaria:');
  console.log(`  pergunta   : ${firstSample.prompt}`);
  console.log(`  considerou : ${firstSample.considered.join(' | ')}`);
  console.log(`  porque     : ${firstSample.because}`);
} else if (firstSample) {
  console.log('\nExemplo do que o Radar mostraria:');
  console.log(`  título: ${firstSample.title}`);
  console.log(`  resumo: ${firstSample.summary}`);
  console.log(`  temas : ${(firstSample.topics || []).join(' | ')}`);
}
if (passed < runs && task === 'interview') {
  console.log('\nUm modelo que falha aqui degrada em silêncio na seleção: a entrevista cai no roteiro local e volta a soar como formulário.');
} else if (passed < runs) {
  console.log('\nUm modelo que falha aqui degrada em silêncio no Radar: o lote é descartado e o item mantém o texto da fonte.');
  console.log('Escolha outro candidato entre os que anunciam structured_outputs:');
  console.log("  curl -s https://openrouter.ai/api/v1/models | jq -r '.data[] | select((.supported_parameters//[])|index(\"structured_outputs\")) | .id'");
}
process.exitCode = passed === runs ? 0 : 1;
