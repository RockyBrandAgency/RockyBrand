import type { ClientAlertsResponse, ClientServices, PmsFeatures, RoomCatalogEntry } from './types';

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
  if (res.status === 401) throw new UnauthorizedError();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Error de conexión');
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
