import { describe, expect, it } from 'vitest';
import { describeDetailHeader } from './DetailModal.jsx';

describe('cabeçalho da ficha', () => {
  it('nomeia a pessoa pelo nome e resume cargo e instituição no subtítulo', () => {
    expect(describeDetailHeader({ nome: 'Marina Exemplo', cargo: 'Professora', instituicao: 'IF Exemplo', pais: 'Brasil' }, 'person'))
      .toEqual({ isPerson: true, title: 'Marina Exemplo', subtitle: 'Professora · IF Exemplo', country: 'Brasil' });
  });

  it('nomeia a escola pelo campo que o cadastro de escolas usa', () => {
    const header = describeDetailHeader({ instituicao: 'Instituto Exemplo', pais: 'Brasil' }, 'escola');
    expect(header.title).toBe('Instituto Exemplo');
    expect(header.subtitle).toBeNull();
  });

  it('nomeia uma instituição de ensino que veio do cadastro de stakeholders', () => {
    // Este registro chega classificado como `escola` pelo subtipo, mas guarda o
    // nome em `nome`: lendo só `instituicao`, a ficha abria sem título.
    expect(describeDetailHeader({ nome: 'AFPA', pais: 'França' }, 'escola').title).toBe('AFPA');
  });

  it('não inventa título quando o registro não tem nome em campo nenhum', () => {
    expect(describeDetailHeader({ pais: 'Brasil' }, 'stakeholder').title).toBeFalsy();
  });
});
