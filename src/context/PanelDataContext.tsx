import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { loadState, saveState, callAction, getClientServices, UnauthorizedError } from '../api';
import { useAuth } from './AuthContext';
import { DEFAULTS, DEFAULT_PROJECTS, AGENT_FUNCTION_KEYS, TOOL_KEYS } from '../constants';
import type { AgentConfig, AgentKey, AgentStatus, ClientServices, ContentGrid, Project, ToolKey } from '../types';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'proyecto'
  );
}

interface PanelDataValue {
  agentConfigs: Record<AgentKey, AgentConfig>;
  agentStatus: Record<AgentKey, AgentStatus | undefined>;
  contentGrid: ContentGrid | null;
  projects: Project[];
  activeProjectId: string | null;
  activeProjectName: string;
  activeProject: Project | undefined;
  // Servicios REALES del cliente activo (rockybrand-client-config.services)
  // - distinto de `activeProject.tools`, que solo controla visibilidad
  // cosmética. null mientras carga o si no hay cliente activo. Usado por
  // el Sidebar para el "modo cliente aislado": ocultar herramientas que
  // el cliente activo no tiene contratadas.
  activeServices: ClientServices | null;
  setActiveProjectId: (id: string | null) => void;
  addProject: (name: string, agents?: AgentKey[], tools?: ToolKey[]) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  updateAgentConfig: (agentKey: AgentKey, patch: Partial<AgentConfig>) => Promise<void>;
  scopedAction: <T = unknown>(action: string, extra?: Record<string, unknown>) => Promise<T>;
  loading: boolean;
  refetch: () => Promise<void>;
}

const PanelDataContext = createContext<PanelDataValue | null>(null);

export function PanelDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, handleUnauthorized } = useAuth();
  const [agentConfigs, setAgentConfigs] = useState<Record<AgentKey, AgentConfig>>({ ...DEFAULTS });
  const [agentStatus, setAgentStatus] = useState<Record<AgentKey, AgentStatus | undefined>>({} as Record<AgentKey, AgentStatus | undefined>);
  const [contentGrid, setContentGrid] = useState<ContentGrid | null>(null);
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  // Sin proyecto seleccionado por defecto: el Home muestra la tarjeta de
  // bienvenida hasta que el usuario elige un proyecto en el sidebar.
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeServices, setActiveServices] = useState<ClientServices | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawState, setRawState] = useState<Record<string, unknown>>({});
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;

  const refetch = useCallback(async () => {
    const requestedProjectId = activeProjectIdRef.current;
    setLoading(true);
    try {
      const state = await loadState<{
        agentConfigs?: Record<AgentKey, AgentConfig>;
        agentStatus?: Record<AgentKey, AgentStatus>;
        contentGrid?: ContentGrid | null;
        projects?: Project[];
      }>(requestedProjectId || undefined);
      // Si el usuario cambio de proyecto mientras esta respuesta viajaba, la
      // descartamos - ya no corresponde al proyecto activo y no debe pisar
      // el estado que si corresponde.
      if (activeProjectIdRef.current !== requestedProjectId) return;
      setRawState(state as Record<string, unknown>);
      setAgentConfigs(state.agentConfigs || { ...DEFAULTS });
      setAgentStatus(state.agentStatus || ({} as Record<AgentKey, AgentStatus | undefined>));
      setContentGrid(state.contentGrid ?? null);
      setProjects(state.projects && state.projects.length ? state.projects : DEFAULT_PROJECTS);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
      } else {
        console.error('Error cargando el estado del panel', e);
      }
    } finally {
      if (activeProjectIdRef.current === requestedProjectId) setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeProjectId, refetch]);

  useEffect(() => {
    if (!isAuthenticated || !activeProjectId) {
      setActiveServices(null);
      return;
    }
    let cancelled = false;
    setActiveServices(null);
    getClientServices(activeProjectId)
      .then(({ services }) => {
        if (!cancelled) setActiveServices(services);
      })
      .catch((e) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        // Silencioso a propósito: si falla, el Sidebar cae de vuelta a
        // mostrar todo (activeServices null = sin filtro) - nunca un
        // cliente real se queda sin poder ver una herramienta por un
        // error de red transitorio.
        console.error('Error cargando los servicios del cliente activo', e);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, activeProjectId, handleUnauthorized]);

  const scopedAction = useCallback(
    <T = unknown,>(action: string, extra?: Record<string, unknown>) =>
      callAction<T>(action, { ...extra, project_id: activeProjectId }),
    [activeProjectId]
  );

  const addProject = useCallback(
    async (name: string, agents: AgentKey[] = AGENT_FUNCTION_KEYS, tools: ToolKey[] = TOOL_KEYS) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const next = [...projects, { id: `${slugify(trimmed)}-${Date.now().toString(36)}`, name: trimmed, protected: false, agents, tools }];
      setProjects(next);
      await saveState({ ...rawState, projects: next });
    },
    [projects, rawState]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const next = projects.filter((p) => p.id !== id);
      setProjects(next);
      if (activeProjectId === id) setActiveProjectId(null);
      await saveState({ ...rawState, projects: next });
    },
    [projects, rawState, activeProjectId]
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>) => {
      const next = projects.map((p) => (p.id === id ? { ...p, ...patch } : p));
      setProjects(next);
      await saveState({ ...rawState, projects: next });
    },
    [projects, rawState]
  );

  const updateAgentConfig = useCallback(
    async (agentKey: AgentKey, patch: Partial<AgentConfig>) => {
      const next = { ...agentConfigs, [agentKey]: { ...agentConfigs[agentKey], ...patch } };
      setAgentConfigs(next);
      await saveState({ ...rawState, agentConfigs: next });
    },
    [agentConfigs, rawState]
  );

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeProjectName = activeProject?.name || '';

  return (
    <PanelDataContext.Provider
      value={{
        agentConfigs,
        agentStatus,
        contentGrid,
        projects,
        activeProjectId,
        activeProjectName,
        activeProject,
        activeServices,
        setActiveProjectId,
        addProject,
        deleteProject,
        updateProject,
        updateAgentConfig,
        scopedAction,
        loading,
        refetch,
      }}
    >
      {children}
    </PanelDataContext.Provider>
  );
}

export function usePanelData() {
  const ctx = useContext(PanelDataContext);
  if (!ctx) throw new Error('usePanelData debe usarse dentro de PanelDataProvider');
  return ctx;
}
