import type { ClientAlertsResponse, ClientFeatures, ClientServices, CostsOverview, PmsFeatures, RoomCatalogEntry,
  StrategyPendienteResponse,
  CalendarioPendienteResponse,
} from './types';

// H6 (auditoria Well-Architected, 21-sep-2026): URL configurable por variable
// de entorno, con el valor real de produccion como respaldo si Amplify no la
// tiene definida - asi este cambio no puede romper el build ni el login
// existente aunque la variable no se configure antes del proximo deploy.
const CONFIG_API_URL = import.meta.env.VITE_PANEL_API_URL || 'https://1gfa1uwd8i.execute-api.us-east-2.amazonaws.com/config';
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
// `codigo`: `reauth_requerida` (401, faltó la clave) o `credenciales` (403,
// clave incorrecta). Solo el segundo es «la contraseña no es correcta».
export class ReauthRequiredError extends Error {
  codigo?: string;
  constructor(message: string, codigo?: string) {
    super(message);
    this.codigo = codigo;
  }
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(CONFIG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ __action: 'login', username, password }),
  });
  if (!res.ok) {
    // Trae `codigo` como panel_login: 401 `credenciales` y 429 `bloqueado`.
    // Sin texto, vacío: la pantalla pone su mensaje de servidor.
    const fallo = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(typeof fallo.error === 'string' ? fallo.error : '', res.status, codigoDe(fallo));
  }
  const data = await res.json();
  return data.token;
}

// Login real, multi-usuario, vía Cognito - el default. `login()` de arriba
// (password compartida) queda como respaldo permanente, no se retira.
//
// Puede terminar en un token o en un desafío de Cognito (código de 6
// dígitos, inscripción del código o clave nueva obligatoria). El desafío se
// responde con `panelLoginChallenge` y puede encadenar otro desafío.

export type DesafioLogin = 'SOFTWARE_TOKEN_MFA' | 'MFA_SETUP' | 'NEW_PASSWORD_REQUIRED';

export type ResultadoLogin =
  | { tipo: 'token'; token: string; mfaInscrito: boolean | null }
  | {
      tipo: 'desafio';
      desafio: DesafioLogin;
      session: string;
      /**
       * Cuenta firmada por el servidor (opaca, vence en 15 min). El paso
       * siguiente la devuelve tal cual: sin ella, o con la de otra session,
       * los tres desafíos (SOFTWARE_TOKEN_MFA, MFA_SETUP y
       * NEW_PASSWORD_REQUIRED) responden 400 `faltan_datos`.
       */
      cuenta?: string;
      secretCode?: string;
      otpauthUri?: string;
    };

/** Texto que pone callAction cuando la respuesta de error no trae `error`. */
export const MSG_SERVIDOR_POR_DEFECTO = 'Hubo un problema en el servidor. Intenta de nuevo en un momento.';

// Textos por `codigo` que comparten el login, la reautenticación y MfaPropio.
// Sin minutos ni intentos en el bloqueo: no se dan detalles.

export const MENSAJE_COMUN_POR_CODIGO: Record<string, string> = {
  bloqueado: 'Hubo demasiados intentos. Espera unos minutos e intenta de nuevo.',
  desafio_no_soportado: 'Tu cuenta pide un paso que el panel aún no maneja. Avísale al equipo.',
};

/**
 * Error de una llamada a la API con su código HTTP y, si el backend lo manda,
 * su `codigo` (identificador estable del caso). La pantalla decide el texto
 * por `codigo`; si no viene, muestra el texto del servidor.
 */
export class ApiError extends Error {
  status: number;
  codigo?: string;
  constructor(message: string, status: number, codigo?: string) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}

function codigoDe(data: unknown): string | undefined {
  const c = (data as { codigo?: unknown } | null)?.codigo;
  return typeof c === 'string' && c ? c : undefined;
}

function leerResultadoLogin(data: Record<string, unknown>): ResultadoLogin {
  if (typeof data.token === 'string' && data.token) {
    const mfa = data.mfa_inscrito;
    return { tipo: 'token', token: data.token, mfaInscrito: typeof mfa === 'boolean' ? mfa : null };
  }
  const desafio = data.challenge;
  if (
    (desafio === 'SOFTWARE_TOKEN_MFA' || desafio === 'MFA_SETUP' || desafio === 'NEW_PASSWORD_REQUIRED') &&
    typeof data.session === 'string' &&
    data.session
  ) {
    return {
      tipo: 'desafio',
      desafio,
      session: data.session,
      cuenta: typeof data.cuenta === 'string' && data.cuenta ? data.cuenta : undefined,
      secretCode: typeof data.secret_code === 'string' ? data.secret_code : undefined,
      otpauthUri: typeof data.otpauth_uri === 'string' ? data.otpauth_uri : undefined,
    };
  }
  if (typeof desafio === 'string' && desafio) {
    throw new ApiError(`El servidor pidió un paso que este panel todavía no maneja (${desafio}). Avisa al equipo técnico.`, 500, codigoDe(data));
  }
  throw new ApiError('Respuesta inesperada del servidor.', 500, codigoDe(data));
}

async function postLogin(cuerpo: Record<string, unknown>): Promise<ResultadoLogin> {
  const res = await fetch(CONFIG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // Sin texto del backend (cuerpo vacío, text/plain o sin `error`): texto
    // vacío, y la pantalla pone su mensaje de servidor. Un 401 o 400 sin
    // cuerpo no prueba que la clave esté mal.
    const texto = typeof data.error === 'string' && data.error ? data.error : '';
    throw new ApiError(texto, res.status, codigoDe(data));
  }
  return leerResultadoLogin(data);
}

export async function panelLogin(username: string, password: string): Promise<ResultadoLogin> {
  return postLogin({ __action: 'panel_login', username, password });
}

