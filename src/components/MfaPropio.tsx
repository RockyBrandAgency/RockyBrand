import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, ReauthRequiredError, UnauthorizedError, staffMfaIniciar, staffMfaVerificar, MENSAJE_COMUN_POR_CODIGO, MSG_SERVIDOR_POR_DEFECTO } from '../api';
import { useAuth } from '../context/AuthContext';
import { CampoCodigo, ClaveConCopia, CodigoQr, IconoEscudoAlerta, IconoEscudoCheck } from './CodigoVerificacion';

// `codigo` del backend en los 409 de staff_mfa_iniciar/verificar
// (confirmado por backend el 20-oct). Si no viene o es otro, se distingue
// por el texto como respaldo.
const CODIGO_409_YA_ACTIVO = 'mfa_ya_activo';
const CODIGO_409_PASO_PENDIENTE = 'mfa_paso_pendiente';

function esMfaYaActivo(e: ApiError): boolean {
  if (e.codigo && e.codigo === CODIGO_409_YA_ACTIVO) return true;
  if (e.codigo && e.codigo === CODIGO_409_PASO_PENDIENTE) return false;
  return /ya tiene/i.test(e.message);
}

const MSG_SIN_USUARIO_PROPIO =
  'El acceso de respaldo no tiene usuario propio. Entra con tu cuenta de staff para activar el código.';

type Fase = { tipo: 'inicio' } | { tipo: 'qr'; secreto: string; uri: string } | { tipo: 'listo' };

/**
 * Inscripción voluntaria del código de verificación del staff que ya entró.
 * Las dos llamadas piden la contraseña otra vez (el backend reautentica con
 * Cognito en el servidor); la contraseña vive solo en el estado de este
 * bloque mientras dura la inscripción y se borra al terminar o cancelar.
 */
