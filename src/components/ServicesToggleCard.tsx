import { useEffect, useState } from 'react';
import { getClientServices, updateClientServices, updateClientFeatures, UnauthorizedError } from '../api';
import { useAuth } from '../context/AuthContext';
import type {
  ClientFeatures, ClientServices, FeatureKey, PmsFeatureKey, Project, ServiceKey,
} from '../types';

const SERVICE_META: Record<ServiceKey, { label: string; icon: string }> = {
  agents: { label: 'Agentes de IA', icon: '◈' },
  pms: { label: 'PMS', icon: '⌂' },
  crm: { label: 'CRM', icon: '☎' },
  email_marketing: { label: 'Email Marketing', icon: '✉' },
  store: { label: 'Tienda', icon: '▤' },
  whatsapp: { label: 'WhatsApp (asistente y avisos)', icon: '✆' },
  content_approval: { label: 'Aprobación de contenido', icon: '✓' },
  agencias: { label: 'Agencias (portal B2B)', icon: '⇄' },
};

// Los dos últimos existían en client-config y los leía el backend
// (whatsapp_config para el asistente, crm_dashboard_api para aprobaciones),
// pero no estaban en esta lista. Como el backend armaba el bloque `services`
// con las claves que salían de acá, mover cualquier toggle las borraba en
// silencio y dejaba al cliente sin asistente de WhatsApp (2026-08-11).
//
// `agencias` se sumó el 2026-08-19 por el mismo motivo un nivel más arriba:
// el servicio existía en el backend y en el sidebar del cliente, pero el
// panel no tenía cómo prenderlo.
const SERVICE_KEYS: ServiceKey[] = [
  'agents', 'pms', 'crm', 'email_marketing', 'store', 'whatsapp', 'content_approval', 'agencias',
];

// Sub-opciones DENTRO de un servicio: qué pantallas ve el cliente del
// servicio que ya tiene contratado. Cada grupo declara de qué ServiceKey
// depende, y ninguna de sus banderas es clickeable si ese servicio está
// apagado - prender "Housekeeping" de un cliente sin PMS no significa nada.
//
// Las claves y sus defaults viven en 04-codigo/client_features.py; acá vive
// solo el texto que se lee en pantalla. `nota` explica una dependencia que
// el switch por sí solo no cuenta.
interface FeatureItem {
  key: FeatureKey;
  label: string;
  desc: string;
  nota?: string;
}

interface FeatureGroup {
  service: ServiceKey;
  title: string;
  sub: string;
  items: FeatureItem[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    service: 'pms',
    title: 'PMS — pantallas del cliente',
    sub: 'Cada switch es una entrada del menú PMS en el panel del cliente.',
    items: [
      { key: 'pms_resumen', label: 'Resumen', desc: 'Ocupación, llegadas y salidas del día.' },
      { key: 'pms_reservas', label: 'Calendario de Reservas', desc: 'La grilla de reservas y el alta de una nueva.' },
      { key: 'pms_huespedes', label: 'Huéspedes', desc: 'Ficha de cada huésped o pescador. El nombre en pantalla lo pone la terminología del cliente.' },
      { key: 'pms_itinerarios', label: 'Itinerarios', desc: 'Plan y bitácora de cada día de una expedición.' },
      {
        key: 'pms_housekeeping', label: 'Housekeeping', desc: 'Estado de aseo por habitación.',
        nota: 'Además necesita "Trabaja con habitaciones": un cliente sin habitaciones no la ve aunque esto esté encendido.',
      },
      {
        key: 'pms_room_views', label: 'Trabaja con habitaciones', desc: 'Apagado, el PMS deja de hablar de habitaciones y queda centrado en personas (Chile Fly Fishing vende programas guiados, no alojamiento).',
      },
      { key: 'pms_monthly_view', label: 'Vista mensual por semana', desc: 'Vista alternativa del calendario. Nació apagada: es opt-in.' },
    ],
  },
  {
    service: 'email_marketing',
    title: 'Email Marketing — pestañas del cliente',
    sub: 'Cada switch es una pestaña de la plataforma de email que ve el cliente.',
    items: [
      { key: 'email_resumen', label: 'Resumen', desc: 'Estado general del canal de email.' },
      { key: 'email_pendientes', label: 'Pendientes', desc: 'Campañas esperando aprobación o envío.' },
      { key: 'email_campanas', label: 'Campañas', desc: 'Listado histórico y detalle de cada envío.' },
      { key: 'email_nueva_campana', label: 'Nueva campaña', desc: 'Que el cliente pueda crear y enviar campañas él mismo.' },
      { key: 'email_audiencias', label: 'Audiencias', desc: 'Listas de contactos e importación por CSV.' },
      { key: 'email_templates', label: 'Templates', desc: 'Plantillas de correo reutilizables.' },
      { key: 'email_metricas', label: 'Métricas', desc: 'Aperturas, clics y rebotes.' },
      { key: 'email_automatizaciones', label: 'Automatizaciones', desc: 'Secuencias que se disparan solas.' },
    ],
  },
];

