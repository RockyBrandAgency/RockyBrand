import { useState, type FormEvent } from 'react';
import { useAuth, type DesafioPendiente } from '../context/AuthContext';
import { ApiError, MENSAJE_COMUN_POR_CODIGO } from '../api';
import { CampoCodigo, ClaveConCopia, CodigoQr, IconoVolver } from '../components/CodigoVerificacion';

// La sesión que entrega Cognito para responder un desafío vence a los 3
// minutos. Pasado ese plazo no tiene sentido mandar el código: hay que
// empezar de nuevo, y se le dice así a la persona en vez de un «código
// incorrecto» que la haría reintentar en vano.
const VIGENCIA_DESAFIO_MS = 3 * 60 * 1000;

type Paso = DesafioPendiente & { inicio: number };

const TITULO_PASO: Record<DesafioPendiente['desafio'], string> = {
  SOFTWARE_TOKEN_MFA: 'Código de verificación',
  MFA_SETUP: 'Activa el código de verificación',
  NEW_PASSWORD_REQUIRED: 'Crea tu contraseña',
};

const MSG_NO_STAFF = 'Tu usuario no tiene acceso al panel de RockyBrand.';
const MSG_VENCIDO = 'Pasaron más de 3 minutos y el inicio de sesión venció. Empieza de nuevo.';
// `codigo_incorrecto` en la pantalla de clave nueva: no hay código que corregir.
const MSG_SESION_NO_VALIDA = 'El inicio de sesión ya no es válido. Empieza de nuevo.';
const MSG_CREDENCIALES = 'Email o contraseña incorrectos.';
const MSG_CREDENCIALES_RESPALDO = 'Usuario o contraseña incorrectos.';
const MSG_SERVIDOR = 'Hubo un problema en el servidor. Intenta de nuevo en un momento.';

const MSG_CODIGO_INCORRECTO =
  'El código no es correcto o el inicio de sesión ya no es válido. Intenta de nuevo; si sigue fallando, vuelve al inicio.';
const MSG_CLAVE_NUEVA_INVALIDA =
  'La contraseña nueva no cumple la política: 8 o más caracteres, con mayúscula, minúscula y número.';
const MSG_FALTAN_DATOS = 'Faltan datos del inicio de sesión. Vuelve a empezar.';
const MSG_CODIGO_FORMATO = 'El código tiene 6 dígitos.';

// Mensajes por `codigo` del backend (contrato del 20-oct). Solo el `codigo`
// decide el texto. Un 400, 401 o 403 sin `codigo` (backend viejo o contrato
// roto) no prueba la causa: muestra el texto del servidor, nunca «Email o
// contraseña incorrectos». `error_servidor` no está a propósito: muestra el
// texto del servidor. El 429 trae `codigo: "bloqueado"`.
const MENSAJE_POR_CODIGO: Record<string, string> = {
  ...MENSAJE_COMUN_POR_CODIGO,
  credenciales: MSG_CREDENCIALES,
  codigo_incorrecto: MSG_CODIGO_INCORRECTO,
  clave_nueva_invalida: MSG_CLAVE_NUEVA_INVALIDA,
  faltan_datos: MSG_FALTAN_DATOS,
  no_es_staff: MSG_NO_STAFF,
  codigo_formato: MSG_CODIGO_FORMATO,
};

/**
 * Qué decirle a la persona ante un error del login. `respaldo`: el formulario
 * de respaldo pide usuario, no email, así que `credenciales` lo dice así.
 */
function mensajeDeError(err: unknown, respaldo = false): string {
  if (err instanceof TypeError) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  if (err instanceof ApiError) {
    if (respaldo && err.codigo === 'credenciales') return MSG_CREDENCIALES_RESPALDO;
    if (err.codigo && MENSAJE_POR_CODIGO[err.codigo]) return MENSAJE_POR_CODIGO[err.codigo];
  }
  // Sin `codigo` conocido (respaldo, 5xx, contrato roto): el texto del backend.
  // Ni el 401 ni el 403 sin `codigo` se traducen: no prueban la causa.
  return err instanceof Error && err.message ? err.message : MSG_SERVIDOR;
}

