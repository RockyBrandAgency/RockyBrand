import type { ClientAlertsResponse, ClientServices, CostsOverview, PmsFeatures, RoomCatalogEntry,
  StrategyPendienteResponse,
  CalendarioPendienteResponse,
} from './types';

const CONFIG_API_URL = 'https://1gfa1uwd8i.execute-api.us-east-2.amazonaws.com/config';
const TOKEN_STORAGE_KEY = 'rockybrandPanelToken';

export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return null;
  const expiry = parseInt(token.split('.')[0], 10);
  if (!expiry || Date.now() / 1000 > expiry) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
  return token;
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
  }
}

// El backend pide confirmar la identidad de nuevo antes de tocar
// credenciales de un cliente. Es un error distinto de UnauthorizedError
// a propósito: la sesión sigue siendo válida, lo que falta es la prueba
// de que quien la está usando es el dueño.
export class ReauthRequiredError extends Error {}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(CONFIG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ __action: 'login', username, password }),
  });
  if (!res.ok) throw new Error('Credenciales inválidas');
  const data = await res.json();
  return data.token;
}

// Login real, multi-usuario, vía Cognito - el default. `login()` de arriba
// (password compartida) queda como respaldo permanente, no se retira.
export async function panelLogin(username: string, password: string): Promise<string> {
  const res = await fetch(CONFIG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ __action: 'panel_login', username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Credenciales inválidas');
  return data.token;
}

export async function loadState<T = Record<string, unknown>>(projectId?: string): Promise<T> {
  const url = projectId ? `${CONFIG_API_URL}?project_id=${encodeURIComponent(projectId)}` : CONFIG_API_URL;
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (res.status === 401) throw new UnauthorizedError();
  const data = await res.json().catch(() => ({}));
  return (data && typeof data === 'object' ? data : {}) as T;
}

export async function saveState(state: Record<string, unknown>): Promise<void> {
  const res = await fetch(CONFIG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(state),
  });
  if (res.status === 401) throw new UnauthorizedError();
}

export async function callAction<T = unknown>(action: string, extra?: Record<string, unknown>): Promise<T> {
  const res = await fetch(CONFIG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ __action: action, ...(extra || {}) }),
  });
  const data = await res.json().catch(() => ({}));
  const fallo = data as { error?: string; reauth_required?: boolean };
  // El 401 con reauth_required NO es una sesión caída - no hay que echar al
  // usuario del panel, hay que pedirle la contraseña. Se revisa antes del
  // UnauthorizedError justamente por eso.
  if (fallo.reauth_required) throw new ReauthRequiredError(fallo.error || 'Confirma tu contraseña.');
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(fallo.error || 'Error de conexión');
  return data as T;
}

export async function getClientServices(
  projectId: string
): Promise<{ services: ClientServices; pmsFeatures: PmsFeatures; roomCatalog: RoomCatalogEntry[] }> {
  const data = await callAction<{ services: ClientServices; pms_features: PmsFeatures; room_catalog: RoomCatalogEntry[] }>(
    'get_client_services',
    { project_id: projectId }
  );
  return { services: data.services, pmsFeatures: data.pms_features, roomCatalog: data.room_catalog ?? [] };
}

// Requiere sesión de staff (rockybrand-staff) - el backend lo vuelve a
// validar server-side igual, este no es el único guardrail.
export async function updateClientServices(projectId: string, services: Partial<ClientServices>): Promise<ClientServices> {
  const data = await callAction<{ services: ClientServices }>('update_client_services', { project_id: projectId, services });
  return data.services;
}

// Sub-opción DENTRO de PMS (no on/off del servicio completo) - misma
// acción de backend que updateClientServices, con pms_features en vez de
// services en el body.
export async function updateClientPmsFeatures(projectId: string, pmsFeatures: Partial<PmsFeatures>): Promise<PmsFeatures> {
  const data = await callAction<{ pms_features: PmsFeatures }>('update_client_services', { project_id: projectId, pms_features: pmsFeatures });
  return data.pms_features;
}

export async function getClientAlerts(projectId: string): Promise<ClientAlertsResponse> {
  return callAction<ClientAlertsResponse>('get_client_alerts', { project_id: projectId });
}

// ===== Accesos de los clientes al Executive Dashboard =====
// Todas requieren sesión de staff, y las que crean/rotan/revocan acceso
// requieren además la contraseña de quien las ejecuta. El backend valida
// las dos cosas server-side: esto no es el guardrail, es la interfaz.

export interface ClientUser {
  username: string;
  sub: string;
  email: string;
  client_id: string;
  enabled: boolean;
  status: string;
  created_at?: string;
}

export interface ClientOption {
  client_id: string;
  nombre: string;
}

export async function listClientUsers(): Promise<{ users: ClientUser[]; clients: ClientOption[] }> {
  return callAction<{ users: ClientUser[]; clients: ClientOption[] }>('list_client_users');
}

/** La clave la genera el servidor y viene UNA sola vez en esta respuesta. */
export async function createClientUser(
  clientId: string,
  email: string,
  reauthPassword: string
): Promise<{ email: string; client_id: string; password: string }> {
  return callAction('create_client_user', { client_id: clientId, email, reauth_password: reauthPassword });
}

