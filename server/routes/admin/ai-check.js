import { requireSession } from '../../lib/cookies.js';
import { methodNotAllowed, requireSameOrigin } from '../../lib/http.js';
import { generateStructured } from '../../lib/structuredGeneration.js';

/**
 * Mede uma chamada mínima ao provedor, de dentro da própria função serverless.
 *
 * Três timeouts seguidos na entrevista — com modelos diferentes e com o
 * contrato já enxuto — deixam de ser evidência sobre o schema e passam a ser
 * uma pergunta sem resposta: a função consegue falar com o provedor?
 *
 * Este endpoint separa as duas coisas que estavam misturadas. O schema aqui é
 * o menor possível e a saída cabe em poucos tokens, então:
 *
 * - responde rápido  → a rota até o provedor está boa, e o custo está no que a
 *   entrevista pede (schema, modelo, tamanho da saída);
 * - também estoura   → nada do que mudarmos no contrato importa, porque a
 *   chamada não está chegando lá.
 *
 * Não recebe nem devolve conteúdo: só tempo, provedor e modelo.
 */
const PING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok'],
  properties: { ok: { type: 'string' } },
};

const TIMEOUT_MS = 20000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  if (!requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const generated = await generateStructured({
      task: 'provider_reachability_check',
      schema: PING_SCHEMA,
      messages: [
        { role: 'system', content: 'Responda somente JSON válido conforme o schema solicitado.' },
        { role: 'user', content: 'Responda {"ok":"pong"}.' },
      ],
      maxOutputTokens: 200,
      temperature: 0,
      signal: controller.signal,
    });
    return res.status(200).json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
      provider: generated.trace.provider,
      model: generated.trace.model,
      usage: generated.trace.usage || null,
      timeoutMs: TIMEOUT_MS,
    });
  } catch (error) {
    // Os códigos vêm de generateStructured e nunca carregam corpo de resposta
    // nem credencial, então podem ser exibidos como estão.
    const reason = error?.name === 'AbortError' ? 'provider_timeout' : String(error?.message || 'provider_error').slice(0, 80);
    return res.status(200).json({ ok: false, elapsedMs: Date.now() - startedAt, reason, timeoutMs: TIMEOUT_MS });
  } finally {
    clearTimeout(timeout);
  }
}
