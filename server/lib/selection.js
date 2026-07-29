export async function buildLocalEvaluation(payload) {
  try {
    const module = await import('../../src/domain/selectionEngine.js');
    if (typeof module.buildLocalEvaluation !== 'function') throw new Error('local_engine_missing');
    return module.buildLocalEvaluation(payload);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.message === 'local_engine_missing') {
      throw new Error('local_engine_unavailable');
    }
    throw error;
  }
}

export async function mergeEvaluation(local, ai) {
  const module = await import('../../src/domain/selectionEngine.js');
  if (typeof module.mergeAiEvaluation !== 'function') throw new Error('local_engine_missing');
  return module.mergeAiEvaluation(local, ai);
}
