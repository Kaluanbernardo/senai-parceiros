import { describe, expect, it } from 'vitest';
import { getNavTools, getToolById, TOOL_REGISTRY } from './toolRegistry';

describe('tool registry', () => {
  it('exposes the four tools with unique ids and routes', () => {
    expect(TOOL_REGISTRY).toHaveLength(4);
    expect(new Set(TOOL_REGISTRY.map((tool) => tool.id)).size).toBe(4);
    expect(new Set(TOOL_REGISTRY.map((tool) => tool.route)).size).toBe(4);
    expect(TOOL_REGISTRY.every((tool) => tool.label && tool.description && tool.iconKey && tool.themeKey)).toBe(true);
  });

  it('supports lookups without duplicating navigation data', () => {
    expect(getToolById('radar')).toEqual(expect.objectContaining({ route: '/radar', navLabel: 'Radar' }));
    expect(getToolById('missing')).toBeNull();
    expect(getNavTools()).toEqual(TOOL_REGISTRY);
  });

  it('shows the combined research entry to every authenticated profile', () => {
    expect(getNavTools('admin').map((tool) => tool.id)).toContain('research');
    expect(getNavTools('user').map((tool) => tool.id)).toContain('research');
  });
});
