import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelData } from '../context/PanelDataContext';
import { callAction } from '../api';
import { AGENT_META } from '../constants';
import type { AgencyGrowthRadar, AgencyOverview, AgentKey, RadarDirection, RadarMetric } from '../types';

// Chip compacto del Growth Radar multi-cliente: una direccion (creciendo/
// estancado/bajando/sin datos) + el numero headline, nunca inventa una
// flecha cuando falta el punto de comparacion.
function RadarChip({ label, metric }: { label: string; metric: RadarMetric | { value: number | null; direction: RadarDirection } }) {
  const toneClass =
    metric.direction === 'growing' ? 'growth' : metric.direction === 'declining' ? 'decline' : metric.direction === 'flat' ? 'neutral' : 'off';
  const arrow = metric.direction === 'growing' ? '↑' : metric.direction === 'declining' ? '↓' : metric.direction === 'flat' ? '→' : '·';
  return (
    <span className={`growth-radar-chip growth-radar-chip-${toneClass}`} title={label}>
      <span className="growth-radar-chip-label">{label}</span>
      <span className="growth-radar-chip-arrow">{arrow}</span>
      <span className="growth-radar-chip-value tabular">{metric.value ?? '—'}</span>
    </span>
  );
}

export default function WelcomeCard() {
  const { projects } = usePanelData();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AgencyOverview | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [radar, setRadar] = useState<AgencyGrowthRadar | null>(null);
  const [radarError, setRadarError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    callAction<AgencyOverview>('get_agency_overview', { project_ids: projects.map((p) => p.id) })
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((e) => {
        console.error('Error cargando el resumen de la agencia', e);
        if (!cancelled) setOverviewError(true);
      });
    callAction<AgencyGrowthRadar>('get_agency_growth_radar', { project_ids: projects.map((p) => p.id) })
      .then((data) => {
        if (!cancelled) setRadar(data);
      })
      .catch((e) => {
        console.error('Error cargando el growth radar de la agencia', e);
        if (!cancelled) setRadarError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;
  const money = (v: number | null) => (v === null ? '—' : `$${v.toFixed(2)}`);

  return (
    <div className="welcome-wrap">
      <div className="welcome-content">
        <img className="welcome-logo" src="/rocky-brand-white.png" alt="RockyBrand" />
        <h1 className="welcome-title">AI Powered Brand &amp; Execution</h1>
        <ul className="welcome-list">
          <li>
            <strong>Estrategia y Consistencia:</strong> El centro de mando donde la estrategia profunda de marca y la
            consistencia visual se encuentran con la eficiencia de la automatización en la nube.
          </li>
          <li>
            <strong>Procesamiento Inteligente:</strong> La plataforma procesa tu material crudo y activa las mentes
            estratégicas de Dave (Brand) y Jimi (Execution).
          </li>
          <li>
            <strong>Músculo Técnico:</strong> Orquesta el motor profesional de DaVinci Resolve Studio en AWS para
            entregarte Reels listos para impactar.
          </li>
          <li>
            <strong>Nuestra Filosofía:</strong> Menos escritorio, más rodaje.
          </li>
        </ul>

        {projects.length > 0 && (
          <div className="welcome-projects">
            <div className="welcome-projects-label">Proyectos vigentes</div>
            <div className="welcome-projects-row">
              {projects.map((p) => (
                <button key={p.id} type="button" className="welcome-project-btn" onClick={() => navigate(`/p/${p.id}`)}>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="welcome-metrics">
          <div className="welcome-projects-label">Métricas de Rocky</div>
          {overviewError && <div className="welcome-metrics-error">No se pudo cargar el estado de la agencia.</div>}
          {!overviewError && (
            <div className="welcome-metrics-grid">
              <div className="welcome-metric-item">
                <div className="welcome-metric-value tabular">
                  {overview ? money(overview.billing.month_to_date_usd) : '…'}
                </div>
                <div className="welcome-metric-label">Gasto hasta la fecha</div>
              </div>
              <div className="welcome-metric-item">
                <div className="welcome-metric-value tabular">{overview ? money(overview.billing.budget_usd) : '…'}</div>
                <div className="welcome-metric-label">Presupuesto mensual</div>
              </div>
              <div className="welcome-metric-item">
                <div className="welcome-metric-value tabular">
                  {overview ? `${overview.agents.ready}/${overview.agents.total}` : '…'}
                </div>
                <div className="welcome-metric-label">Agentes listos</div>
              </div>
              <div className="welcome-metric-item">
                <div
                  className="welcome-metric-value tabular"
                  style={{ color: overview && overview.errors.length ? 'var(--err)' : 'var(--moss)' }}
                >
                  {overview ? overview.errors.length : '…'}
                </div>
                <div className="welcome-metric-label">Errores activos</div>
              </div>
            </div>
          )}

          {overview && overview.errors.length > 0 && (
            <div className="welcome-errors-list">
              {overview.errors.map((e, i) => (
                <div className="welcome-error-item" key={i}>
                  <span className="status-dot error" />
                  <span>
                    <strong>{projectName(e.project_id)}</strong> · {AGENT_META[e.agent_key as AgentKey]?.short || e.agent_key}
                    {e.last_action ? ` — ${e.last_action}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {projects.length > 0 && (
          <div className="growth-radar">
            <div className="welcome-projects-label">Growth Radar</div>
            {radarError && <div className="welcome-metrics-error">No se pudo cargar el growth radar de la agencia.</div>}
            {!radarError && !radar && <div className="welcome-metrics-error">Cargando…</div>}
            {!radarError && radar && (
              <div className="growth-radar-rows">
                {radar.clients.map((c) => (
                  <div className="growth-radar-row" key={c.client_id} onClick={() => navigate(`/p/${c.client_id}`)}>
                    <div className="growth-radar-client">{projectName(c.client_id)}</div>
                    <div className="growth-radar-chips">
                      <RadarChip label="IG" metric={c.social.instagram} />
                      <RadarChip label="YT" metric={c.social.youtube} />
                      <RadarChip label="SEO" metric={c.seo} />
                      <RadarChip label="Email" metric={c.email} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="welcome-credit">By Matías Araneda</div>
      </div>
    </div>
  );
}
