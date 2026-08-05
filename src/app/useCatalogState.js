import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Estado de busca do catálogo, guardado na URL.
 *
 * Antes ele vivia em `useState` dentro de cada página. Três consequências que
 * pareciam pequenas e não eram:
 *
 * - Uma lista filtrada não podia ser compartilhada nem salva. "Manda aí os
 *   especialistas alemães em automação" virava um passo a passo por escrito.
 * - Abrir um perfil e voltar zerava a busca — o navegador voltava para a
 *   mesma URL, que não continha filtro nenhum.
 * - Recarregar a página perdia o trabalho.
 *
 * A serialização é enxuta de propósito: só entra na URL o que difere do padrão,
 * de modo que a barra de endereço fica limpa enquanto ninguém filtra nada.
 */

const LIST_SEPARATOR = ',';

/**
 * @param {Record<string, {type: 'text'|'list'|'single', default?: any}>} schema
 *   Descreve os parâmetros da página. `single` guarda um valor só e usa
 *   `default` como o valor neutro que não aparece na URL.
 */
export function useCatalogState(schema) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const next = {};
    for (const [key, definition] of Object.entries(schema)) {
      const raw = params.get(key);
      if (definition.type === 'list') {
        next[key] = raw ? raw.split(LIST_SEPARATOR).filter(Boolean) : [];
      } else {
        next[key] = raw ?? definition.default ?? '';
      }
    }
    return next;
  }, [params, schema]);

  const write = useCallback(
    (updates) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(updates)) {
            const definition = schema[key];
            if (!definition) continue;
            const isEmpty =
              definition.type === 'list'
                ? !value || value.length === 0
                : value === undefined || value === null || value === '' || value === definition.default;
            // Um parâmetro no valor padrão sai da URL em vez de ficar como
            // `?genero=todos`, que é ruído para quem copia o endereço.
            if (isEmpty) next.delete(key);
            else next.set(key, definition.type === 'list' ? value.join(LIST_SEPARATOR) : String(value));
          }
          return next;
        },
        // `replace` para que filtrar não encha o histórico: seria preciso
        // apertar "voltar" uma vez por tecla digitada para sair da página.
        { replace: true },
      );
    },
    [schema, setParams],
  );

  const setValue = useCallback((key, value) => write({ [key]: value }), [write]);

  /** Tira um valor de uma lista — o que as fichas de filtro ativo removem. */
  const removeValue = useCallback(
    (key, value) => {
      const definition = schema[key];
      if (!definition) return;
      if (definition.type === 'list') write({ [key]: (state[key] || []).filter((entry) => entry !== value) });
      else write({ [key]: definition.default ?? '' });
    },
    [schema, state, write],
  );

  const clear = useCallback(() => {
    write(Object.fromEntries(Object.keys(schema).map((key) => [key, schema[key].type === 'list' ? [] : schema[key].default ?? ''])));
  }, [schema, write]);

  const isPristine = useMemo(
    () =>
      Object.entries(schema).every(([key, definition]) =>
        definition.type === 'list' ? (state[key] || []).length === 0 : state[key] === (definition.default ?? ''),
      ),
    [schema, state],
  );

  return { state, setValue, removeValue, clear, isPristine };
}
