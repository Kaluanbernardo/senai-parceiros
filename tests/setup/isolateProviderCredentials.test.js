import { describe, expect, it } from 'vitest';

// Guards the setup file itself: without it, a configured `.env.local` puts a
// real credential in scope and the suite starts calling live providers.
describe('isolamento de credenciais no ambiente de teste', () => {
  it('nao expoe credencial real de provider externo', () => {
    for (const name of ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'AZURE_OPENAI_API_KEY', 'TAVILY_API_KEY']) {
      expect(process.env[name], `${name} vazou do .env.local para os testes`).toBeUndefined();
    }
  });

  it('nao herda a selecao ambiente de provider e modelo', () => {
    expect(process.env.AI_PROVIDER).toBeUndefined();
    expect(process.env.OPENROUTER_MODEL).toBeUndefined();
  });
});
