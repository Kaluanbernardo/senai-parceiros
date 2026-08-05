import { describe, expect, it } from 'vitest';
import { shouldAdvanceOnEnter } from './SelectionPage';

describe('atalho da entrevista', () => {
  it('avança com Enter e preserva Shift + Enter e composição de texto', () => {
    expect(shouldAdvanceOnEnter({ key: 'Enter', shiftKey: false })).toBe(true);
    expect(shouldAdvanceOnEnter({ key: 'Enter', shiftKey: true })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: true } })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: 'a', shiftKey: false })).toBe(false);
  });
});
