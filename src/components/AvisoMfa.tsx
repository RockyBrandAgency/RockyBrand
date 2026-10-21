import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconoEscudoAlerta } from './CodigoVerificacion';

/**
 * Aviso discreto para quien entró sin código de verificación
 * (`mfa_inscrito: false`). Es una franja en el flujo, arriba del panel: no es
 * `fixed`, no tapa nada, no roba el foco y se ve sin hacer scroll. «Ahora no»
 * la oculta por el resto de la sesión (sessionStorage).
 *
 * Va sobre `.app-shell` y no dentro de `.main` porque a 320/360 px el shell
 * deja a `.main` con 104 px y contenido de 0 px de ancho (desborde previo del
 * shell, medido 20-oct): ahí dentro quedaría fuera de la pantalla.
 */
export default function AvisoMfa() {
  const { avisoMfaVisible, descartarAvisoMfa } = useAuth();
  const { pathname } = useLocation();
  // En la página donde se activa, el propio bloque ya lo dice.
  if (!avisoMfaVisible || pathname === '/usuarios-acceso') return null;

  // Al quitar la franja, el botón desaparece: sin esto el foco cae en <body>.
  // Va al título de la página (`.page-title` es un div) o a `.main`, sin mover el scroll.
  function ahoraNo() {
    descartarAvisoMfa();
    const main = document.querySelector<HTMLElement>('.app-shell .main');
    const destino = main?.querySelector<HTMLElement>('h1, h2, .page-title') ?? main;
    if (!destino) return;
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
  }
  return (
    <aside className="mfa-aviso no-print" aria-label="Código de verificación">
      <div className="mfa-aviso-texto">
        <IconoEscudoAlerta />
        <div>
          <div className="mfa-aviso-titulo">Activa tu código de verificación</div>
          <div className="mfa-aviso-detalle">
            Tu cuenta entra solo con contraseña. Con el código de tu teléfono, una clave filtrada no alcanza.
          </div>
        </div>
      </div>
      <div className="mfa-aviso-acciones">
        <Link className="btn btn-primary btn-sm" to="/usuarios-acceso#mfa">
          Activar
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={ahoraNo}>
          Ahora no
        </button>
      </div>
    </aside>
  );
}