export default function MfaPropio({ enfocar }: { enfocar?: boolean }) {
  const { estadoMfa, sesionRespaldo, marcarMfaActivo, handleUnauthorized } = useAuth();
  const [fase, setFase] = useState<Fase>({ tipo: 'inicio' });
  const [clave, setClave] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const claveRef = useRef<HTMLInputElement>(null);
  const seccionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enfocar) return;
    seccionRef.current?.scrollIntoView({ block: 'start' });
    claveRef.current?.focus({ preventScroll: true });
  }, [enfocar]);

  function cancelar() {
    setFase({ tipo: 'inicio' });
    setClave('');
    setCodigo('');
    setError('');
  }

  function manejarError(e: unknown, enVerificar: boolean) {
    if (e instanceof UnauthorizedError) {
      handleUnauthorized();
      return;
    }
    if (e instanceof ReauthRequiredError) {
      // 401 `reauth_requerida`: faltó la clave, no está mala. 403 `credenciales`: mala.
      setError(e.codigo === 'reauth_requerida' ? 'Escribe tu contraseña para continuar.' : 'La contraseña no es correcta.');
      if (enVerificar) setFase({ tipo: 'inicio' });
      return;
    }
    if (e instanceof ApiError) {
      if (e.status === 409) {
        if (esMfaYaActivo(e)) {
          marcarMfaActivo();
          setClave('');
          setFase({ tipo: 'listo' });
          return;
        }
        setError('Tu usuario tiene un paso pendiente al iniciar sesión. Cierra sesión y vuelve a entrar.');
        return;
      }
      // staff_mfa_verificar responde 400 (no 401) al código malo.
      if (e.codigo === 'codigo_incorrecto') {
        setError('El código no es correcto. Revisa que la hora del teléfono esté al día y escribe el código que se ve ahora.');
        setCodigo('');
        return;
      }
      if (e.codigo === 'codigo_formato') {
        setError('El código tiene 6 dígitos.');
        return;
      }
      if (e.codigo === 'sin_usuario_propio') {
        setError(MSG_SIN_USUARIO_PROPIO);
        return;
      }
      if (e.codigo && MENSAJE_COMUN_POR_CODIGO[e.codigo]) {
        setError(MENSAJE_COMUN_POR_CODIGO[e.codigo]);
        return;
      }
      // Un 4xx sin texto del backend no es un problema del servidor.
      if (e.status < 500 && (!e.message || e.message === MSG_SERVIDOR_POR_DEFECTO)) {
        setError('No se pudo completar. Intenta de nuevo.');
        return;
      }
      // Sin `codigo` o `error_servidor`: el texto del servidor (callAction pone
      // el de servidor si no vino).
      setError(e.message || MSG_SERVIDOR_POR_DEFECTO);
      return;
    }
    setError('No se pudo completar. Intenta de nuevo.');
  }

  async function iniciar(e: FormEvent) {
    e.preventDefault();
    if (!clave) {
      setError('Escribe tu contraseña para continuar.');
      return;
    }
    setError('');
    setOcupado(true);
    try {
      const r = await staffMfaIniciar(clave);
      setCodigo('');
      setFase({ tipo: 'qr', secreto: r.secret_code, uri: r.otpauth_uri });
    } catch (err) {
      manejarError(err, false);
    } finally {
      setOcupado(false);
    }
  }

  async function verificar(e: FormEvent) {
    e.preventDefault();
    if (codigo.length !== 6) {
      setError('El código tiene 6 dígitos.');
      return;
    }
    setError('');
    setOcupado(true);
    try {
      await staffMfaVerificar(clave, codigo);
      marcarMfaActivo();
      setClave('');
      setCodigo('');
      setFase({ tipo: 'listo' });
    } catch (err) {
      manejarError(err, true);
    } finally {
      setOcupado(false);
    }
  }

  const activo = estadoMfa === 'activo' || fase.tipo === 'listo';

  return (
    <section ref={seccionRef} id="mfa" aria-labelledby="mfa-titulo" style={{ scrollMarginTop: 24 }}>
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2 className="section-title" id="mfa-titulo" style={{ margin: 0 }}>
          Tu código de verificación
        </h2>
      </div>
      <div className="card form-section" style={{ maxWidth: 480, marginTop: 16 }}>
        <div className="mfa-estado">
          {activo ? (
            <IconoEscudoCheck style={{ color: 'var(--sage)' }} />
          ) : (
            <IconoEscudoAlerta style={{ color: 'var(--ochre)' }} />
          )}
          <div>
            <span className={`pill ${activo ? 'subscribed' : estadoMfa === 'pendiente' ? 'scheduled' : 'draft'}`}>
              <span className="pill-dot" />
              {activo ? 'Activo' : estadoMfa === 'pendiente' ? 'Sin activar' : 'Sin dato'}
            </span>
            <div className="mfa-estado-titulo">
              {activo ? 'Tu cuenta pide el código al entrar' : 'Pide un código del teléfono al entrar'}
            </div>
            <div className="mfa-estado-detalle">
              {activo
                ? 'Si cambias de teléfono, pide al administrador de la plataforma que restablezca tu código desde la consola de AWS (Cognito).'
                : 'Con el código, una contraseña filtrada no alcanza para entrar al panel.'}
            </div>
          </div>
        </div>

        {!activo && sesionRespaldo && (
          <p className="mfa-estado-detalle" id="mfa-respaldo" style={{ marginTop: 14 }}>
            {MSG_SIN_USUARIO_PROPIO}
          </p>
        )}

        {!activo && !sesionRespaldo && fase.tipo === 'inicio' && (
          <form onSubmit={iniciar} noValidate>
            <div className="crm-field">
              <label htmlFor="mfa-clave">Tu contraseña</label>
              <input
                ref={claveRef}
                id="mfa-clave"
                type="password"
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
              <div className="field-hint">La misma con la que entraste. Se pide de nuevo para confirmar que eres tú.</div>
            </div>
            <div className="send-actions mfa-acciones">
              <button type="submit" className="btn btn-primary btn-sm" disabled={ocupado}>
                {ocupado ? 'Preparando…' : 'Activar código de verificación'}
              </button>
            </div>
          </form>
        )}

        {!activo && fase.tipo === 'qr' && (
          <form onSubmit={verificar} noValidate>
            <p className="mfa-estado-detalle" style={{ marginBottom: 14 }}>
              Escanea el QR con tu app de autenticación y escribe el código de 6 dígitos que aparece.
            </p>
            <div className="mfa-qr-marco" style={{ justifyContent: 'flex-start' }}>
              <CodigoQr valor={fase.uri} etiqueta="Código QR para tu app de autenticación" />
            </div>
            <div className="crm-field">
              <div className="login-label">¿No puedes escanear? Escribe esta clave en la app</div>
              <ClaveConCopia clave={fase.secreto} />
            </div>
            <div className="crm-field">
              <label htmlFor="mfa-codigo">Código de 6 dígitos</label>
              <CampoCodigo id="mfa-codigo" valor={codigo} onChange={setCodigo} autoFocus invalido={!!error} />
            </div>
            <div className="send-actions mfa-acciones">
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelar} disabled={ocupado}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={ocupado}>
                {ocupado ? 'Verificando…' : 'Verificar y activar'}
              </button>
            </div>
          </form>
        )}

        <div className="manual-invoke-msg msg-error" role="alert">
          {error}
        </div>
      </div>
    </section>
  );
}
