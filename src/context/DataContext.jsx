import React, { createContext, useContext, useState, useCallback } from 'react';
import stakeholdersRaw from '../data/stakeholders.json';
import escolasRaw from '../data/escolas.json';
import pesquisadoresRaw from '../data/pesquisadores.json';
import { canonicalizeResearchers, resolveResearcherId } from '../domain/researcherCatalog';

const DataContext = createContext();
const researcherCatalog = canonicalizeResearchers(pesquisadoresRaw);

export function DataProvider({ children }) {
  const [stakeholders, setStakeholders] = useState(() => [...stakeholdersRaw]);
  const [escolas, setEscolas] = useState(() => [...escolasRaw]);
  const [pesquisadores, setPesquisadores] = useState(() => researcherCatalog.records);

  // Generic CRUD helpers
  const updateItem = useCallback((collection, setCollection, id, updates) => {
    setCollection(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const addItem = useCallback((collection, setCollection, newItem) => {
    const maxId = collection.reduce((max, item) => Math.max(max, item.id || 0), 0);
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
    if (category === 'researcher') setPesquisadores((previous) => canonicalizeResearchers([...previous, ...records]).records);
    else if (category === 'school') setEscolas((previous) => [...previous, ...records]);
    else if (category === 'organization') setStakeholders((previous) => [...previous, ...records]);
  }, []);

  const value = {
    stakeholders, escolas, pesquisadores,
    researcherAliases: researcherCatalog.aliases,
    resolveResearcherId: (id) => resolveResearcherId(pesquisadores, id),
    updateStakeholder, addStakeholder, deleteStakeholder,
    updateEscola, addEscola, deleteEscola,
    updatePesquisador, addPesquisador, deletePesquisador,
    exportData, exportAll, importData,
    mergeImportedRecords,
    setStakeholders, setEscolas, setPesquisadores,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
