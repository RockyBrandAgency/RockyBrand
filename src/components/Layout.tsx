import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import JarvisCommandTerminal from './JarvisCommandTerminal';
import { useButtonPhysics } from '../hooks/useButtonPhysics';

export default function Layout() {
  useButtonPhysics();

  return (
    <div className="app-shell">
      <div className="credit-tag">By Matías Araneda</div>
      <Sidebar />
      <Outlet />
      <JarvisCommandTerminal />
    </div>
  );
}
