/**
 * Ordenação das tabelas administrativas.
 *
 * O comparador anterior convertia todo valor para string antes de comparar.
 * Duas consequências visíveis na tela: a coluna "#" saía na ordem 1, 10, 100,
 * 11, 13 — porque "10" vem antes de "2" no alfabeto — e a coluna h-index ficava
 * inútil justamente para o que ela existe, achar os mais citados.
 *
 * Aqui número é comparado como número e texto usa a ordenação do português,
 * que também acerta os acentos (Á ao lado de A, não no fim da tabela).
 */

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Compara dois valores de uma mesma coluna, sempre em ordem crescente.
 * O sentido é aplicado por `getComparator`, para que os campos vazios possam
 * ficar no fim nas duas direções.
 */
export function compareValues(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && String(left).trim() !== '' && String(right).trim() !== '') {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right), 'pt-BR', { sensitivity: 'base', numeric: true });
}

/**
 * Comparador para `Array.prototype.sort`.
 *
 * Registros sem valor na coluna vão para o fim nas duas direções: inverter a
 * ordem para descobrir quem tem h-index alto não deveria encher a primeira
 * página com quem não tem h-index nenhum.
 */
export function getComparator(order, orderBy) {
  const direction = order === 'desc' ? -1 : 1;
  return (a, b) => {
    const left = a?.[orderBy];
    const right = b?.[orderBy];
    const leftEmpty = isEmpty(left);
    const rightEmpty = isEmpty(right);
    if (leftEmpty && rightEmpty) return 0;
    if (leftEmpty) return 1;
    if (rightEmpty) return -1;
    return direction * compareValues(left, right);
  };
}