export default function Login() {
  const { loginPanel, responderDesafio, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // El acceso de respaldo (password compartida) queda para siempre como
  // break-glass - decisión explícita de Mato - pero oculto detrás de un
  // toggle para que el login normal sea Cognito.
  const [useBackup, setUseBackup] = useState(false);

  const [paso, setPaso] = useState<Paso | null>(null);
  const [vencido, setVencido] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nuevaClave, setNuevaClave] = useState('');
  const [repetirClave, setRepetirClave] = useState('');

  function irAPaso(desafio: DesafioPendiente | null) {
    setCodigo('');
    setNuevaClave('');
    setRepetirClave('');
    setVencido(false);
    setPaso(desafio ? { ...desafio, inicio: Date.now() } : null);
  }

  function volverAlInicio() {
    irAPaso(null);
    setPassword('');
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (useBackup) {
        await login(username, password);
      } else {
        const desafio = await loginPanel(username.trim(), password);
        if (desafio) {
          setPassword('');
          irAPaso(desafio);
        }
      }
    } catch (err) {
      setError(mensajeDeError(err, useBackup));
    } finally {
      setBusy(false);
    }
  }

  async function responder(e: FormEvent) {
    e.preventDefault();
    if (!paso) return;
    setError('');
    if (Date.now() - paso.inicio > VIGENCIA_DESAFIO_MS) {
      setVencido(true);
      setError(MSG_VENCIDO);
      return;
    }
    let respuesta: { code: string } | { new_password: string };
    if (paso.desafio === 'NEW_PASSWORD_REQUIRED') {
      if (nuevaClave.length < 8) {
        setError('La contraseña nueva necesita 8 o más caracteres, con mayúscula, minúscula y número.');
        return;
      }
      if (nuevaClave !== repetirClave) {
        setError('Las dos contraseñas no coinciden.');
        return;
      }
      respuesta = { new_password: nuevaClave };
    } else {
      if (codigo.length !== 6) {
        setError(MSG_CODIGO_FORMATO);
        return;
      }
      respuesta = { code: codigo };
    }
    setBusy(true);
    try {
      const siguiente = await responderDesafio(username.trim(), paso.desafio, paso.session, respuesta, paso.cuenta);
      // Sin desafío siguiente, la sesión ya quedó abierta y esta pantalla se desmonta.
      // Un desafío encadenado trae su propia `cuenta`; si no la trae, sigue la anterior.
      if (siguiente) irAPaso({ ...siguiente, cuenta: siguiente.cuenta ?? paso.cuenta });
    } catch (err) {
      const codigoError = err instanceof ApiError ? err.codigo : undefined;
      if (codigoError === 'codigo_incorrecto' && paso.desafio === 'NEW_PASSWORD_REQUIRED') {
        // Esa pantalla no tiene código: solo puede ser la sesión de Cognito.
        setVencido(true);
        setError(MSG_SESION_NO_VALIDA);
      } else if (codigoError === 'codigo_incorrecto') {
        // `codigo_incorrecto` cubre también la sesión vencida: solo se dice
        // «venció» si de verdad pasaron los 3 minutos.
        if (Date.now() - paso.inicio > VIGENCIA_DESAFIO_MS) {
          setVencido(true);
          setError(MSG_VENCIDO);
        } else {
          setCodigo('');
          setError(MSG_CODIGO_INCORRECTO);
        }
      } else if (
        codigoError === 'faltan_datos' ||
        codigoError === 'desafio_no_soportado' ||
        codigoError === 'no_es_staff'
      ) {
        // El desafío ya no se puede responder: solo queda empezar de nuevo.
        // En `no_es_staff` Cognito ya consumió la sesión del segundo paso.
        setVencido(true);
        setError(mensajeDeError(err));
      } else {
        // `clave_nueva_invalida`, `codigo_formato` (el paso sigue activo),
        // `bloqueado`, 5xx o un 400/401 sin `codigo`.
        setError(mensajeDeError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const botonVolver = (
    <button type="button" className="login-backup-toggle" onClick={volverAlInicio}>
      <IconoVolver /> Volver al inicio
    </button>
  );

  if (paso) {
    return (
      <div className="login-overlay">
        <form className="login-box" onSubmit={responder} noValidate>
          <div className="login-title">RockyBrand</div>
          <h1 className="login-sub login-paso">{TITULO_PASO[paso.desafio]}</h1>

          {vencido ? (
            <button type="button" className="login-btn" onClick={volverAlInicio}>
              Empezar de nuevo
            </button>
          ) : paso.desafio === 'NEW_PASSWORD_REQUIRED' ? (
            <>
              <p className="login-detalle">
                Es tu primer ingreso: reemplaza la contraseña temporal por una tuya. Usa 8 o más caracteres,
                con mayúscula, minúscula y número.
              </p>
              <input type="email" autoComplete="username" value={username} readOnly hidden />
              <div className="login-field">
                <label className="login-label" htmlFor="login-nueva">Contraseña nueva</label>
                <input
                  className="login-input"
                  id="login-nueva"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="login-repetir">Repite la contraseña nueva</label>
                <input
                  className="login-input"
                  id="login-repetir"
                  type="password"
                  autoComplete="new-password"
                  value={repetirClave}
                  onChange={(e) => setRepetirClave(e.target.value)}
                />
              </div>
              <button className="login-btn" type="submit" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar y entrar'}
              </button>
            </>
          ) : (
            <>
              {paso.desafio === 'MFA_SETUP' ? (
                <>
                  <p className="login-detalle">
                    Tu cuenta pide un código de verificación. Escanea el QR con tu app de autenticación
                    (Google Authenticator, 1Password u otra) y escribe el código de 6 dígitos que aparece.
                  </p>
                  {paso.otpauthUri && (
                    <div className="mfa-qr-marco">
                      <CodigoQr valor={paso.otpauthUri} etiqueta="Código QR para tu app de autenticación" />
                    </div>
                  )}
                  {paso.secretCode && (
                    <div className="login-field">
                      <div className="login-label">¿No puedes escanear? Escribe esta clave en la app</div>
                      <ClaveConCopia clave={paso.secretCode} />
                    </div>
                  )}
                </>
              ) : (
                <p className="login-detalle">Abre tu app de autenticación y escribe el código de 6 dígitos.</p>
              )}
              <div className="login-field">
                <label className="login-label" htmlFor="login-codigo">Código de 6 dígitos</label>
                <CampoCodigo
                  id="login-codigo"
                  valor={codigo}
                  onChange={setCodigo}
                  autoFocus={paso.desafio === 'SOFTWARE_TOKEN_MFA'}
                  invalido={!!error}
                />
              </div>
              <button className="login-btn" type="submit" disabled={busy}>
                {busy ? 'Verificando…' : paso.desafio === 'MFA_SETUP' ? 'Activar y entrar' : 'Verificar'}
              </button>
            </>
          )}

          <div className="login-error" role="alert">{error}</div>
          {botonVolver}
        </form>
      </div>
    );
  }

  return (
    <div className="login-overlay">
      <form className="login-box" onSubmit={handleSubmit}>
        <div className="login-title">RockyBrand</div>
        <h1 className="login-sub login-paso">{useBackup ? 'Acceso de respaldo' : 'Acceso administrador'}</h1>
        <div className="login-field">
          <label className="login-label" htmlFor="login-username">
            {useBackup ? 'Usuario' : 'Email'}
          </label>
          <input
            className="login-input"
            id="login-username"
            autoComplete="username"
            type={useBackup ? 'text' : 'email'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="login-field">
          <label className="login-label" htmlFor="login-password">Contraseña</label>
          <input
            className="login-input"
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="login-btn" type="submit" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
        <div className="login-error" role="alert">{error}</div>
        <button
          type="button"
          className="login-backup-toggle"
          onClick={() => {
            setUseBackup((v) => !v);
            setError('');
          }}
        >
          {useBackup ? '← Volver al acceso normal' : '¿Problemas para entrar? Usar acceso de respaldo'}
        </button>
      </form>
    </div>
  );
}
