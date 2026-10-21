import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  callAction,
  listClientUsers,
  createClientUser,
  resetClientUserPassword,
  setClientUserEnabled,
  signoutClientUser,
  setClientUserRole,
  resetClientUserMfa,
  ROLES_CLIENTE,
  ROL_CLIENTE_POR_DEFECTO,
  nombreRol,
  type RolCliente,
  UnauthorizedError,
  ReauthRequiredError,
  formatWhen,
  getClientDashboardUrl,
  type ClientUser,
  type ClientOption, ApiError, MENSAJE_COMUN_POR_CODIGO } from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import MfaPropio from '../components/MfaPropio';

interface PanelUser {
  sub: string;
  email: string;
  enabled: boolean;
  status: string;
  created_at?: string;
}

interface AccessEvent {
  user_sub: string;
  ts: string;
  event_type: string;
  source_ip: string;
  username_attempted?: string;
  user_agent?: string;
}

const EVENT_LABEL: Record<string, string> = {
  LOGIN_SUCCESS: 'Ingreso exitoso',
  LOGIN_FAILED: 'Intento fallido',
  USER_CREATED: 'Usuario creado',
  TOKEN_REFRESH: 'Sesión renovada',
  REAUTH_FAILED: 'Confirmación fallida',
  CLIENT_USER_CREATED: 'Acceso de cliente creado',
  CLIENT_PASSWORD_RESET: 'Clave de cliente cambiada',
  CLIENT_USER_DISABLED: 'Acceso de cliente cortado',
  CLIENT_USER_ENABLED: 'Acceso de cliente devuelto',
  CLIENT_SESSIONS_REVOKED: 'Sesiones de cliente cerradas',
  CLIENT_ACCESS_DENIED: 'Acción sobre cliente rechazada',
  CLIENT_ROLE_CHANGED: 'Rol de cliente cambiado',
  CLIENT_MFA_RESET: 'Código de cliente restablecido',
  STAFF_MFA_SETUP_STARTED: 'Inscripción de código iniciada',
  STAFF_MFA_ENABLED: 'Código de verificación activado',
  LOGIN_CHALLENGE: 'Paso extra al ingresar',
};

// Los eventos que hay que poder distinguir de un vistazo en la auditoría:
// un rechazo o un intento fallido importa más que un ingreso normal.
const EVENTOS_DE_ALERTA = ['LOGIN_FAILED', 'REAUTH_FAILED', 'CLIENT_ACCESS_DENIED'];

/** Entero uniforme en [0, max) sin el sesgo que introduce un `% max` crudo. */
function randomInt(max: number): number {
  const limite = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let valor: number;
  do {
    crypto.getRandomValues(buf);
    valor = buf[0];
  } while (valor >= limite);
  return valor % max;
}

// Sin caracteres ambiguos: alguien va a tener que dictar o pegar esto.
const MINUS = 'abcdefghijkmnopqrstuvwxyz';
const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const NUMS = '23456789';

