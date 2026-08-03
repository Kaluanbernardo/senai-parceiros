import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUsageBudget, resetUsageBudgetForTests } from '../usageBudget.js';
import { editorialInputHash, editorializeRadarItems, editorialPriority, validateEditorialSummary, validateEditorialTitle } from './editorialService.js';

const EDITORIAL_TITLE = 'Institutos federais ganham autorização para abrir cursos técnicos em mecatrônica';
const EDITORIAL_SUMMARY = 'O documento autoriza três institutos federais a oferecer cursos técnicos em mecatrônica a partir do próximo semestre. Na prática, amplia as vagas disponíveis para quem procura formação na área industrial.';

function gazetteItem(id, overrides = {}) {
  return {
    id,
    externalId: id,
    section: 'government',
    title: `PORTARIA Nº ${id}, DE 15 DE JULHO DE 2026`,
    summaryPt: 'Relação com educação profissional: autoriza a oferta de cursos técnicos em mecatrônica.',
    sourceName: 'Diário Oficial da União',
    contentType: 'ato oficial',
    topics: ['EPT'],
    publishedAt: '2026-07-15',
    provider: 'direct-official',
    ...overrides,
  };
}

function respondWith(build) {
  return vi.fn(async (_url, request) => {
    const payload = JSON.parse(request.body);
    const requested = JSON.parse(payload.messages.at(-1).content);
    return {
      ok: true,
      json: async () => ({
        model: 'test/model',
        usage: { total_tokens: 300 },
        choices: [{ message: { content: JSON.stringify({ items: requested.map(build) }) } }],
      }),
    };
  });
}

beforeEach(() => {
  process.env.AI_PROVIDER = 'openrouter';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'test/model';
  process.env.RADAR_EDITORIAL_PROVIDER = 'openrouter';
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetUsageBudgetForTests();
  delete process.env.RADAR_EDITORIAL_PROVIDER;
  delete process.env.RADAR_EDITORIAL_MAX_ITEMS;
});

