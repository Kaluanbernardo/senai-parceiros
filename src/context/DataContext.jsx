import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { canonicalizeResearchers, resolveResearcherId } from '../domain/researcherCatalog';
import { useAuth } from './AuthContext';

const DataContext = createContext();

/**
 * The three seed catalogs weigh ~730 kB of JSON.  Loading them on demand keeps
 * them out of the entry chunk, so a signed-out visitor never downloads the
 * catalog just to see the login screen.  `catalogReady` gates the pages that
 * consume the seeds, which is why no screen can render an empty list while the
 * chunk is still in flight.
 */
async function loadSeedCatalog() {
  const [stakeholders, escolas, pesquisadores] = await Promise.all([
    import('../data/stakeholders.json'),
    import('../data/escolas.json'),
    import('../data/pesquisadores.json'),
  ]);
  const researcherCatalog = canonicalizeResearchers(pesquisadores.default);
  return {
    stakeholdersRaw: stakeholders.default,
    escolasRaw: escolas.default,
    researcherCatalog,
  };
}

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
  const { pathname } = useLocation();
  const [stakeholders, setStakeholders] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [pesquisadores, setPesquisadores] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const seedsRef = useRef(null);

  const ensureSeeds = useCallback(async () => {
    if (!seedsRef.current) seedsRef.current = await loadSeedCatalog();
    return seedsRef.current;
  }, []);

  const refreshCatalog = useCallback(async () => {
    const { stakeholdersRaw, escolasRaw, researcherCatalog } = await ensureSeeds();
    const response = await fetch('/api/catalog', { credentials: 'include' });
    if (!response.ok) throw new Error('catalog_unavailable');
    const payload = await response.json();
    if (!payload?.records) return;
    // Rebuild from the reviewed seed so rollback/removal cannot leave stale
    // imported records in the current browser session.
    setStakeholders(upsertRecords([...stakeholdersRaw], payload.records.organization));
    setEscolas(upsertRecords([...escolasRaw], payload.records.school));
    setPesquisadores(canonicalizeResearchers(upsertRecords(researcherCatalog.records, payload.records.person)).records);
  }, [ensureSeeds]);

  useEffect(() => {
    if (!user) {
      setCatalogReady(false);
      setStakeholders([]);
      setEscolas([]);
      setPesquisadores([]);
      return undefined;
    }
    let active = true;
    ensureSeeds()
      .then(({ stakeholdersRaw, escolasRaw, researcherCatalog }) => {
        if (!active) return undefined;
        setStakeholders([...stakeholdersRaw]);
        setEscolas([...escolasRaw]);
        setPesquisadores(researcherCatalog.records);
        setCatalogReady(true);
        // The seed catalog remains useful when the durable store is unavailable.
        return refreshCatalog().catch(() => undefined);
      })
      .catch(() => {
        // Without the seeds there is nothing to show; keep the loading gate closed
        // rather than rendering empty catalogs as if they were real results.
      });
    return () => { active = false; };
  }, [user, ensureSeeds, refreshCatalog]);

  useEffect(() => {
    if (!user || !catalogReady) return undefined;
    const update = () => refreshCatalog().catch(() => undefined);
    update();
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, [user, catalogReady, pathname, refreshCatalog]);

  // Generic CRUD helpers
  const updateItem = useCallback((collection, setCollection, id, updates) => {
    setCollection(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const addItem = useCallback((collection, setCollection, newItem) => {
    const maxId = collection.reduce((max, item) => {
      const numeric = Number(item.id);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0);
    setCollection(prev => [...prev, { ...newItem, id: maxId + 1, adicionadoEm: new Date().toISOString() }]);
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
    if (category === 'person' || category === 'researcher') setPesquisadores((previous) => canonicalizeResearchers(upsertRecords(previous, records)).records);
    else if (category === 'school') setEscolas((previous) => upsertRecords(previous, records));
    else if (category === 'organization') setStakeholders((previous) => upsertRecords(previous, records));
  }, []);

  const researcherAliases = useMemo(() => canonicalizeResearchers(pesquisadores).aliases, [pesquisadores]);

  const value = {
    stakeholders, escolas, pesquisadores,
    catalogReady,
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