/** Responde un desafío con el código de 6 dígitos o con la clave nueva. */
export async function panelLoginChallenge(
  username: string,
  desafio: DesafioLogin,
  session: string,
  respuesta: { code: string } | { new_password: string },
  cuenta?: string
): Promise<ResultadoLogin> {
  return postLogin({
    __action: 'panel_login_challenge',
    username,
    challenge: desafio,
    session,
    ...(cuenta ? { cuenta } : {}),
    ...respuesta,
  });
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
  if (fallo.reauth_required) throw new ReauthRequiredError(fallo.error || 'Confirma tu contraseña.', codigoDe(data));
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    // Sin texto del backend no se adivina la causa: mensaje de servidor.
    throw new ApiError(fallo.error || MSG_SERVIDOR_POR_DEFECTO, res.status, codigoDe(data));
  }
  return data as T;
}

export async function getClientServices(
  projectId: string
): Promise<{
  services: ClientServices;
  pmsFeatures: PmsFeatures;
  // null cuando la Lambda desplegada es anterior al 2026-08-19 y todavia
  // no manda `features`. Se distingue de "todas apagadas" a proposito: la
  // pantalla de configuracion avisa que falta desplegar en vez de pintar
  // switches que al tocarlos devolverian 400 por clave desconocida.
  features: ClientFeatures | null;
  roomCatalog: RoomCatalogEntry[];
}> {
  const data = await callAction<{
    services: ClientServices;
    pms_features: PmsFeatures;
    features?: ClientFeatures;
    room_catalog: RoomCatalogEntry[];
  }>('get_client_services', { project_id: projectId });
  return {
    services: data.services,
    pmsFeatures: data.pms_features,
    features: data.features ?? null,
    roomCatalog: data.room_catalog ?? [],
  };
}

// Requiere sesión de staff (rockybrand-staff) - el backend lo vuelve a
// validar server-side igual, este no es el único guardrail.
export async function updateClientServices(projectId: string, services: Partial<ClientServices>): Promise<ClientServices> {
  const data = await callAction<{ services: ClientServices }>('update_client_services', { project_id: projectId, services });
  return data.services;
}

// Sub-opción DENTRO de un servicio (no on/off del servicio completo) -
// misma acción de backend que updateClientServices, con `features` en vez
// de `services` en el body. Cubre tanto las pantallas del PMS como las
// pestañas de Email Marketing: para el backend son la misma clase de
// bandera (campo plano en client-config), y tener un solo endpoint evita
// que una de las dos se quede sin validar.
export async function updateClientFeatures(
  projectId: string,
  features: Partial<ClientFeatures>
): Promise<ClientFeatures> {
  const data = await callAction<{ features: ClientFeatures }>('update_client_services', {
    project_id: projectId,
    features,
  });
  return data.features;
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
  /**
   * null: el usuario no está en ningún grupo de rol (acceso anterior a los
   * roles). El dashboard lo trata como Admin por `ROL_SIN_GRUPO`, así que acá
   * se muestra «Admin (sin asignar)», no como si no tuviera permisos.
   */
  rol?: RolCliente | null;
  /** null: no se pudo consultar. */
  mfa_inscrito?: boolean | null;
}

export type RolCliente = 'cliente-lectura' | 'cliente-editor' | 'cliente-admin';

export const ROLES_CLIENTE: { valor: RolCliente; nombre: string }[] = [
  { valor: 'cliente-lectura', nombre: 'Lectura' },
  { valor: 'cliente-editor', nombre: 'Editor' },
  { valor: 'cliente-admin', nombre: 'Admin' },
];

export const ROL_CLIENTE_POR_DEFECTO: RolCliente = 'cliente-admin';

export const NOMBRE_ROL_SIN_ASIGNAR = 'Admin (sin asignar)';

export function nombreRol(rol?: RolCliente | null): string {
  return ROLES_CLIENTE.find((r) => r.valor === rol)?.nombre || NOMBRE_ROL_SIN_ASIGNAR;
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
  rol: RolCliente,
  reauthPassword: string
): Promise<{ email: string; client_id: string; rol: RolCliente; password: string }> {
  return callAction('create_client_user', { client_id: clientId, email, rol, reauth_password: reauthPassword });
}

/** Cambia el rol y cierra todas las sesiones abiertas de ese usuario. */
export async function setClientUserRole(
  clientId: string,
  username: string,
  rol: RolCliente,
  reauthPassword: string
): Promise<{ email: string; client_id: string; rol: RolCliente }> {
  return callAction('set_client_user_role', { client_id: clientId, username, rol, reauth_password: reauthPassword });
}

/**
 * Desactiva el código de verificación de quien perdió el teléfono. El pool
 * tiene MFA opcional: desde ahí entra solo con su clave, hasta que vuelva a
 * activar el código desde la Configuración de su panel.
 */
export async function resetClientUserMfa(
  clientId: string,
  username: string,
  reauthPassword: string
): Promise<{ email: string; client_id: string; mfa_inscrito: false }> {
  return callAction('reset_client_user_mfa', { client_id: clientId, username, reauth_password: reauthPassword });
}

// ===== Código de verificación (MFA) del propio staff =====
// Las dos piden la contraseña otra vez: el backend vuelve a autenticar con
// Cognito en el servidor y el token de Cognito nunca llega al navegador.

export async function staffMfaIniciar(reauthPassword: string): Promise<{ secret_code: string; otpauth_uri: string }> {
  return callAction('staff_mfa_iniciar', { reauth_password: reauthPassword });
}

export async function staffMfaVerificar(
  reauthPassword: string,
  code: string
): Promise<{ ok: boolean; mfa_inscrito: boolean }> {
  return callAction('staff_mfa_verificar', { reauth_password: reauthPassword, code });
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
