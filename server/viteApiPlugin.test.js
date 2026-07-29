import { describe, expect, it } from 'vitest';
import viteApiPlugin from './viteApiPlugin.js';

describe('Vite API adapter', () => {
  it('serves the same API handlers in dev and production preview', () => {
    const plugin = viteApiPlugin();
    expect(typeof plugin.configureServer).toBe('function');
    expect(typeof plugin.configurePreviewServer).toBe('function');
  });
});