// Switch de Material Design 3 (Common switches). Las medidas son las de la
// spec: pista 52x32, radio full; el pulgar mide 16px apagado y 24px
// encendido - ese salto ES el gesto, no un detalle. El color viene de
// --accent (el único eje que puede cambiar entre clientes).
function M3Switch({ on, disabled, onClick, label }: {
  on: boolean; disabled: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`m3-switch${on ? ' on' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="m3-switch-thumb" />
    </button>
  );
}

// Servicios CONTRATADOS de verdad (rockybrand-client-config.services) -
// distinto de AgentToolToggleCard, que solo controla qué se ve en el panel.
// Togglear acá decide si el cliente tiene el servicio, no si un chip
// aparece marcado.
export default function ServicesToggleCard({ project }: { project: Project }) {
  const { handleUnauthorized } = useAuth();
  const [services, setServices] = useState<ClientServices | null>(null);
  const [features, setFeatures] = useState<ClientFeatures | null>(null);
  // Distingue "la Lambda no manda `features`" (backend viejo) de "el
  // cliente las tiene todas apagadas". Sin esta distinción la pantalla
  // pintaría switches que al tocarlos devuelven 400.
  const [featuresSoportadas, setFeaturesSoportadas] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<ServiceKey | FeatureKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setServices(null);
    setFeatures(null);
    setError('');
    getClientServices(project.id)
      .then(({ services: s, features: f }) => {
        if (cancelled) return;
        setServices(s);
        setFeatures(f);
        setFeaturesSoportadas(f !== null);
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

  async function toggleFeature(key: FeatureKey) {
    if (!features || pending) return;
    const next = !features[key];
    setPending(key);
    setError('');
    try {
      const updated = await updateClientFeatures(project.id, { [key]: next });
      setFeatures(updated);
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
      {error && <div className="footnote" style={{ color: 'var(--err)' }}>{error}</div>}
      <div className="config-chip-row">
        {SERVICE_KEYS.map((key) => {
          const meta = SERVICE_META[key];
          const selected = services ? services[key] : false;
          const loading = !services || pending === key;
          return (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={selected}
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

      {!featuresSoportadas && (
        <div className="feature-group-nota" style={{ marginTop: 18 }}>
          El backend desplegado todavía no expone las funcionalidades por
          cliente (falta desplegar <code>panel-config-api</code>). Los switches
          quedan ocultos a propósito: mostrarlos sin poder guardarlos sería
          peor que no mostrarlos.
        </div>
      )}

      {featuresSoportadas && FEATURE_GROUPS.map((group) => {
        const servicioActivo = services ? services[group.service] : false;
        // Housekeeping tiene una segunda condición real en el panel del
        // cliente (necesita habitaciones): se refleja acá para que el
        // switch no prometa algo que el gate de allá va a negar.
        const habitaciones = features ? features['pms_room_views' as PmsFeatureKey] : true;
        return (
          <div className="feature-group" key={group.service}>
            <div className="desc-label">{group.title}</div>
            <div className="feature-group-sub">
              {servicioActivo
                ? group.sub
                : `${SERVICE_META[group.service].label} está apagado para este cliente: activa el servicio arriba para configurar sus funcionalidades.`}
            </div>
            <div className={`feature-list${servicioActivo ? '' : ' off'}`}>
              {group.items.map((item) => {
                const on = features ? features[item.key] : false;
                const cargando = !features || pending === item.key;
                const dependenciaApagada = item.key === 'pms_housekeeping' && !habitaciones;
                return (
                  <div className="feature-row" key={item.key}>
                    <div className="feature-row-text">
                      <div className="feature-row-label">{item.label}</div>
                      <div className="feature-row-desc">{item.desc}</div>
                      {item.nota && (
                        <div className={`feature-row-nota${dependenciaApagada ? ' activa' : ''}`}>{item.nota}</div>
                      )}
                    </div>
                    <M3Switch
                      label={item.label}
                      on={on}
                      disabled={cargando || !servicioActivo}
                      onClick={() => toggleFeature(item.key)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
