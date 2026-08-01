import { useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePanelData } from '../../context/PanelDataContext';
import { PmsDataProvider, usePmsData } from '../../context/PmsDataContext';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator';

const TABS = [
  { to: '.', label: 'Resumen', end: true },
  { to: 'calendario', label: 'Calendario' },
  { to: 'itinerario', label: 'Itinerario' },
  { to: 'vista-mensual', label: 'Vista mensual' },
  { to: 'reservas', label: 'Reservas' },
  { to: 'huespedes', label: 'Huéspedes' },
];

function LodgeSwitcher() {
  const { lodgeId, setLodgeId } = usePmsData();
  const { projects } = usePanelData();
  const options = projects.length ? projects : [{ id: 'alto-castillo', name: 'Alto Castillo' }];

  return (
    <div className="lodge-switcher">
      <span className="lodge-switcher-label">Gestionando</span>
      <select className="lodge-switcher-select" value={lodgeId} onChange={(e) => setLodgeId(e.target.value)}>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function PmsShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const tabbarRef = useRef<HTMLDivElement>(null);
  useSlidingIndicator(tabbarRef, '.tab.active', 'horizontal', [location.pathname]);

  return (
    <div className="main">
      <button className="back-link" onClick={() => navigate('/')}>
        &larr; Volver al panel
      </button>
      <div className="pms-head">
        <div>
          <div className="eyebrow">Property Management System</div>
          <div className="page-title">Reservas &amp; Operaciones</div>
          <div className="page-sub">
            Herramienta independiente — todavía no asignada a ningún cliente en Configuración. Multi-lodge por
            diseño: cada propiedad ve solo sus propios huéspedes y reservas.
          </div>
        </div>
        <LodgeSwitcher />
      </div>

      <div className="tabbar" ref={tabbarRef}>
        <div className="slide-indicator slide-indicator-h" />
        {TABS.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}

export default function PmsLayout() {
  return (
    <PmsDataProvider>
      <PmsShell />
    </PmsDataProvider>
  );
}
