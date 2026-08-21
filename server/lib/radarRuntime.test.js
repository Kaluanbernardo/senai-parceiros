import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('runtime do Radar na Vercel', () => {
  it('reserva uma janela longa para a etapa editorial isolada', () => {
    const config = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));

    expect(config.functions['api/radar/refresh.js'].maxDuration).toBeGreaterThanOrEqual(300);
  });
});