/** Rota la clave y cierra todas las sesiones abiertas de ese usuario. */
export async function resetClientUserPassword(
  clientId: string,
  username: string,
  reauthPassword: string
): Promise<{ email: string; client_id: string; password: string }> {
  return callAction('reset_client_user_password', { client_id: clientId, username, reauth_password: reauthPassword });
}

export async function setClientUserEnabled(
  clientId: string,
  username: string,
  enabled: boolean,
  reauthPassword: string
): Promise<{ email: string; enabled: boolean }> {
  return callAction('set_client_user_enabled', { client_id: clientId, username, enabled, reauth_password: reauthPassword });
}

/** Contención rápida: lo echa de todos sus dispositivos sin cambiar la clave. */
export async function signoutClientUser(clientId: string, username: string): Promise<{ email: string }> {
  return callAction('signout_client_user', { client_id: clientId, username });
}

export function formatWhen(iso?: string): string {
  if (!iso) return '';
  try {
    const withZone = /[zZ+-]\d{0,2}:?\d{0,2}$/.test(iso) ? iso : iso + 'Z';
    const d = new Date(withZone);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function formatRelative(iso?: string): string {
  if (!iso) return '';
  try {
    const withZone = /[zZ+-]\d{0,2}:?\d{0,2}$/.test(iso) ? iso : iso + 'Z';
    const d = new Date(withZone);
    if (isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH} hora${diffH === 1 ? '' : 's'}`;
    const diffD = Math.round(diffH / 24);
    return `Hace ${diffD} día${diffD === 1 ? '' : 's'}`;
  } catch {
    return iso;
  }
}

export function formatTodayEs(): string {
  const s = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// URL del panel PROPIO del cliente (06-dashboard-web, login de Cognito
// aparte, cada cliente ve solo lo suyo) - pedido explícito de Mato
// (2026-08-01): un acceso directo desde la vista de staff, sin sacarlo de
// las herramientas internas. Subdominio real por cliente
// (nombredelcliente.panel.rockybrand.cl, wildcard en la asociación de
// dominio de Amplify) - agregar el origen exacto a `allow_origins` en
// dashboard_stack.py al sumar un cliente nuevo (API Gateway v2 no admite
// wildcards en CORS, confirmado en vivo).
export function getClientDashboardUrl(projectId: string): string {
  return `https://${projectId}.panel.rockybrand.cl`;
}

// ===== Sección COSTOS =====
// Requiere sesión de staff; el backend lo vuelve a verificar server-side
// (un token de cliente recibe 403 aunque llame directo al endpoint).

export async function getCostsOverview(): Promise<CostsOverview> {
  return callAction<CostsOverview>('get_costs_overview');
}

export async function saveFixedCost(payload: {
  nombre: string;
  monto: number;
  moneda: 'USD' | 'CLP';
  ciclo: 'mensual' | 'anual';
  dia_cobro?: number | null;
  icono?: string | null;
  nota?: string | null;
  slug?: string;
  activa?: boolean;
}): Promise<{ ok: boolean; cost_id: string }> {
  return callAction('save_fixed_cost', payload);
}

export async function deleteFixedCost(costId: string): Promise<{ ok: boolean }> {
  return callAction('delete_fixed_cost', { cost_id: costId });
}

export async function saveClientRevenue(
  clientId: string,
  montoUsd: number
): Promise<{ ok: boolean }> {
  return callAction('save_client_revenue', { client_id: clientId, monto_usd: montoUsd });
}

/** Cuesta USD 0,01 (una consulta a Cost Explorer). Confirmar con el usuario antes. */
export async function refreshCostsNow(): Promise<{ ok: boolean; costo_estimado_usd: number; nota: string }> {
  return callAction('refresh_costs_now');
}

// ===== Aprobaciones de Rox y de Dave =====
//
// El gate existe porque un error de Rox sesga a cinco agentes por un mes:
// revisar una estrategia cuesta cinco minutos y evita corregir treinta
// piezas nacidas de una estrategia equivocada. Mientras algo espera
// aprobación, los agentes siguen con lo anterior — nadie se bloquea.

export async function getStrategyPendiente(projectId: string): Promise<StrategyPendienteResponse> {
  return callAction<StrategyPendienteResponse>('get_strategy_pendiente', { project_id: projectId });
}

export async function aprobarEstrategia(projectId: string): Promise<{ ok: boolean; aprobada_at: string }> {
  return callAction('aprobar_estrategia', { project_id: projectId });
}

/** El motivo es obligatorio y lo valida el backend: sin él Rox no tiene con qué corregir. */
export async function rechazarEstrategia(projectId: string, motivo: string): Promise<{ ok: boolean }> {
  return callAction('rechazar_estrategia', { project_id: projectId, motivo });
}

export async function getCalendarioPendiente(projectId: string): Promise<CalendarioPendienteResponse> {
  return callAction<CalendarioPendienteResponse>('get_calendario_pendiente', { project_id: projectId });
}

/** Aprobar la estructura crea las piezas para revisión una por una. */
export async function aprobarCalendario(
  projectId: string
): Promise<{ ok: boolean; piezas_solicitadas: boolean; nota: string }> {
  return callAction('aprobar_calendario', { project_id: projectId });
}

export async function rechazarCalendario(projectId: string, motivo: string): Promise<{ ok: boolean }> {
  return callAction('rechazar_calendario', { project_id: projectId, motivo });
}