function generateTempPassword(): string {
  // crypto.getRandomValues, NO Math.random(): Math.random es predecible por
  // diseño y no sirve para generar una credencial. Garantiza una de cada
  // clase para cumplir la política del pool (8+, mayúscula, minúscula,
  // número) sin depender de la suerte del sorteo.
  const alfabeto = MINUS + MAYUS + NUMS;
  const chars = [MINUS[randomInt(MINUS.length)], MAYUS[randomInt(MAYUS.length)], NUMS[randomInt(NUMS.length)]];
  while (chars.length < 20) chars.push(alfabeto[randomInt(alfabeto.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Lo que espera la confirmación de contraseña para ejecutarse. */
type AccionPendiente =
  | { tipo: 'crear'; clientId: string; email: string; rol: RolCliente }
  | { tipo: 'clave'; user: ClientUser }
  | { tipo: 'rol'; user: ClientUser }
  | { tipo: 'mfa'; user: ClientUser }
  | { tipo: 'estado'; user: ClientUser; habilitar: boolean };

interface CredencialNueva {
  email: string;
  clientId: string;
  password: string;
  motivo: 'creada' | 'rotada';
}

export default function UsuariosAcceso() {
  const { handleUnauthorized } = useAuth();
  const { hash } = useLocation();
  const [users, setUsers] = useState<PanelUser[] | null>(null);
  const [events, setEvents] = useState<AccessEvent[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState(generateTempPassword());
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [showPassword, setShowPassword] = useState(true);

  // --- Accesos de clientes ---
  const [clientUsers, setClientUsers] = useState<ClientUser[] | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [nuevoCliente, setNuevoCliente] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoRol, setNuevoRol] = useState<RolCliente>(ROL_CLIENTE_POR_DEFECTO);
  // Rol elegido dentro del modal de «Cambiar rol».
  const [rolElegido, setRolElegido] = useState<RolCliente>(ROL_CLIENTE_POR_DEFECTO);
  const [clientMsg, setClientMsg] = useState('');
  const [pendiente, setPendiente] = useState<AccionPendiente | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [ejecutando, setEjecutando] = useState(false);
  const [credencial, setCredencial] = useState<CredencialNueva | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [usersData, eventsData, clientData] = await Promise.all([
        callAction<{ users: PanelUser[] }>('list_panel_users'),
        callAction<{ events: AccessEvent[] }>('get_access_log', { limit: 50 }),
        listClientUsers(),
      ]);
      setUsers(usersData.users);
      setEvents(eventsData.events);
      setClientUsers(clientData.users);
      setClients(clientData.clients);
      setNuevoCliente((actual) => actual || clientData.clients[0]?.client_id || '');
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      setLoadError(e instanceof Error && e.message ? e.message : 'No se pudo cargar.');
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setCreateMsg('Ingresa un email válido.');
      return;
    }
    if (tempPassword.length < 8) {
      setCreateMsg('La clave temporal debe tener al menos 8 caracteres.');
      return;
    }
    setCreating(true);
    setCreateMsg('');
    try {
      await callAction('create_user', { email: trimmed, temp_password: tempPassword });
      setCreateMsg(`Usuario creado. Entrégale a ${trimmed} este email y esta clave temporal por un canal seguro.`);
      setEmail('');
      setTempPassword(generateTempPassword());
      await load();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      setCreateMsg(e instanceof Error && e.message ? e.message : 'No se pudo crear el usuario.');
    } finally {
      setCreating(false);
    }
  }

  function pedirConfirmacion(accion: AccionPendiente) {
    setClientMsg('');
    setReauthPassword('');
    setReauthError('');
    if (accion.tipo === 'rol') setRolElegido(accion.user.rol || ROL_CLIENTE_POR_DEFECTO);
    setPendiente(accion);
  }

  function cerrarModal() {
    setPendiente(null);
    setReauthPassword('');
    setReauthError('');
  }

  /** Ejecuta la acción pendiente una vez confirmada la contraseña. */
  async function confirmarAccion() {
    if (!pendiente || !reauthPassword) {
      setReauthError('Escribe tu contraseña para confirmar.');
      return;
    }
    setEjecutando(true);
    setReauthError('');
    try {
      if (pendiente.tipo === 'crear') {
        const r = await createClientUser(pendiente.clientId, pendiente.email, pendiente.rol, reauthPassword);
        setCredencial({ email: r.email, clientId: r.client_id, password: r.password, motivo: 'creada' });
        setNuevoEmail('');
        setNuevoRol(ROL_CLIENTE_POR_DEFECTO);
      } else if (pendiente.tipo === 'clave') {
        const r = await resetClientUserPassword(pendiente.user.client_id, pendiente.user.username, reauthPassword);
        setCredencial({ email: r.email, clientId: r.client_id, password: r.password, motivo: 'rotada' });
      } else if (pendiente.tipo === 'rol') {
        if (rolElegido === pendiente.user.rol) {
          setReauthError('Elige un rol distinto al actual.');
          return;
        }
        const r = await setClientUserRole(pendiente.user.client_id, pendiente.user.username, rolElegido, reauthPassword);
        setClientMsg(`${r.email} ahora tiene el rol ${nombreRol(r.rol)}. Sus sesiones abiertas se cerraron.`);
      } else if (pendiente.tipo === 'mfa') {
        const r = await resetClientUserMfa(pendiente.user.client_id, pendiente.user.username, reauthPassword);
        setClientMsg(
          `Se restableció el código de verificación de ${r.email}. Desde ahora entra solo con su clave, hasta que vuelva a activar el código desde la Configuración de su panel.`
        );
      } else {
        const r = await setClientUserEnabled(
          pendiente.user.client_id,
          pendiente.user.username,
          pendiente.habilitar,
          reauthPassword
        );
        setClientMsg(
          r.enabled
            ? `Se le devolvió el acceso a ${r.email}.`
            : `Se cortó el acceso de ${r.email}. Sus sesiones abiertas se cerraron.`
        );
      }
      cerrarModal();
      await load();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      // La contraseña no era correcta: el modal se queda abierto para
      // reintentar, en vez de perder la acción y hacer empezar de nuevo.
      if (e instanceof ReauthRequiredError) {
        // 401 `reauth_requerida`: faltó la clave. 403 `credenciales`: mala.
        setReauthError(e.codigo === 'reauth_requerida' ? 'Escribe tu contraseña para confirmar.' : 'La contraseña no es correcta.');
        return;
      }
      if (e instanceof ApiError && e.codigo && MENSAJE_COMUN_POR_CODIGO[e.codigo]) {
        setReauthError(MENSAJE_COMUN_POR_CODIGO[e.codigo]);
        return;
      }
      setReauthError(e instanceof Error && e.message ? e.message : 'No se pudo ejecutar.');
    } finally {
      setEjecutando(false);
    }
  }

  async function cerrarSesiones(user: ClientUser) {
    setClientMsg('');
    setOcupado(user.username);
    try {
      const r = await signoutClientUser(user.client_id, user.username);
      setClientMsg(`Se cerraron todas las sesiones de ${r.email}. Su clave no cambió.`);
      await load();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      if (e instanceof ReauthRequiredError) {
        setClientMsg(e.message);
        return;
      }
      setClientMsg(e instanceof Error && e.message ? e.message : 'No se pudo cerrar las sesiones.');
    } finally {
      setOcupado('');
    }
  }

  function iniciarCreacion() {
    const correo = nuevoEmail.trim().toLowerCase();
    if (!nuevoCliente) {
      setClientMsg('Elige de qué cliente es este acceso.');
      return;
    }
    if (!correo || !correo.includes('@')) {
      setClientMsg('Ingresa un email válido.');
      return;
    }
    pedirConfirmacion({ tipo: 'crear', clientId: nuevoCliente, email: correo, rol: nuevoRol });
  }

  async function copiarClave() {
    if (!credencial) return;
    try {
      await navigator.clipboard.writeText(credencial.password);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  const nombreCliente = (clientId: string) =>
    clients.find((c) => c.client_id === clientId)?.nombre || clientId;

  const tituloModal =
    pendiente?.tipo === 'crear'
      ? 'Crear acceso de cliente'
      : pendiente?.tipo === 'clave'
        ? 'Cambiar la contraseña del cliente'
        : pendiente?.tipo === 'rol'
          ? 'Cambiar el rol'
          : pendiente?.tipo === 'mfa'
            ? 'Restablecer el código de verificación'
            : pendiente?.habilitar
          ? 'Devolver el acceso'
          : 'Cortar el acceso';

  const detalleModal =
    pendiente?.tipo === 'crear'
      ? `Se va a crear ${pendiente.email} como acceso ${nombreRol(pendiente.rol)} de ${nombreCliente(pendiente.clientId)}.`
      : pendiente?.tipo === 'clave'
        ? `${pendiente.user.email} va a recibir una contraseña nueva y todas sus sesiones abiertas se van a cerrar.`
        : pendiente?.tipo === 'rol'
          ? `${pendiente.user.email} tiene hoy el rol ${nombreRol(pendiente.user.rol)}. Al cambiarlo, sus sesiones abiertas se cierran.`
          : pendiente?.tipo === 'mfa'
            ? `Se desactiva el código de ${pendiente.user.email}, por ejemplo porque perdió el teléfono. Desde ahora entra solo con su clave, hasta que vuelva a activar el código desde la Configuración de su panel.`
            : pendiente
          ? pendiente.habilitar
            ? `${pendiente.user.email} va a poder volver a entrar a su panel.`
            : `${pendiente.user.email} va a dejar de poder entrar. Es reversible.`
          : '';

  return (
    <div className="main">
      <div className="eyebrow">General</div>
      <div className="page-title">Usuarios y accesos</div>
      <div className="page-sub">
        Quién puede entrar al panel de administración de RockyBrand y a los paneles de los
        clientes — la superficie más sensible del sistema. Cada acción queda registrada abajo,
        con fecha, IP y resultado.
      </div>

      <MfaPropio enfocar={hash === '#mfa'} />

      <div className="section-head" style={{ marginTop: 32 }}>
        <span className="section-title">Crear usuario de RockyBrand</span>
      </div>
      <div className="card form-section" style={{ maxWidth: 480, marginTop: 16 }}>
        <div className="crm-field">
          <label>Email</label>
          <input placeholder="nombre@rockybrand.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="crm-field">
          <label>Clave temporal</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ flex: 1 }}
              type={showPassword ? 'text' : 'password'}
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTempPassword(generateTempPassword())}>
              Regenerar
            </button>
          </div>
          <div className="field-hint">
            Tú se la entregas a la persona por un canal seguro — no se manda ningún email automático.
          </div>
        </div>
        <div className="send-actions">
          <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
        {createMsg && <div className="manual-invoke-msg" style={{ marginTop: 10 }}>{createMsg}</div>}
      </div>

      {loadError && (
        <div className="card" style={{ marginTop: 24, borderColor: '#e07856' }}>
          <div className="empty-state" style={{ color: '#e07856' }}>{loadError}</div>
        </div>
      )}

      <div className="section-head" style={{ marginTop: 32 }}>
        <span className="section-title">Usuarios de RockyBrand</span>
      </div>
      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Estado</th>
              <th>Alta</th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.sub}>
                <td className="cell-name">{u.email}</td>
                <td>
                  <span className={`pill ${u.enabled ? 'subscribed' : 'unsubscribed'}`}>
                    <span className="pill-dot" />
                    {u.enabled ? u.status : 'Deshabilitado'}
                  </span>
                </td>
                <td className="tabular">{formatWhen(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users !== null && !users.length && <div className="empty-state">Todavía no hay usuarios creados.</div>}
        {users === null && !loadError && <div className="empty-state">Cargando…</div>}
      </div>

      {/* ===== Accesos de clientes ===== */}

      <div className="section-head" style={{ marginTop: 44 }}>
        <span className="section-title">Accesos de clientes</span>
      </div>
      <div className="page-sub" style={{ marginTop: 8 }}>
        Los accesos al panel propio de cada cliente. La contraseña la genera el sistema y se
        muestra una sola vez: no queda guardada en ninguna parte, ni acá ni en el registro de
        auditoría. Cada cambio te pide tu propia contraseña antes de ejecutarse.
      </div>

      <div className="card form-section" style={{ maxWidth: 560, marginTop: 16 }}>
        <div className="crm-field">
          <label>Cliente</label>
          <select value={nuevoCliente} onChange={(e) => setNuevoCliente(e.target.value)}>
            {!clients.length && <option value="">Cargando…</option>}
            {clients.map((c) => (
              <option key={c.client_id} value={c.client_id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="crm-field">
          <label htmlFor="nuevo-rol">Rol</label>
          <select id="nuevo-rol" value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value as RolCliente)}>
            {ROLES_CLIENTE.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.nombre}
              </option>
            ))}
          </select>
          <div className="field-hint">Lectura solo mira; Editor además cambia contenido; Admin además gestiona su cuenta.</div>
        </div>
        <div className="crm-field">
          <label>Email del cliente</label>
          <input
            placeholder="contacto@sucliente.cl"
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
          />
          <div className="field-hint">
            Con este email entra a {nuevoCliente ? getClientDashboardUrl(nuevoCliente) : 'su panel'}. No
            recibe ningún correo automático: la clave se la entregas tú.
          </div>
        </div>
        <div className="send-actions">
          <button className="btn btn-primary btn-sm" onClick={iniciarCreacion}>
            Crear acceso
          </button>
        </div>
        {clientMsg && <div className="manual-invoke-msg" style={{ marginTop: 10 }}>{clientMsg}</div>}
      </div>

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Rol</th>
              <th>MFA</th>
              <th>Alta</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(clientUsers || []).map((u) => (
              <tr key={u.sub}>
                <td className="cell-name">{nombreCliente(u.client_id)}</td>
                <td className="cell-sub">{u.email}</td>
                <td>
                  <span className={`pill ${u.enabled ? 'subscribed' : 'unsubscribed'}`}>
                    <span className="pill-dot" />
                    {u.enabled ? u.status : 'Deshabilitado'}
                  </span>
                </td>
                <td>
                  <span className={`pill ${u.rol ? 'subscribed' : 'scheduled'}`}>
                    <span className="pill-dot" />
                    {nombreRol(u.rol)}
                  </span>
                </td>
                <td>
                  <span
                    className={`pill ${u.mfa_inscrito === true ? 'subscribed' : u.mfa_inscrito === false ? 'scheduled' : 'draft'}`}
                  >
                    <span className="pill-dot" />
                    {u.mfa_inscrito === true ? 'Activo' : u.mfa_inscrito === false ? 'Sin activar' : 'Sin dato'}
                  </span>
                </td>
                <td className="tabular">{formatWhen(u.created_at)}</td>
                <td style={{ textAlign: 'right', minWidth: 220 }}>
                  {/* Seis acciones: se reparten en filas en vez de estirar la tabla. */}
                  <div className="acciones-fila">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => pedirConfirmacion({ tipo: 'rol', user: u })}
                  >
                    Cambiar rol
                  </button>
                  {u.mfa_inscrito !== false && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => pedirConfirmacion({ tipo: 'mfa', user: u })}
                    >
                      Restablecer MFA
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => pedirConfirmacion({ tipo: 'clave', user: u })}
                  >
                    Cambiar clave
                  </button>{' '}
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={ocupado === u.username}
                    onClick={() => cerrarSesiones(u)}
                  >
                    {ocupado === u.username ? 'Cerrando…' : 'Cerrar sesiones'}
                  </button>{' '}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => pedirConfirmacion({ tipo: 'estado', user: u, habilitar: !u.enabled })}
                  >
                    {u.enabled ? 'Cortar acceso' : 'Devolver acceso'}
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientUsers !== null && !clientUsers.length && (
          <div className="empty-state">Todavía no hay accesos de clientes creados.</div>
        )}
        {clientUsers === null && !loadError && <div className="empty-state">Cargando…</div>}
      </div>

      <div className="section-head" style={{ marginTop: 32 }}>
        <span className="section-title">Auditoría de accesos</span>
      </div>
      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Cuándo</th>
              <th>Evento</th>
              <th>Usuario</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {(events || []).map((ev) => (
              <tr key={`${ev.user_sub}#${ev.ts}`}>
                <td className="tabular">{formatWhen(ev.ts.split('#')[0])}</td>
                <td>
                  <span className={`pill ${EVENTOS_DE_ALERTA.includes(ev.event_type) ? 'alerta' : 'subscribed'}`}>
                    <span className="pill-dot" />
                    {EVENT_LABEL[ev.event_type] || ev.event_type}
                  </span>
                </td>
                <td className="cell-sub">{ev.username_attempted || ev.user_sub}</td>
                <td className="tabular">{ev.source_ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {events !== null && !events.length && <div className="empty-state">Sin accesos registrados hoy todavía.</div>}
        {events === null && !loadError && <div className="empty-state">Cargando…</div>}
      </div>

      {pendiente && (
        <Modal title={tituloModal} sub={detalleModal} onClose={cerrarModal}>
          {pendiente.tipo === 'rol' && (
            <div className="crm-field">
              <label htmlFor="rol-elegido">Rol nuevo</label>
              <select
                id="rol-elegido"
                value={rolElegido}
                onChange={(e) => setRolElegido(e.target.value as RolCliente)}
              >
                {ROLES_CLIENTE.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="crm-field">
            <label htmlFor="reauth-password">Tu contraseña</label>
            <input
              id="reauth-password"
              type="password"
              autoFocus
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !ejecutando) confirmarAccion();
              }}
            />
            <div className="field-hint">
              La misma con la que entraste al panel. Se pide de nuevo para que tener la sesión
              abierta no alcance para tocar las credenciales de un cliente.
            </div>
          </div>
          {reauthError && (
            <div className="manual-invoke-msg" role="alert" style={{ marginTop: 10, color: '#e07856' }}>
              {reauthError}
            </div>
          )}
          <div className="send-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={cerrarModal} disabled={ejecutando}>
              Cancelar
            </button>{' '}
            <button className="btn btn-primary btn-sm" onClick={confirmarAccion} disabled={ejecutando}>
              {ejecutando ? 'Confirmando…' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}

      {credencial && (
        <Modal
          title={credencial.motivo === 'creada' ? 'Acceso creado' : 'Contraseña cambiada'}
          sub={`Cópiala ahora y entrégasela a ${nombreCliente(credencial.clientId)} por un canal seguro. No se guarda en ninguna parte, así que no vas a poder volver a verla.`}
          onClose={() => setCredencial(null)}
        >
          <div className="crm-field">
            <label>Email</label>
            <input readOnly value={credencial.email} />
          </div>
          <div className="crm-field">
            <label>Contraseña</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly style={{ flex: 1, fontFamily: 'monospace' }} value={credencial.password} />
              <button type="button" className="btn btn-primary btn-sm" onClick={copiarClave}>
                {copiado ? 'Copiada' : 'Copiar'}
              </button>
            </div>
            <div className="field-hint">
              Entra en {getClientDashboardUrl(credencial.clientId)}
              {credencial.motivo === 'rotada' && ' — sus sesiones abiertas ya se cerraron.'}
            </div>
          </div>
          <div className="send-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setCredencial(null)}>
              Ya la guardé
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
