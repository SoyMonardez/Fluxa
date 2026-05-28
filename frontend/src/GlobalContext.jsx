import React, { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

export const GlobalContext = createContext(null);
export const useGlobal = () => useContext(GlobalContext);

export function GlobalProvider({ children }) {
  const [proyectos, setProyectos] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);

  const fetchProyectos = async () => {
    try {
      const { data } = await api.get('/proyectos');
      setProyectos(data);
      if (data.length > 0 && !activeProjectId) {
        setActiveProjectId(data[0].id);
      }
    } catch {}
  };

  useEffect(() => {
    if (localStorage.getItem('etem_token')) fetchProyectos();
  }, []);

  const activeProject = proyectos.find(p => p.id === activeProjectId) || null;

  return (
    <GlobalContext.Provider value={{ proyectos, setProyectos, activeProjectId, setActiveProjectId, activeProject, fetchProyectos }}>
      {children}
    </GlobalContext.Provider>
  );
}
