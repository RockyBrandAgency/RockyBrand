import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { loginPanel, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // El acceso de respaldo (password compartida) queda para siempre como
  // break-glass - decisión explícita de Mato - pero oculto detrás de un
  // toggle para que el login normal sea Cognito.
  const [useBackup, setUseBackup] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (useBackup) {
        await login(username, password);
      } else {
        await loginPanel(username, password);
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Usuario o contraseña incorrectos.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-overlay">
      <form className="login-box" onSubmit={handleSubmit}>
        <div className="login-title">RockyBrand</div>
        <div className="login-sub">{useBackup ? 'Acceso de respaldo' : 'Acceso administrador'}</div>
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
        <div className="login-error">{error}</div>
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
