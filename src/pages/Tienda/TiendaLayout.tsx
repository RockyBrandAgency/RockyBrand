import { useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator';
import { TiendaDataProvider } from '../../context/TiendaDataContext';

const TABS = [
  { to: '.', label: 'Resumen', end: true },
  { to: 'catalogo', label: 'Catálogo' },
  { to: 'pedidos', label: 'Pedidos' },
  { to: 'contacto', label: 'Mensajes de contacto' },
];

export default function TiendaLayout() {
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
          <div className="eyebrow">Herramientas</div>
          <div className="page-title">Tienda</div>
          <div className="page-sub">Chile Fly Fishing Co. · catálogo, pedidos y despachos</div>
        </div>
      </div>

      <div className="tabbar" ref={tabbarRef}>
        <div className="slide-indicator slide-indicator-h" />
        {TABS.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            {t.label}
          </NavLink>
        ))}
      </div>

      <TiendaDataProvider>
        <Outlet />
      </TiendaDataProvider>
    </div>
  );
}
