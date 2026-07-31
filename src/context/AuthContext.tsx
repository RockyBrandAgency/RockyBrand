import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getStoredToken, setStoredToken, clearStoredToken, login as apiLogin, panelLogin as apiPanelLogin } from '../api';

interface AuthContextValue {
  isAuthenticated: boolean;
  /** Login real, multi-usuario (Cognito) - el que usa la pantalla por default. */
  loginPanel: (username: string, password: string) => Promise<void>;
  /** Password compartida - respaldo permanente, nunca se retira (decisión de Mato). */
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  handleUnauthorized: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredToken());

  const loginPanel = useCallback(async (username: string, password: string) => {
    const token = await apiPanelLogin(username, password);
    setStoredToken(token);
    setIsAuthenticated(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const token = await apiLogin(username, password);
    setStoredToken(token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setIsAuthenticated(false);
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearStoredToken();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loginPanel, login, logout, handleUnauthorized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
