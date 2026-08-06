import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePanelData } from '../../context/PanelDataContext';
import { PmsDataProvider, usePmsData } from '../../context/PmsDataContext';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator';

// roomOnly: se oculta cuando `pms_room_views` esta apagado (cliente "solo
// viajeros", ej. Chile Fly Fishing - vende viajes guiados, no es un hotel).
// Solo Reservas y Huespedes quedan siempre visibles: Huespedes no es
// opcional aunque no sea sobre habitaciones - el formulario de Nueva
// reserva EXIGE elegir un huesped ya creado (pms_models.Booking en el
// backend), asi que sin esa pestana no se podria cargar ninguna reserva.
const TABS = [
  { to: '.', label: 'Resumen', end: true, roomOnly: true },
  { to: 'calendario', label: 'Calendario', end: false, roomOnly: true },
  { to: 'itinerario', label: 'Itinerario', end: false, roomOnly: true },
  { to: 'vista-mensual', label: 'Vista mensual', end: false, roomOnly: true },
  { to: 'reservas', label: 'Reservas', end: false, roomOnly: false },
  { to: 'huespedes', label: 'Huéspedes', end: false, roomOnly: false },
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
  const { pmsFeatures } = usePmsData();
  const tabbarRef = useRef<HTMLDivElement>(null);
  useSlidingIndicator(tabbarRef, '.tab.active', 'horizontal', [location.pathname]);

  // pmsFeatures null mientras carga -> se ven todas las tabs (nunca se
  // esconde una vista real por un falso negativo de carga en curso).
  const visibleTabs = TABS.filter((t) => !t.roomOnly || !pmsFeatures || pmsFeatures.pms_room_views);

  // El tabbar solo esconde el LINK - sin esto, un cliente en modo
  // viajeros que ya tenia abierto (o guardado en favoritos) /pms/calendario
  // seguiria viendo esa pagina igual, aunque su tab haya desaparecido.
  useEffect(() => {
    if (!pmsFeatures || pmsFeatures.pms_room_views) return;
    const segment = location.pathname.replace(/^\/pms\/?/, '');
    const currentTab = TABS.find((t) => (t.to === '.' ? segment === '' : segment === t.to));
    if (currentTab?.roomOnly) navigate('reservas', { replace: true });
  }, [pmsFeatures, location.pathname, navigate]);

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
        {visibleTabs.map((t) => (
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
