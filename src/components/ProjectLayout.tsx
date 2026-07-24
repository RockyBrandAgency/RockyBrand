import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePanelData } from '../context/PanelDataContext';
import { TOOL_KEYS } from '../constants';
import { useSlidingIndicator } from '../hooks/useSlidingIndicator';
import PageHeader from './PageHeader';
import type { HomeSummary } from '../types';

export interface ProjectOutletContext {
  summary: HomeSummary | null;
  summaryError: boolean;
  refetchSummary: () => void;
}

// Shell del cliente activo - mismo patron que PmsLayout/EmailCrmLayout
// (Outlet + tabbar con useSlidingIndicator). Reemplaza a ProjectRoute: la
// sincronizacion de activeProjectId desde la URL vive aca ahora, y ademas
// pide get_home_summary UNA vez para compartirlo con Resumen/Metricas/
// Gastos/Configuracion via useOutletContext, en vez de que cada tab pida
// su propia copia.
export default function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProjectId, setActiveProjectId, activeProjectName, activeProject, projects, loading, scopedAction } = usePanelData();
  const tabbarRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  if (projectId && projectId !== activeProjectId) {
    setActiveProjectId(projectId);
  }

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setSummaryError(false);
    scopedAction<HomeSummary>('get_home_summary')
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((e) => {
        console.error('Error cargando el resumen del cliente', e);
        if (!cancelled) setSummaryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, scopedAction, reloadTick]);

  const activeTools = activeProject?.tools?.length ? activeProject.tools : TOOL_KEYS;
  useSlidingIndicator(tabbarRef, '.tab.active', 'horizontal', [activeProjectId, activeTools.join(','), location.pathname]);

  if (!loading && projectId && !projects.some((p) => p.id === projectId)) {
    return <Navigate to="/" replace />;
  }

  const worstTone = (() => {
    if (!summary) return null;
    const tones = Object.values(summary.system_health).map((h) => h.tone);
    if (tones.includes('error')) return 'error';
    if (tones.includes('warn')) return 'warn';
    if (tones.every((t) => t === 'off')) return 'off';
    return 'ok';
  })();
  const metaAlert = summary?.system_health.meta_api;

  return (
    <div className="main">
      <button className="back-link" onClick={() => navigate('/')}>
        &larr; Volver al panel
      </button>
      <PageHeader
        projectId={activeProjectId}
        projectName={activeProjectName}
        worstTone={worstTone}
        systemHealth={summary?.system_health ?? null}
        hasAlert={!!metaAlert && metaAlert.tone !== 'ok' && metaAlert.tone !== 'off'}
      />

      <div className="tabbar" ref={tabbarRef}>
        <div className="slide-indicator slide-indicator-h" />
        <NavLink to="." end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          Resumen
        </NavLink>
        {activeTools.includes('metricas') && (
          <NavLink to="metricas" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Métricas
          </NavLink>
        )}
        <NavLink to="gastos" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          Resumen de Gastos
        </NavLink>
        <NavLink to="configuracion" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          Configuración
        </NavLink>
      </div>

      <Outlet context={{ summary, summaryError, refetchSummary: () => setReloadTick((t) => t + 1) } satisfies ProjectOutletContext} />
    </div>
  );
}
