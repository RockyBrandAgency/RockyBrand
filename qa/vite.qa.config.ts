// Servidor de QA del login con desafíos y de los accesos con rol/MFA.
// Sirve el panel con Vite y responde la API con un mock local en
// /__mock_api: nada sale a la red real. Solo para pruebas; el build de
// producción no usa este archivo.
//
//   npx vite --config qa/vite.qa.config.ts --port 5199
//
// Correos de prueba (contraseña cualquiera):
//   directo@qa.test   token sin desafío, mfa_inscrito:false
//   codigo@qa.test    SOFTWARE_TOKEN_MFA (código correcto: 123456)
//   inscribir@qa.test MFA_SETUP con QR (código correcto: 123456)
//   nueva@qa.test     NEW_PASSWORD_REQUIRED, encadena MFA_SETUP
//   nostaff@qa.test   403
//   mala@qa.test      401 codigo=credenciales; malasincodigo@qa.test 401 sin codigo
//   bloqueado@qa.test 429 codigo=bloqueado (contrato de `_respuesta_de_bloqueo` en panel_config_api_lambda.py)
//   vacio401@qa.test  401 sin cuerpo; textoplano@qa.test 400 text/plain «Bad Request»
// Desafío: 444444 → 401 sin cuerpo; 666666 → 400 text/plain; 777777 → 400 desafio_no_soportado;
//   303030 → 403 no_es_staff. Clave nueva «ClaveVencida1» → 401 codigo_incorrecto.
// Desafío: 123456 correcto; 555555 → 500 error_servidor; 111111 → 401 sin codigo;
// otro → 401 codigo_incorrecto. staff_mfa_verificar: 999999 → 500 error_servidor.
//   caido@qa.test     500 con texto; vacio@qa.test 500 sin cuerpo
//   raro@qa.test      400 codigo=desafio_no_soportado (texto cruzado a propósito)
// Desafío: 222222 → 400 sin codigo; 333333 → 400 faltan_datos.
// Respaldo: usuario «respaldo», clave «clave-respaldo».
// Cada desafío trae `cuenta` (cta-qa-N, una por session). Cualquier paso de
// desafío sin la `cuenta` de su session → 400 faltan_datos, como el backend.
// staff_mfa_iniciar: «clave-activo» → 409 mfa_ya_activo; «clave-pendiente» → 409 mfa_paso_pendiente.
// set_client_user_role sobre u3 → 500 genérico (error de Cognito).
// Contraseña de reautenticación correcta: clave-staff
// `?qa=sesion` deja una sesión abierta; `&mfa=0` simula mfa_inscrito:false.
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const CUENTA_DE: Record<string, string> = {
  'ses-cognito-1': 'cta-qa-1',
  'ses-cognito-2': 'cta-qa-2',
  'ses-cognito-3': 'cta-qa-3',
  'ses-cognito-4': 'cta-qa-4',
};
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRETO = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/RockyBrand:qa%40qa.test?secret=${SECRETO}&issuer=RockyBrand`;
const REAUTH = 'clave-staff';
const CODIGO = '123456';

const token = () => `${Math.floor(Date.now() / 1000) + 3600}.qa`;

const clientes = [
  { client_id: 'cliente-uno', nombre: 'Cliente Uno' },
  { client_id: 'cliente-dos', nombre: 'Cliente Dos' },
];
const usuarios = [
  { username: 'u1', sub: 's1', email: 'admin@cliente-uno.test', client_id: 'cliente-uno', enabled: true, status: 'CONFIRMED', created_at: '2026-10-01T12:00:00Z', rol: 'cliente-admin', mfa_inscrito: true },
  { username: 'u2', sub: 's2', email: 'lectura@cliente-uno.test', client_id: 'cliente-uno', enabled: true, status: 'CONFIRMED', created_at: '2026-10-02T12:00:00Z', rol: 'cliente-lectura', mfa_inscrito: false },
  { username: 'u3', sub: 's3', email: 'antiguo-con-correo-largo@cliente-dos.test', client_id: 'cliente-dos', enabled: true, status: 'FORCE_CHANGE_PASSWORD', created_at: '2026-09-01T12:00:00Z', rol: null, mfa_inscrito: null },
];

function crudo(res: ServerResponse, status: number, tipo: string, cuerpo: string) {
  res.statusCode = status;
  if (tipo) res.setHeader('Content-Type', tipo);
  res.end(cuerpo);
}

function responder(res: ServerResponse, status: number, cuerpo: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(cuerpo));
}

function leer(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((ok) => {
    let datos = '';
    req.on('data', (c) => (datos += c));
    req.on('end', () => {
      try {
        ok(JSON.parse(datos || '{}'));
      } catch {
        ok({});
      }
    });
  });
}

const reauthMala = { error: 'La contraseña no es correcta.', reauth_required: true, codigo: 'credenciales' };
const BLOQUEO = { error: 'Demasiados intentos fallidos. Intenta de nuevo en 5 minuto(s).', codigo: 'bloqueado' };
// Reautenticación (create/set_role/reset_mfa/staff_mfa_*), contrato del backend:
// «pide-clave» simula el 401 reauth_requerida (el panel no deja mandar la
// clave vacía); «clave-bloqueada» → 429 bloqueado; «clave-raro» → 400
// desafio_no_soportado; otra distinta de clave-staff → 403 credenciales.
function reauth(res: ServerResponse, b: Record<string, unknown>): boolean {
  const p = b.reauth_password;
  if (p === REAUTH) return false;
  if (p === 'pide-clave' || !p)
    responder(res, 401, { error: 'Confirma tu contraseña para ejecutar esta acción.', reauth_required: true, codigo: 'reauth_requerida' });
  else if (p === 'clave-bloqueada') responder(res, 429, BLOQUEO);
  else if (p === 'clave-raro') responder(res, 400, { error: 'Error interno.', codigo: 'desafio_no_soportado' });
  else responder(res, 403, reauthMala);
  return true;
}

async function api(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return responder(res, 200, {});
  const b = await leer(req);
  const correo = String(b.username || '');
  switch (b.__action) {
    case 'panel_login':
      if (correo === 'nostaff@qa.test') return responder(res, 403, { error: 'Requiere acceso de staff.', codigo: 'no_es_staff' });
      if (correo === 'nostaffsincodigo@qa.test') return responder(res, 403, { error: 'Requiere acceso de staff.' });
      if (correo === 'mala@qa.test') return responder(res, 401, { error: 'Credenciales invalidas', codigo: 'credenciales' });
      if (correo === 'malasincodigo@qa.test') return responder(res, 401, { error: 'Credenciales invalidas' });
      if (correo === 'bloqueado@qa.test')
        return responder(res, 429, BLOQUEO);
      if (correo === 'vacio401@qa.test') return crudo(res, 401, '', '');
      if (correo === 'textoplano@qa.test') return crudo(res, 400, 'text/plain', 'Bad Request');
      if (correo === 'caido@qa.test')
        return responder(res, 500, { error: 'No se pudo comprobar el acceso. Intenta de nuevo.', codigo: 'error_servidor' });
      if (correo === 'vacio@qa.test') return responder(res, 500, {});
      if (correo === 'raro@qa.test')
        return responder(res, 400, { error: 'Error interno.', codigo: 'desafio_no_soportado' });
      if (correo === 'codigo@qa.test') return responder(res, 200, { challenge: 'SOFTWARE_TOKEN_MFA', session: 'ses-cognito-1', cuenta: CUENTA_DE['ses-cognito-1'] });
      if (correo === 'inscribir@qa.test')
        return responder(res, 200, { challenge: 'MFA_SETUP', session: 'ses-cognito-2', cuenta: CUENTA_DE['ses-cognito-2'], secret_code: SECRETO, otpauth_uri: URI });
      if (correo === 'nueva@qa.test') return responder(res, 200, { challenge: 'NEW_PASSWORD_REQUIRED', session: 'ses-cognito-3', cuenta: CUENTA_DE['ses-cognito-3'] });
      return responder(res, 200, { token: token(), mfa_inscrito: false });
    case 'login':
      if (b.username === 'respaldo' && b.password === 'clave-respaldo') return responder(res, 200, { token: token() });
      // Contrato de handle_login: 401 `credenciales` y 429 `bloqueado`;
      // «respaldo-vacio» prueba el 401 sin cuerpo.
      if (b.username === 'respaldo-vacio') return crudo(res, 401, '', '');
      if (b.username === 'respaldo-bloqueado') return responder(res, 429, BLOQUEO);
      return responder(res, 401, { error: 'Credenciales inválidas', codigo: 'credenciales' });
    case 'panel_login_challenge':
      // Contrato de handle_panel_login_challenge: en los tres desafíos, sin la
      // cuenta firmada de esa session (o alterada) → 400 faltan_datos.
      if (b.cuenta !== CUENTA_DE[String(b.session)])
        return responder(res, 400, { error: 'Faltan datos del inicio de sesión. Vuelve a empezar.', codigo: 'faltan_datos' });
      if (b.challenge === 'NEW_PASSWORD_REQUIRED') {
        const n = String(b.new_password || '');
        if (n === 'ClaveVencida1')
          return responder(res, 401, { error: 'El codigo no es valido o el inicio de sesion expiro.', codigo: 'codigo_incorrecto' });
        if (!(n.length >= 8 && /[A-Z]/.test(n) && /[a-z]/.test(n) && /\d/.test(n)))
          return responder(res, 400, { error: 'La clave nueva no cumple la politica.', codigo: 'clave_nueva_invalida' });
        // Encadena con una `cuenta` nueva: el panel tiene que mandar esa, no la del paso anterior.
        return responder(res, 200, { challenge: 'MFA_SETUP', session: 'ses-cognito-4', cuenta: CUENTA_DE['ses-cognito-4'], secret_code: SECRETO, otpauth_uri: URI });
      }
      if (b.code === '555555')
        return responder(res, 500, { error: 'No se pudo completar el inicio de sesion. Intenta de nuevo.', codigo: 'error_servidor' });
      if (b.code === '111111') return responder(res, 401, { error: 'El codigo no es valido.' });
      if (b.code === '222222') return responder(res, 400, { error: 'Solicitud invalida.' });
      if (b.code === '444444') return crudo(res, 401, '', '');
      if (b.code === '666666') return crudo(res, 400, 'text/plain', 'Bad Request');
      if (b.code === '777777') return responder(res, 400, { error: 'Error interno.', codigo: 'desafio_no_soportado' });
      if (b.code === '888888') return responder(res, 400, { error: 'Formato.', codigo: 'codigo_formato' });
      if (b.code === '242424') return responder(res, 429, BLOQUEO);
      if (b.code === '303030') return responder(res, 403, { error: 'Requiere acceso de staff.', codigo: 'no_es_staff' });
      if (b.code === '333333') return responder(res, 400, { error: 'Faltan datos.', codigo: 'faltan_datos' });
      if (b.code !== CODIGO)
        return responder(res, 401, { error: 'El codigo no es valido o el inicio de sesion expiro.', codigo: 'codigo_incorrecto' });
      return responder(res, 200, { token: token(), mfa_inscrito: true });
    case 'list_panel_users':
      return responder(res, 200, { users: [{ sub: 'st1', email: 'staff@qa.test', enabled: true, status: 'CONFIRMED' }] });
    case 'get_access_log':
      return responder(res, 200, { events: [] });
    case 'list_client_users':
      return responder(res, 200, { users: usuarios, clients: clientes });
    case 'create_client_user':
      if (reauth(res, b)) return;
      return responder(res, 200, { ok: true, email: b.email, client_id: b.client_id, rol: b.rol || 'cliente-admin', password: 'TempQa123456' });
    case 'set_client_user_role': {
      if (reauth(res, b)) return;
      const u = usuarios.find((x) => x.username === b.username);
      if (!u) return responder(res, 404, { error: 'No existe.' });
      if (u.username === 'u3') return responder(res, 500, { error: 'No se pudo cambiar el rol. Intenta de nuevo.' });
      u.rol = String(b.rol);
      return responder(res, 200, { ok: true, email: u.email, client_id: u.client_id, rol: u.rol });
    }
    case 'reset_client_user_mfa': {
      if (reauth(res, b)) return;
      const u = usuarios.find((x) => x.username === b.username);
      if (!u) return responder(res, 404, { error: 'No existe.' });
      u.mfa_inscrito = false;
      return responder(res, 200, { ok: true, email: u.email, client_id: u.client_id, mfa_inscrito: false });
    }
    case 'staff_mfa_iniciar':
      // Textos cruzados a propósito: prueban que manda `codigo`, no el texto.
      if (b.reauth_password === 'clave-activo')
        return responder(res, 409, { error: 'Conflicto.', codigo: 'mfa_ya_activo' });
      if (b.reauth_password === 'clave-pendiente')
        return responder(res, 409, { error: 'Tu usuario ya tiene un paso pendiente.', codigo: 'mfa_paso_pendiente' });
      // Sesión de respaldo: 400 sin_usuario_propio (texto cruzado: manda `codigo`).
      if (b.reauth_password === 'clave-sesion-respaldo')
        return responder(res, 400, { error: 'Solicitud inválida.', codigo: 'sin_usuario_propio' });
      // 4xx/5xx sin `error` ni `codigo`.
      if (b.reauth_password === 'clave-400-vacio') return responder(res, 400, {});
      if (b.reauth_password === 'clave-500-vacio') return responder(res, 500, {});
      if (reauth(res, b)) return;
      return responder(res, 200, { secret_code: SECRETO, otpauth_uri: URI });
    case 'staff_mfa_verificar':
      if (reauth(res, b)) return;
      if (b.code === '000001') return responder(res, 400, { error: 'Formato.', codigo: 'codigo_formato' });
      if (b.code === '999999') return responder(res, 500, { error: 'No se pudo activar el codigo. Intenta de nuevo.', codigo: 'error_servidor' });
      if (b.code !== CODIGO) return responder(res, 400, { error: 'El codigo no es correcto.', codigo: 'codigo_incorrecto' });
      return responder(res, 200, { ok: true, mfa_inscrito: true });
    default:
      return responder(res, 200, {});
  }
}

const mockApi: Plugin = {
  name: 'qa-mock-api',
  configureServer(server) {
    server.middlewares.use('/__mock_api', (req, res) => void api(req, res));
  },
  transformIndexHtml(html) {
    const guion = `<script>(function(){var q=new URLSearchParams(location.search);if(q.get('qa')==='sesion'){localStorage.setItem('rockybrandPanelToken',(Math.floor(Date.now()/1000)+3600)+'.qa');if(q.get('mfa')==='0')sessionStorage.setItem('rockybrandPanelMfa','pendiente');}})();</script>`;
    return html.replace('<head>', `<head>${guion}`);
  },
};

export default defineConfig({
  root: raiz,
  plugins: [react(), mockApi],
  define: { 'import.meta.env.VITE_PANEL_API_URL': JSON.stringify('/__mock_api') },
});
