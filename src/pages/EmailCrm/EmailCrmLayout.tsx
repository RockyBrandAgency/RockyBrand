import { useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePanelData } from '../../context/PanelDataContext';
import { CrmDataProvider } from '../../context/CrmDataContext';
import { TOOL_KEYS } from '../../constants';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator';

const TABS = [
  { to: '.', label: 'Resumen', end: true },
  { to: 'pendientes', label: 'Pendientes' },
  { to: 'campanas', label: 'Campañas' },
  { to: 'nueva', label: 'Nueva campaña' },
  { to: 'audiencias', label: 'Audiencias' },
  { to: 'templates', label: 'Templates' },
  { to: 'metricas', label: 'Métricas' },
  { to: 'automatizaciones', label: 'Automatizaciones' },
];

function ClientSwitcher() {
  const { projects, activeProjectId, setActiveProjectId } = usePanelData();
  return (
    <div className="lodge-switcher">
      <span className="lodge-switcher-label">Gestionando</span>
      <select
        className="lodge-switcher-select"
        value={activeProjectId ?? ''}
        onChange={(e) => setActiveProjectId(e.target.value || null)}
      >
        <option value="">Selecciona un cliente…</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function EmailCrmLayout() {
  const { activeProjectName, activeProjectId, activeProject } = usePanelData();
  const navigate = useNavigate();
  const location = useLocation();
  const tabbarRef = useRef<HTMLDivElement>(null);
  useSlidingIndicator(tabbarRef, '.tab.active', 'horizontal', [location.pathname]);

  const activeTools = activeProject?.tools?.length ? activeProject.tools : TOOL_KEYS;

  return (
    <div className="main">
      <button className="back-link" onClick={() => navigate('/')}>
        &larr; Volver al panel
      </button>
      <div className="pms-head">
        <div>
          <div className="eyebrow">Herramientas</div>
          <div className="page-title">Email Marketing</div>
          <div className="page-sub">{activeProjectId ? `${activeProjectName} · proyectos/${activeProjectId}` : 'Selecciona un cliente para gestionar su CRM de email.'}</div>
        </div>
        <ClientSwitcher />
      </div>

      {!activeProjectId && <div className="card empty-state">Selecciona un cliente arriba para ver su Email Marketing.</div>}

      {activeProjectId && !activeTools.includes('email-marketing') && (
        <div className="card empty-state">Este cliente no tiene la herramienta "Email Marketing" habilitada — actívala en Agentes → Asignación por cliente.</div>
      )}

      {activeProjectId && activeTools.includes('email-marketing') && (
        <>
          <div className="tabbar" ref={tabbarRef}>
            <div className="slide-indicator slide-indicator-h" />
            {TABS.map((t) => (
              <NavLink key={t.label} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
                {t.label}
              </NavLink>
            ))}
          </div>

          <CrmDataProvider>
            <Outlet />
          </CrmDataProvider>
        </>
      )}
    </div>
  );
}
