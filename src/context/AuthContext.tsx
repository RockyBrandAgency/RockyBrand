import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  login as apiLogin,
  panelLogin as apiPanelLogin,
  panelLoginChallenge as apiPanelLoginChallenge,
  type DesafioLogin,
  type ResultadoLogin,
} from '../api';

// Lo que dijo el login sobre el código de verificación del staff. Vive en
// sessionStorage (no localStorage): es un dato de esta sesión, y el próximo
// login lo vuelve a informar.
const MFA_STORAGE_KEY = 'rockybrandPanelMfa';
const AVISO_MFA_DESCARTADO_KEY = 'rockybrandPanelAvisoMfaDescartado';
// La sesión se abrió con el acceso de respaldo (password compartida). Va en
// localStorage, igual que el token, para que dure lo mismo que la sesión.
const RESPALDO_KEY = 'rockybrandPanelRespaldo';

export type EstadoMfa = 'activo' | 'pendiente' | 'desconocido';

function leerEstadoMfa(): EstadoMfa {
  const v = sessionStorage.getItem(MFA_STORAGE_KEY);
  return v === 'activo' || v === 'pendiente' ? v : 'desconocido';
}

/** Un desafío pendiente todavía no es una sesión: la pantalla de login lo responde. */
export type DesafioPendiente = Extract<ResultadoLogin, { tipo: 'desafio' }>;

type RespuestaDesafio = { code: string } | { new_password: string };

interface AuthContextValue {
  isAuthenticated: boolean;
  /**
   * Login real, multi-usuario (Cognito) - el que usa la pantalla por default.
   * Devuelve el desafío si Cognito pide un paso más; si no, deja la sesión abierta.
   */
  loginPanel: (username: string, password: string) => Promise<DesafioPendiente | null>;
  /** Responde un desafío; puede devolver otro encadenado. */
  responderDesafio: (
    username: string,
    desafio: DesafioLogin,
    session: string,
    respuesta: RespuestaDesafio,
    cuenta?: string
  ) => Promise<DesafioPendiente | null>;
  /** Password compartida - respaldo permanente, nunca se retira (decisión de Mato). */
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  handleUnauthorized: () => void;
  estadoMfa: EstadoMfa;
  /** La sesión es del acceso de respaldo: no hay usuario propio al que activarle el código. */
  sesionRespaldo: boolean;
  marcarMfaActivo: () => void;
  /** El login dijo `mfa_inscrito: false` y la persona no cerró el aviso. */
  avisoMfaVisible: boolean;
  descartarAvisoMfa: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredToken());
  const [estadoMfa, setEstadoMfa] = useState<EstadoMfa>(leerEstadoMfa);
  const [sesionRespaldo, setSesionRespaldo] = useState(() => localStorage.getItem(RESPALDO_KEY) === '1');
  const [avisoDescartado, setAvisoDescartado] = useState(
    () => sessionStorage.getItem(AVISO_MFA_DESCARTADO_KEY) === '1'
  );

  const guardarEstadoMfa = useCallback((estado: EstadoMfa) => {
    if (estado === 'desconocido') sessionStorage.removeItem(MFA_STORAGE_KEY);
    else sessionStorage.setItem(MFA_STORAGE_KEY, estado);
    setEstadoMfa(estado);
  }, []);

  const abrirSesion = useCallback(
    (resultado: ResultadoLogin): DesafioPendiente | null => {
      if (resultado.tipo === 'desafio') return resultado;
      setStoredToken(resultado.token);
      localStorage.removeItem(RESPALDO_KEY);
      setSesionRespaldo(false);
      guardarEstadoMfa(
        resultado.mfaInscrito === true ? 'activo' : resultado.mfaInscrito === false ? 'pendiente' : 'desconocido'
      );
      sessionStorage.removeItem(AVISO_MFA_DESCARTADO_KEY);
      setAvisoDescartado(false);
      setIsAuthenticated(true);
      return null;
    },
    [guardarEstadoMfa]
  );

  const loginPanel = useCallback(
    async (username: string, password: string) => abrirSesion(await apiPanelLogin(username, password)),
    [abrirSesion]
  );

  const responderDesafio = useCallback(
    async (username: string, desafio: DesafioLogin, session: string, respuesta: RespuestaDesafio, cuenta?: string) =>
      abrirSesion(await apiPanelLoginChallenge(username, desafio, session, respuesta, cuenta)),
    [abrirSesion]
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const token = await apiLogin(username, password);
      setStoredToken(token);
      // El respaldo no tiene usuario propio ni código de verificación.
      guardarEstadoMfa('desconocido');
      localStorage.setItem(RESPALDO_KEY, '1');
      setSesionRespaldo(true);
      setIsAuthenticated(true);
    },
    [guardarEstadoMfa]
  );

  const cerrar = useCallback(() => {
    clearStoredToken();
    sessionStorage.removeItem(MFA_STORAGE_KEY);
    sessionStorage.removeItem(AVISO_MFA_DESCARTADO_KEY);
    localStorage.removeItem(RESPALDO_KEY);
    setSesionRespaldo(false);
    setEstadoMfa('desconocido');
    setIsAuthenticated(false);
  }, []);

  const marcarMfaActivo = useCallback(() => guardarEstadoMfa('activo'), [guardarEstadoMfa]);

  const descartarAvisoMfa = useCallback(() => {
    sessionStorage.setItem(AVISO_MFA_DESCARTADO_KEY, '1');
    setAvisoDescartado(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loginPanel,
        responderDesafio,
        login,
        logout: cerrar,
        handleUnauthorized: cerrar,
        estadoMfa,
        sesionRespaldo,
        marcarMfaActivo,
        avisoMfaVisible: isAuthenticated && estadoMfa === 'pendiente' && !avisoDescartado,
        descartarAvisoMfa,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
