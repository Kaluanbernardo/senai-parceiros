import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import stakeholdersRaw from '../data/stakeholders.json';
import escolasRaw from '../data/escolas.json';
import pesquisadoresRaw from '../data/pesquisadores.json';
import { canonicalizeResearchers, resolveResearcherId } from '../domain/researcherCatalog';
import { useAuth } from './AuthContext';

const DataContext = createContext();
const researcherCatalog = canonicalizeResearchers(pesquisadoresRaw);

function recordKey(record) {
  if (record?.id !== undefined && record?.id !== null) return `id:${String(record.id)}`;
  return `fallback:${String(record?.nome || record?.instituicao || '').trim().toLowerCase()}|${String(record?.pais || '').trim().toLowerCase()}|${String(record?.website || record?.website_oficial || '').trim().toLowerCase()}`;
}

function upsertRecords(previous, incoming = []) {
  if (!Array.isArray(incoming) || !incoming.length) return previous;
  const next = [...previous];
  const indexes = new Map(next.map((record, index) => [recordKey(record), index]));
  incoming.forEach((record) => {
    if (!record || typeof record !== 'object') return;
    const key = recordKey(record);
    const index = indexes.get(key);
    if (index === undefined) {
      indexes.set(key, next.length);
      next.push(record);
    } else {
      next[index] = { ...next[index], ...record };
    }
  });
  return next;
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [stakeholders, setStakeholders] = useState(() => [...stakeholdersRaw]);
  const [escolas, setEscolas] = useState(() => [...escolasRaw]);
  const [pesquisadores, setPesquisadores] = useState(() => researcherCatalog.records);

  const refreshCatalog = useCallback(async () => {
    const response = await fetch('/api/catalog', { credentials: 'include' });
    if (!response.ok) throw new Error('catalog_unavailable');
    const payload = await response.json();
    if (!payload?.records) return;
    // Rebuild from the reviewed seed so rollback/removal cannot leave stale
    // imported records in the current browser session.
    setStakeholders(upsertRecords([...stakeholdersRaw], payload.records.organization));
    setEscolas(upsertRecords([...escolasRaw], payload.records.school));
    setPesquisadores(canonicalizeResearchers(upsertRecords(researcherCatalog.records, payload.records.researcher)).records);
  }, []);

  useEffect(() => {
    if (!user) {
      setStakeholders([...stakeholdersRaw]);
      setEscolas([...escolasRaw]);
      setPesquisadores(researcherCatalog.records);
      return undefined;
    }
    refreshCatalog()
      .catch(() => {
        // The seed catalog remains useful when the durable store is unavailable.
      });
    return undefined;
  }, [user, refreshCatalog]);

  // Generic CRUD helpers
  const updateItem = useCallback((collection, setCollection, id, updates) => {
    setCollection(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const addItem = useCallback((collection, setCollection, newItem) => {
    const maxId = collection.reduce((max, item) => {
      const numeric = Number(item.id);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0);
    setCollection(prev => [...prev, { ...newItem, id: maxId + 1 }]);
    return maxId + 1;
  }, []);

  const deleteItem = useCallback((setCollection, id) => {
    setCollection(prev => prev.filter(item => item.id !== id));
  }, []);

  // Stakeholders
  const updateStakeholder = (id, updates) => updateItem(stakeholders, setStakeholders, id, updates);
  const addStakeholder = (item) => addItem(stakeholders, setStakeholders, item);
  const deleteStakeholder = (id) => deleteItem(setStakeholders, id);

  // Escolas
  const updateEscola = (id, updates) => updateItem(escolas, setEscolas, id, updates);
  const addEscola = (item) => addItem(escolas, setEscolas, item);
  const deleteEscola = (id) => deleteItem(setEscolas, id);

  // Pesquisadores
  const updatePesquisador = (id, updates) => updateItem(pesquisadores, setPesquisadores, id, updates);
  const addPesquisador = (item) => addItem(pesquisadores, setPesquisadores, item);
  const deletePesquisador = (id) => deleteItem(setPesquisadores, id);

  // Import/Export
  const exportData = useCallback((type) => {
    const dataMap = { stakeholders, escolas, pesquisadores };
    const data = dataMap[type];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stakeholders, escolas, pesquisadores]);

  const exportAll = useCallback(() => {
    ['stakeholders', 'escolas', 'pesquisadores'].forEach(type => exportData(type));
  }, [exportData]);

  const importData = useCallback((type, jsonArray) => {
    const setterMap = { stakeholders: setStakeholders, escolas: setEscolas, pesquisadores: setPesquisadores };
    setterMap[type](jsonArray);
  }, []);

  const mergeImportedRecords = useCallback((category, records = []) => {
    if (!Array.isArray(records) || !records.length) return;
    if (category === 'researcher') setPesquisadores((previous) => canonicalizeResearchers(upsertRecords(previous, records)).records);
    else if (category === 'school') setEscolas((previous) => upsertRecords(previous, records));
    else if (category === 'organization') setStakeholders((previous) => upsertRecords(previous, records));
  }, []);

  const researcherAliases = useMemo(() => canonicalizeResearchers(pesquisadores).aliases, [pesquisadores]);

  const value = {
    stakeholders, escolas, pesquisadores,
    researcherAliases,
    resolveResearcherId: (id) => resolveResearcherId(pesquisadores, id),
    updateStakeholder, addStakeholder, deleteStakeholder,
    updateEscola, addEscola, deleteEscola,
    updatePesquisador, addPesquisador, deletePesquisador,
    exportData, exportAll, importData,
    mergeImportedRecords,
    refreshCatalog,
    setStakeholders, setEscolas, setPesquisadores,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
