import { useEffect, useState } from 'react';
import { getClientServices, updateClientServices, updateClientPmsFeatures, UnauthorizedError } from '../api';
import { useAuth } from '../context/AuthContext';
import type { ClientServices, PmsFeatures, Project, ServiceKey } from '../types';

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
  const [pmsFeatures, setPmsFeatures] = useState<PmsFeatures | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<ServiceKey | 'pms_monthly_view' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setServices(null);
    setPmsFeatures(null);
    setError('');
    getClientServices(project.id)
      .then(({ services: s, pmsFeatures: pf }) => {
        if (!cancelled) {
          setServices(s);
          setPmsFeatures(pf);
        }
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

  async function toggleMonthlyView() {
    if (!pmsFeatures || pending) return;
    const next = !pmsFeatures.pms_monthly_view;
    setPending('pms_monthly_view');
    setError('');
    try {
      const updated = await updateClientPmsFeatures(project.id, { pms_monthly_view: next });
      setPmsFeatures(updated);
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setPending(null);
    }
  }

  const pmsEnabled = services ? services.pms : false;
  const monthlyViewSelected = pmsFeatures ? pmsFeatures.pms_monthly_view : false;
  const monthlyViewLoading = !pmsFeatures || pending === 'pms_monthly_view';

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

      {/* Sub-opción de PMS - solo clickeable si PMS está contratado. */}
      <div className="config-chip-row" style={{ marginTop: 8, paddingLeft: 18 }}>
        <button
          type="button"
          className={`config-chip${monthlyViewSelected ? ' selected' : ''}`}
          disabled={monthlyViewLoading || !pmsEnabled}
          title={pmsEnabled ? undefined : 'Activa PMS primero'}
          style={monthlyViewLoading || !pmsEnabled ? { opacity: 0.45, cursor: pmsEnabled ? 'wait' : 'not-allowed' } : undefined}
          onClick={toggleMonthlyView}
        >
          <span className="ico">▤</span> Habitaciones (vista mensual)
        </button>
      </div>
    </div>
  );
}
