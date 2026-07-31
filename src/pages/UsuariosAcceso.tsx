import { useEffect, useState, useCallback } from 'react';
import { callAction, UnauthorizedError, formatWhen } from '../api';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';

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
};

function generateTempPassword(): string {
  // Cumple los requisitos por defecto del pool (mayúscula, minúscula,
  // número, símbolo, 12+) - Mato la reemplaza o se la entrega al usuario
  // nuevo por el canal que prefiera, nunca queda en ningún lado más que acá.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `Rb-${s}!9`;
}

export default function UsuariosAcceso() {
  const { handleUnauthorized } = useAuth();
  const [users, setUsers] = useState<PanelUser[] | null>(null);
  const [events, setEvents] = useState<AccessEvent[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState(generateTempPassword());
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [showPassword, setShowPassword] = useState(true);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [usersData, eventsData] = await Promise.all([
        callAction<{ users: PanelUser[] }>('list_panel_users'),
        callAction<{ events: AccessEvent[] }>('get_access_log', { limit: 50 }),
      ]);
      setUsers(usersData.users);
      setEvents(eventsData.events);
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

  return (
    <Reveal>
      <div className="eyebrow">General</div>
      <div className="page-title">Usuarios y accesos</div>
      <div className="page-sub">
        Quién puede entrar al panel de administración de RockyBrand — la superficie más sensible
        del sistema. Cada acceso queda registrado abajo, con fecha, IP y resultado.
      </div>

      <div className="section-head" style={{ marginTop: 32 }}>
        <span className="section-title">Crear usuario</span>
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
        <span className="section-title">Usuarios con acceso</span>
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
                  <span className={`pill ${ev.event_type === 'LOGIN_FAILED' ? 'unsubscribed' : 'subscribed'}`}>
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
    </Reveal>
  );
}
