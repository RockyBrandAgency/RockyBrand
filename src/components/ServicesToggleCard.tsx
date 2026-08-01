import { useEffect, useState } from 'react';
import { getClientServices, updateClientServices, UnauthorizedError } from '../api';
import { useAuth } from '../context/AuthContext';
import type { ClientServices, Project, ServiceKey } from '../types';

const SERVICE_META: Record<ServiceKey, { label: string; icon: string }> = {
  agents: { label: 'Agentes de IA', icon: '◈' },
  pms: { label: 'PMS', icon: '⌂' },
  crm: { label: 'CRM', icon: '☎' },
  email_marketing: { label: 'Email Marketing', icon: '✉' },
};

const SERVICE_KEYS: ServiceKey[] = ['agents', 'pms', 'crm', 'email_marketing'];

// Servicios CONTRATADOS de verdad (rockybrand-client-config.services) -
// distinto de AgentToolToggleCard, que solo controla qué se ve en el panel.
// Togglear acá decide si el cliente tiene el servicio, no si un chip
// aparece marcado.
export default function ServicesToggleCard({ project }: { project: Project }) {
  const { handleUnauthorized } = useAuth();
  const [services, setServices] = useState<ClientServices | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<ServiceKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setServices(null);
    setError('');
    getClientServices(project.id)
      .then((s) => {
        if (!cancelled) setServices(s);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError('No se pudo cargar.');
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, handleUnauthorized]);

  async function toggle(key: ServiceKey) {
    if (!services || pending) return;
    const next = !services[key];
    setPending(key);
    setError('');
    try {
      const updated = await updateClientServices(project.id, { [key]: next });
      setServices(updated);
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="desc-label" style={{ marginTop: 18 }}>
        Servicios contratados
      </div>
      {error && <div className="footnote" style={{ color: 'var(--danger, #c04444)' }}>{error}</div>}
      <div className="config-chip-row">
        {SERVICE_KEYS.map((key) => {
          const meta = SERVICE_META[key];
          const selected = services ? services[key] : false;
          const loading = !services || pending === key;
          return (
            <button
              key={key}
              type="button"
              className={`config-chip${selected ? ' selected' : ''}`}
              disabled={loading}
              style={loading ? { opacity: 0.55, cursor: 'wait' } : undefined}
              onClick={() => toggle(key)}
            >
              <span className="ico">{meta.icon}</span> {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