describe('reescrita editorial do Radar', () => {
  it('substitui o título legal do ato por uma manchete em linguagem simples', async () => {
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })));

    const { items: [item] } = await editorializeRadarItems([gazetteItem('1234')]);

    expect(item.displayTitle).toBe(EDITORIAL_TITLE);
    expect(item.displaySummary).toBe(EDITORIAL_SUMMARY);
    expect(item.editorialStatus).toBe('ai');
    expect(item.rawSourceText).toBe(false);
    // The act's own title is what makes the card traceable back to the gazette.
    expect(item.originalTitle).toBe('PORTARIA Nº 1234, DE 15 DE JULHO DE 2026');
    expect(item.editorialProvenance).toMatchObject({ provider: 'openrouter', model: 'test/model' });
    expect(getUsageBudget('radar-editorial')).toMatchObject({ requests: 1, tokens: 300 });
  });

  it('traduz o item internacional e devolve os temas em português', async () => {
    const english = {
      id: 'cedefop-1',
      externalId: 'cedefop-1',
      section: 'international',
      title: 'Skills forecast for the green transition',
      summaryPt: 'Report on skills and training needs across European labour markets.',
      sourceName: 'Cedefop',
      contentType: 'publicação institucional',
      topics: ['green skills', 'EPT'],
      publishedAt: '2026-05-02',
    };
    vi.stubGlobal('fetch', respondWith((item) => ({
      id: item.id,
      title: 'Previsão de competências para a transição verde na Europa',
      summary: 'O relatório projeta quais competências o mercado europeu vai exigir na transição verde. Serve de referência para quem planeja novos cursos técnicos ligados a energia e sustentabilidade.',
      topics: ['competências verdes', 'EPT'],
    })));

    const { items: [item] } = await editorializeRadarItems([english]);

    expect(item.displayTitle).toBe('Previsão de competências para a transição verde na Europa');
    expect(item.topics).toEqual(['competências verdes', 'EPT']);
    expect(item.rawSourceText).toBe(false);
  });

  it('mantém os temas coletados quando o modelo devolve uma lista de tamanho diferente', async () => {
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: ['EPT', 'tema inventado'] })));

    const { items: [item] } = await editorializeRadarItems([gazetteItem('9')]);

    expect(item.topics).toEqual(['EPT']);
  });

  it('descarta uma manchete que apenas repete a referência do ato', async () => {
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: 'Portaria nº 1.234, de 15 de julho de 2026', summary: EDITORIAL_SUMMARY, topics: item.temas })));

    const { items: [item] } = await editorializeRadarItems([gazetteItem('1234')]);

    expect(item.editorialTitle).toBeNull();
    expect(item.displayTitle).toBe('Portaria nº 1234, de 15 de julho de 2026');
    expect(item.displaySummary).toBe(EDITORIAL_SUMMARY);
  });

  it('descarta um texto gerado que continua em inglês', async () => {
    vi.stubGlobal('fetch', respondWith((item) => ({
      id: item.id,
      title: 'Federal institutes are allowed to open new technical courses',
      summary: 'The act allows three federal institutes to open new technical courses in the next academic term for students.',
      topics: item.temas,
    })));

    const { items: [item] } = await editorializeRadarItems([gazetteItem('77')]);

    expect(item.editorialTitle).toBeNull();
    expect(item.editorialSummary).toBeNull();
    expect(item.rawSourceText).toBe(true);
  });

  it('processa os itens em lotes de no máximo seis', async () => {
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })));

    const items = Array.from({ length: 7 }, (_, index) => gazetteItem(`lote-${index + 1}`));
    const { items: result } = await editorializeRadarItems(items);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.every((item) => item.editorialStatus === 'ai')).toBe(true);
  });

  it('reaproveita a reescrita anterior quando o texto de origem não mudou', async () => {
    const current = gazetteItem('cache');
    const previous = {
      ...current,
      editorialStatus: 'ai',
      editorialTitle: EDITORIAL_TITLE,
      editorialSummary: EDITORIAL_SUMMARY,
      editorialInputHash: editorialInputHash(current),
      editorialProvenance: { provider: 'openrouter', model: 'cached/model' },
    };
    vi.stubGlobal('fetch', vi.fn());

    const { items: [item] } = await editorializeRadarItems([current], { previousItems: [previous] });

    expect(fetch).not.toHaveBeenCalled();
    expect(item.displayTitle).toBe(EDITORIAL_TITLE);
    expect(item.editorialProvenance).toMatchObject({ model: 'cached/model' });
    expect(getUsageBudget('radar-editorial')).toMatchObject({ requests: 0, tokens: 0 });
  });

  it('reescreve de novo quando o ato passou a trazer outro texto', async () => {
    const current = gazetteItem('mudou');
    const previous = {
      ...current,
      summaryPt: 'Relação com educação profissional: texto anterior, hoje substituído.',
      editorialStatus: 'ai',
      editorialTitle: 'Manchete antiga sobre cursos técnicos',
      editorialSummary: EDITORIAL_SUMMARY,
      editorialInputHash: editorialInputHash({ ...current, summaryPt: 'Relação com educação profissional: texto anterior, hoje substituído.' }),
    };
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })));

    const { items: [item] } = await editorializeRadarItems([current], { previousItems: [previous] });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(item.displayTitle).toBe(EDITORIAL_TITLE);
  });

  it('não chama o provedor quando a reescrita não está habilitada', async () => {
    delete process.env.RADAR_EDITORIAL_PROVIDER;
    process.env.RADAR_SUMMARY_PROVIDER = 'false';
    vi.stubGlobal('fetch', vi.fn());

    const { items: [item] } = await editorializeRadarItems([gazetteItem('off')]);

    expect(fetch).not.toHaveBeenCalled();
    // The deterministic layer still applies, so the card never shows the shout.
    expect(item.displayTitle).toBe('Portaria nº off, de 15 de julho de 2026');
    delete process.env.RADAR_SUMMARY_PROVIDER;
  });

  it('respeita o teto de itens reescritos por coleta e ainda relata a fila inteira', async () => {
    // Reporting only the capped slice made a run that filled its quota look like
    // a run that emptied the queue: the caller stopped and everything beyond the
    // cap kept the source's wording.
    process.env.RADAR_EDITORIAL_MAX_ITEMS = '6';
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })));

    const { items: result, stats } = await editorializeRadarItems(Array.from({ length: 12 }, (_, index) => gazetteItem(`teto-${index + 1}`)));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.filter((item) => item.editorialStatus === 'ai')).toHaveLength(6);
    expect(stats).toMatchObject({ pending: 12, candidates: 6, rewritten: 6 });
  });

  it('reescreve primeiro o que o leitor vê primeiro, e não o que é ato oficial', async () => {
    // The interface sorts by publication date descending, so the top of the tab
    // is the only thing most people ever look at. Ordering the queue by kind
    // rewrote March acts ahead of an August paper, and the visible top of the
    // list stayed in the source's wording run after run.
    process.env.RADAR_EDITORIAL_MAX_ITEMS = '1';
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })));
    const oldAct = gazetteItem('antigo', { publishedAt: '2026-03-25' });
    const recentNews = {
      id: 'novo', externalId: 'novo', section: 'government', publishedAt: '2026-08-03',
      title: 'MEC announces new funding for technical schools',
      summaryPt: 'The ministry announced new funding for technical schools across the country this week.',
      sourceName: 'MEC / SETEC', contentType: 'notícia institucional', topics: ['EPT'],
    };

    const { items } = await editorializeRadarItems([oldAct, recentNews]);

    expect(items.find((item) => item.externalId === 'novo').editorialStatus).toBe('ai');
    expect(items.find((item) => item.externalId === 'antigo').editorialStatus).toBe('source');
  });

  it('gasta o prazo que o chamador concedeu, e não um teto proprio mais curto', async () => {
    // The standalone rewrite has no collection ahead of it and the whole budget
    // to spend; capping it at the 25s meant for the tail of a collection halved
    // its throughput for no reason.
    process.env.RADAR_EDITORIAL_DEADLINE_MS = '1';
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })));

    const { stats } = await editorializeRadarItems([gazetteItem('x')], { deadlineAt: Date.now() + 30_000 });

    expect(stats).toMatchObject({ rewritten: 1, deadlineReached: false });
    delete process.env.RADAR_EDITORIAL_DEADLINE_MS;
  });

  it('dá a Novas Pesquisas metade da cota, que é onde a fila é maior', async () => {
    // Every OpenAlex and Crossref item is published in English; government
    // sources are already in Portuguese and only need the act rewritten.
    process.env.RADAR_EDITORIAL_MAX_ITEMS = '6';
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })));
    const paper = (id) => ({
      id, externalId: id, section: 'research', title: 'Vocational pathways in advanced manufacturing',
      summaryPt: 'The study compares apprenticeship systems and the requirements of the jobs graduates hold in industry.',
      sourceName: 'OpenAlex', contentType: 'artigo', topics: ['EPT'], publishedAt: '2026-08-02',
    });

    const { items } = await editorializeRadarItems([
      ...Array.from({ length: 6 }, (_, index) => gazetteItem(`ato-${index + 1}`, { publishedAt: '2026-08-02' })),
      ...Array.from({ length: 6 }, (_, index) => paper(`paper-${index + 1}`)),
    ]);

    const rewritten = items.filter((item) => item.editorialStatus === 'ai');
    expect(rewritten).toHaveLength(6);
    // Two research items for every act, the 2:1 share the queue declares.
    expect(rewritten.filter((item) => item.section === 'research')).toHaveLength(4);
    expect(rewritten.filter((item) => item.section === 'government')).toHaveLength(2);
  });

  it('enfileira o artigo cujo abstract é inglês mesmo quando a fonte não deu resumo', async () => {
    // The Portuguese "no summary available" fallback was the only thing checked
    // besides the title, so a paper whose title alone was too short for the
    // detector never entered the queue at all.
    process.env.RADAR_EDITORIAL_MAX_ITEMS = '6';
    vi.stubGlobal('fetch', respondWith((item) => ({
      id: item.id,
      title: 'Percursos de aprendizagem profissional na manufatura avançada',
      summary: 'O estudo compara sistemas de aprendizagem profissional em quatro países e mede a distância entre a formação e o que a indústria exige.',
      topics: item.temas,
    })));

    const { items, stats } = await editorializeRadarItems([{
      id: 'crossref-1',
      externalId: 'crossref-1',
      section: 'research',
      title: 'Apprenticeship pathways',
      summaryPt: 'A fonte não disponibilizou resumo deste trabalho.',
      abstractText: 'This paper compares apprenticeship systems across four countries and the requirements of the jobs graduates hold.',
      sourceName: 'Crossref',
      contentType: 'artigo científico',
      topics: ['EPT'],
      publishedAt: '2026-07-30',
    }]);

    expect(stats).toMatchObject({ pending: 1, rewritten: 1 });
    expect(items[0].displayTitle).toBe('Percursos de aprendizagem profissional na manufatura avançada');
  });

  it('não deixa os atos oficiais matarem de fome as outras seções', async () => {
    // Production accumulated hundreds of state-gazette acts. Under strict
    // priority they filled the quota on every run, so 481 rewrites happened
    // without a single paper being reached. Every section must advance.
    process.env.RADAR_EDITORIAL_MAX_ITEMS = '6';
    vi.stubGlobal('fetch', respondWith((item) => ({
      id: item.id,
      title: item.modo === 'traducao' ? 'Título acadêmico traduzido para o português' : EDITORIAL_TITLE,
      summary: EDITORIAL_SUMMARY,
      topics: item.temas,
    })));
    const paper = (id) => ({
      id, externalId: id, section: 'research', title: 'Vocational pathways in advanced manufacturing',
      summaryPt: 'The study compares apprenticeship systems and the requirements of the jobs graduates hold in industry.',
      sourceName: 'OpenAlex', contentType: 'artigo', topics: ['EPT'], publishedAt: '2026-08-02',
    });

    const { items, stats } = await editorializeRadarItems([
      ...Array.from({ length: 20 }, (_, index) => gazetteItem(`ato-${index + 1}`)),
      ...Array.from({ length: 3 }, (_, index) => paper(`paper-${index + 1}`)),
    ]);

    expect(stats).toMatchObject({ pending: 23, candidates: 6, rewritten: 6 });
    // Half the quota went to the section that would otherwise never be served.
    const papers = items.filter((item) => item.section === 'research' && item.editorialStatus === 'ai');
    expect(papers).toHaveLength(3);
    expect(papers[0].displayTitle).toBe('Título acadêmico traduzido para o português');
  });

  it('traduz o artigo em inglês na mesma execução em que atende os atos', async () => {
    // The exact item reported from production: an OpenAlex paper whose title is
    // not even English, but whose abstract is. It must be served alongside the
    // acts, not after them.
    process.env.RADAR_EDITORIAL_MAX_ITEMS = '6';
    const paper = {
      id: 'openalex-1',
      externalId: 'openalex-1',
      section: 'research',
      title: 'Analisis Job Mismatch pada Pelatihan Vokasi Nonformal',
      summaryPt: 'The phenomenon of job mismatch is one of the challenges in the development of vocational education and training because it indicates a discrepancy between the competencies possessed by graduates.',
      sourceName: 'OpenAlex',
      contentType: 'artigo',
      topics: ['EPT', 'Vocational and Entrepreneurial Education'],
      publishedAt: '2026-08-02',
    };
    vi.stubGlobal('fetch', respondWith((item) => ({
      id: item.id,
      title: 'Análise de desalinhamento profissional na formação vocacional não formal',
      summary: 'O estudo acompanha egressos de um centro de formação profissional na Indonésia e mede a distância entre as competências que eles adquiriram e as que os empregos exigem.',
      topics: ['EPT', 'educação profissional e empreendedora'],
    })));

    const { items, stats } = await editorializeRadarItems([...Array.from({ length: 6 }, (_, index) => gazetteItem(`ato-${index + 1}`)), paper]);

    expect(stats).toMatchObject({ pending: 7, candidates: 6, rewritten: 6 });
    const rewritten = items.find((item) => item.externalId === 'openalex-1');
    expect(rewritten.displayTitle).toBe('Análise de desalinhamento profissional na formação vocacional não formal');
    expect(rewritten.topics).toEqual(['EPT', 'educação profissional e empreendedora']);
    expect(rewritten.rawSourceText).toBe(false);
  });

  it('conta o que reescreveu e o que recusou, para distinguir modelo ruim de coleta vazia', async () => {
    vi.stubGlobal('fetch', respondWith((item) => ({
      id: item.id,
      // Valid JSON that the Radar refuses: a headline still in English.
      title: 'Federal institutes are allowed to open new technical courses',
      summary: 'The act allows three federal institutes to open new technical courses in the next academic term.',
      topics: item.temas,
    })));

    const { stats } = await editorializeRadarItems([gazetteItem('a'), gazetteItem('b')]);

    expect(stats).toMatchObject({ enabled: true, candidates: 2, rewritten: 0, rejected: 2, failedBatches: 0 });
    expect(stats.model).toBe('openrouter:test/model');
  });

  it('registra o lote perdido quando o modelo ignora o schema estrito', async () => {
    // A model answering prose is what `invalid_output` means; the run must say
    // so instead of looking like a collection with nothing to rewrite.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ model: 'test/model', choices: [{ message: { content: 'Claro! Aqui vai o resumo…' } }] }) })));

    const { stats } = await editorializeRadarItems([gazetteItem('z')]);

    expect(stats).toMatchObject({ enabled: true, candidates: 1, rewritten: 0, failedBatches: 1 });
    expect(stats.errors).toContain('invalid_output');
  });

  it('para de reescrever ao esgotar o prazo, para não custar o snapshot da coleta', async () => {
    // The pass runs after every collector and before the snapshot write. A
    // serverless function killed here loses the whole run, so the deadline
    // matters more than finishing the backlog.
    process.env.RADAR_EDITORIAL_DEADLINE_MS = '1000';
    vi.stubGlobal('fetch', vi.fn(async (_url, request) => {
      await new Promise((resolve) => { setTimeout(resolve, 1100); });
      const requested = JSON.parse(JSON.parse(request.body).messages.at(-1).content);
      return {
        ok: true,
        json: async () => ({
          model: 'test/model',
          usage: { total_tokens: 100 },
          choices: [{ message: { content: JSON.stringify({ items: requested.map((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })) }) } }],
        }),
      };
    }));

    const { items, stats } = await editorializeRadarItems(Array.from({ length: 12 }, (_, index) => gazetteItem(`prazo-${index + 1}`)));

    // One batch went out before the clock ran down; the rest keep the source's
    // wording rather than putting the run's snapshot at risk.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(stats).toMatchObject({ deadlineReached: true, rewritten: 6 });
    expect(items).toHaveLength(12);
    delete process.env.RADAR_EDITORIAL_DEADLINE_MS;
  });

  it('respeita o prazo do chamador quando ele é mais curto que o próprio', async () => {
    // Collection has already spent most of the platform's budget by the time
    // this pass starts, so a budget measured from here would start from the
    // wrong instant and overshoot the function limit.
    process.env.RADAR_EDITORIAL_DEADLINE_MS = '30000';
    vi.stubGlobal('fetch', respondWith((item) => ({ id: item.id, title: EDITORIAL_TITLE, summary: EDITORIAL_SUMMARY, topics: item.temas })));

    const { stats } = await editorializeRadarItems([gazetteItem('a'), gazetteItem('b')], { deadlineAt: Date.now() - 1 });

    expect(fetch).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ deadlineReached: true, rewritten: 0, batches: 0 });
    delete process.env.RADAR_EDITORIAL_DEADLINE_MS;
  });

  it('atende primeiro os diários oficiais e depois os itens em inglês', () => {
    expect(editorialPriority(gazetteItem('1'))).toBe(0);
    expect(editorialPriority({ sourceName: 'Cedefop', title: 'Skills forecast for the green transition' })).toBe(1);
    expect(editorialPriority({ sourceName: 'MEC / SETEC', title: 'MEC amplia oferta de cursos técnicos' })).toBe(2);
  });
});

describe('validação do texto gerado', () => {
  it('recusa manchete curta, longa demais ou igual ao título do ato', () => {
    expect(validateEditorialTitle('Curto', {})).toBe(false);
    expect(validateEditorialTitle('a'.repeat(141), {})).toBe(false);
    expect(validateEditorialTitle('Novas vagas em cursos técnicos', { title: 'novas vagas em cursos técnicos' })).toBe(false);
    expect(validateEditorialTitle(EDITORIAL_TITLE, { title: 'PORTARIA Nº 1' })).toBe(true);
  });

  it('recusa resumo curto demais para explicar o que muda', () => {
    expect(validateEditorialSummary('A portaria autoriza cursos.', {})).toBe(false);
    expect(validateEditorialSummary(EDITORIAL_SUMMARY, {})).toBe(true);
  });
});
