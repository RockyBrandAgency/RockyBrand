import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AvisoMfa from './AvisoMfa';
import { useButtonPhysics } from '../hooks/useButtonPhysics';

/** Shell con sesión. El aviso de MFA va arriba, en el flujo (ver AvisoMfa). */
export default function Layout() {
  useButtonPhysics();

  return (
    // `.app-marco` en columna: franja + shell suman 100vh, sin scroll de más.
    <div className="app-marco">
      <AvisoMfa />
      <div className="app-shell">
        <div className="credit-tag">By Matías Araneda</div>
        <Sidebar />
        <Outlet />
      </div>
    </div>
  );
}
