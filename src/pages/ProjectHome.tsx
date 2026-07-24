import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { usePanelData } from '../context/PanelDataContext';
import { callAction, formatRelative } from '../api';
import { AGENT_META, AGENT_FUNCTION_KEYS, DEFAULTS } from '../constants';
import type { AiSpendClientLine, AiSpendOverview, ContentPiece } from '../types';
import Reveal from '../components/Reveal';
import type { ProjectOutletContext } from '../components/ProjectLayout';

function mostRecentPiece(pieces: { fecha: string; piece: ContentPiece }[]): ContentPiece | null {
  if (!pieces.length) return null;
  return [...pieces].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0].piece;
}

const currentMonthEs = (() => {
  const s = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
})();

export default function ProjectHome() {
  const { agentConfigs, agentStatus, activeProject, activeProjectId, contentGrid } = usePanelData();
  const { summary, summaryError } = useOutletContext<ProjectOutletContext>();
  const navigate = useNavigate();
  const [spend, setSpend] = useState<AiSpendClientLine | null>(null);
  const [spendError, setSpendError] = useState(false);

  const projectAgentKeys = activeProject?.agents?.length ? activeProject.agents : AGENT_FUNCTION_KEYS;

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    setSpend(null);
    setSpendError(false);
    callAction<AiSpendOverview>('get_ai_spend_overview', { project_ids: [activeProjectId] })
      .then((data) => {
        if (!cancelled) setSpend(data.by_client[0] ?? null);
      })
      .catch((e) => {
        console.error('Error cargando el gasto de IA del cliente', e);
        if (!cancelled) setSpendError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const worstTone = (() => {
    if (!summary) return null;
    const tones = Object.values(summary.system_health).map((h) => h.tone);
    if (tones.includes('error')) return 'error';
    if (tones.includes('warn')) return 'warn';
    if (tones.every((t) => t === 'off')) return 'off';
    return 'ok';
  })();

  const flatPieces: { fecha: string; piece: ContentPiece }[] = [];
  if (contentGrid?.calendario_semanal) {
    for (const week of contentGrid.calendario_semanal) {
      for (const piece of week.piezas || []) {
        flatPieces.push({ fecha: piece.fecha, piece });
      }
    }
  }
  const latestPiece = mostRecentPiece(flatPieces);
  const daveStatus = agentStatus.strategist;

  const comunidadTotal =
    summary && (summary.social.instagram.followers !== null || summary.social.facebook.followers !== null || summary.social.youtube.followers !== null)
      ? (summary.social.instagram.followers ?? 0) + (summary.social.facebook.followers ?? 0) + (summary.social.youtube.followers ?? 0)
      : null;

  const metaAlert = summary?.system_health.meta_api;

  return (
    <Reveal>
      <div className="section-head" style={{ marginTop: 8 }}>
        <span className="section-title">Bloque 1 · Radar Comercial</span>
      </div>
      <div className="card2-grid card2-grid-3">
        <Reveal delay={0}>
          <div className="card2">
            <div className="card2-label">Estado del Sistema</div>
            <div className="sys-health-row">
              <span className={`sys-dot-lg sys-dot-lg-${worstTone ?? 'off'}`} />
              <div>
                <div className="sys-health-title">
                  {worstTone === 'ok' ? 'All Systems Operational' : worstTone === 'warn' ? 'Atención en un sistema' : worstTone === 'error' ? 'Hay un error activo' : 'Sin datos todavía'}
                </div>
                <div className="sys-health-sub">
                  Agentes activos · {daveStatus?.updated_at ? `Sync ${formatRelative(daveStatus.updated_at)}` : 'sin corridas todavía'}
                </div>
              </div>
            </div>
            {summary && (
              <div className="sys-mini-grid">
                <div className="sys-mini-stat">
                  <span>Dave</span>
                  <span className={`sys-mini-value sys-mini-${summary.system_health.dave.tone}`}>{summary.system_health.dave.label}</span>
                </div>
                <div className="sys-mini-stat">
                  <span>Jimi</span>
                  <span className={`sys-mini-value sys-mini-${summary.system_health.jimi.tone}`}>{summary.system_health.jimi.label}</span>
                </div>
                <div className="sys-mini-stat">
                  <span>GSC Sync</span>
                  <span className={`sys-mini-value sys-mini-${summary.system_health.gsc_sync.tone}`}>{summary.system_health.gsc_sync.label}</span>
                </div>
                <div className="sys-mini-stat">
                  <span>Meta API</span>
                  <span className={`sys-mini-value sys-mini-${summary.system_health.meta_api.tone}`}>{summary.system_health.meta_api.label}</span>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div className="card2">
            <div className="card2-label">Tráfico Orgánico · GSC</div>
            <div className="card2-value-row">
              <span className="card2-value-xl tabular">{summary ? (summary.seo_trafico?.clics_organicos != null ? summary.seo_trafico.clics_organicos.toLocaleString('es-CL') : '—') : summaryError ? '—' : '…'}</span>
              <span className="card2-value-unit">clics</span>
            </div>
            {summary?.seo_trafico ? (
              <div className={`card2-delta card2-delta-${summary.seo_trafico_delta_pct === null ? 'neutral' : summary.seo_trafico_delta_pct >= 0 ? 'ok' : 'bad'}`}>
                {summary.seo_trafico_delta_pct !== null ? (
                  <span className="card2-delta-pill">{summary.seo_trafico_delta_pct >= 0 ? '+' : ''}{summary.seo_trafico_delta_pct}%</span>
                ) : (
                  <span className="card2-delta-pill card2-delta-pill-neutral">Sin comparación</span>
                )}
                <span className="card2-delta-label">vs. hace 30 días</span>
              </div>
            ) : (
              <div className="card2-delta-label">Sin datos todavía</div>
            )}
            <div className="card2-divider" />
            <div className="card2-mini-row">
              <span>Impresiones</span>
              <span className="card2-mini-value">{summary?.seo_trafico?.impresiones != null ? summary.seo_trafico.impresiones.toLocaleString('es-CL') : '—'}</span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="card2">
            <div className="card2-label">Comunidad · Total</div>
            <div className="card2-value-row">
              <span className="card2-value-xl tabular">{summary ? (comunidadTotal !== null ? comunidadTotal.toLocaleString('es-CL') : '—') : summaryError ? '—' : '…'}</span>
              <span className="card2-value-unit">seguidores</span>
            </div>
            <div className="card2-delta card2-delta-neutral">
              {summary?.social.instagram.delta_7d_pct != null || summary?.social.facebook.delta_7d_pct != null || summary?.social.youtube.delta_7d_pct != null ? (
                <span className="card2-delta-pill card2-delta-pill-neutral">
                  IG {summary.social.instagram.delta_7d_pct != null ? (summary.social.instagram.delta_7d_pct >= 0 ? '+' : '') + summary.social.instagram.delta_7d_pct + '%' : 's/d'} · FB{' '}
                  {summary.social.facebook.delta_7d_pct != null ? (summary.social.facebook.delta_7d_pct >= 0 ? '+' : '') + summary.social.facebook.delta_7d_pct + '%' : 's/d'} · YT{' '}
                  {summary.social.youtube.delta_7d_pct != null ? (summary.social.youtube.delta_7d_pct >= 0 ? '+' : '') + summary.social.youtube.delta_7d_pct + '%' : 's/d'}
                </span>
              ) : (
                <span className="card2-delta-pill card2-delta-pill-neutral">Sin comparación</span>
              )}
              <span className="card2-delta-label">últimos 7 días</span>
            </div>
            <div className="card2-divider" />
            <div className="card2-mini-row">
              <span>Instagram</span>
              <span className="card2-mini-value">{summary?.social.instagram.followers != null ? summary.social.instagram.followers.toLocaleString('es-CL') : '—'}</span>
            </div>
            <div className="card2-mini-row">
              <span>Facebook</span>
              <span className="card2-mini-value">{summary?.social.facebook.followers != null ? summary.social.facebook.followers.toLocaleString('es-CL') : '—'}</span>
            </div>
            <div className="card2-mini-row">
              <span>YouTube</span>
              <span className="card2-mini-value">{summary?.social.youtube.followers != null ? summary.social.youtube.followers.toLocaleString('es-CL') : '—'}</span>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="section-head" style={{ marginTop: 36 }}>
        <span className="section-title">Bloque 2 · Operaciones de Agencia</span>
      </div>
      <div className="card2-grid card2-grid-2">
        <Reveal delay={0}>
          <div className="card2 agent-output-card">
            <div className="card2-label">⚡ Último Output de Agente</div>
            {latestPiece ? (
              <div className="agent-output-body">
                <div className="agent-output-main">
                  <div className="agent-output-headline">{latestPiece.headline}</div>
                  <div className="agent-output-meta">
                    {latestPiece.formato} · {latestPiece.copy ? `${latestPiece.copy.trim().split(/\s+/).filter(Boolean).length} palabras` : ''}
                  </div>
                  <div className="agent-output-excerpt">{latestPiece.copy?.slice(0, 180)}{(latestPiece.copy?.length ?? 0) > 180 ? '…' : ''}</div>
                </div>
                <div className="agent-output-side">
                  <span className="agent-output-pending">⏳ Pending human review</span>
                  <span className="agent-output-agent">Agente: Dave</span>
                  <span className="agent-output-time">{daveStatus?.updated_at ? formatRelative(daveStatus.updated_at) : ''}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">Sin piezas de contenido generadas todavía.</div>
            )}
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div className="card2">
            <div className="card2-label">◆ Claude API · Tokens MTD</div>
            <div className="card2-value-row">
              <span className="card2-value-lg tabular">
                {spend ? (spend.input_tokens + spend.output_tokens).toLocaleString('es-CL') : spendError ? '—' : '…'}
              </span>
              <span className="card2-value-unit">tokens</span>
            </div>
            <div className="card2-cost-row">
              <span className="card2-cost">{spend ? `$${spend.cost_usd.toFixed(2)}` : '—'}</span>
              <span className="card2-delta-label">{currentMonthEs}</span>
            </div>
            <div className="card2-divider" />
            <div className="card2-mini-row">
              <span>Input tokens</span>
              <span className="card2-mini-value">{spend ? spend.input_tokens.toLocaleString('es-CL') : '—'}</span>
            </div>
            <div className="card2-mini-row">
              <span>Output tokens</span>
              <span className="card2-mini-value">{spend ? spend.output_tokens.toLocaleString('es-CL') : '—'}</span>
            </div>
          </div>
        </Reveal>
      </div>

      {metaAlert && metaAlert.tone !== 'ok' && metaAlert.tone !== 'off' && (
        <Reveal>
          <div className={`alert-card alert-card-${metaAlert.tone}`} style={{ marginTop: 24 }}>
            <span className="alert-card-icon">⚠</span>
            <div className="alert-card-body">
              <div className="alert-card-title">{metaAlert.tone === 'error' ? 'Meta API con errores' : 'Meta API necesita atención'}</div>
              <div className="alert-card-detail">{metaAlert.detail}</div>
            </div>
            <a className="alert-card-cta" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
              Revisar permisos
            </a>
          </div>
        </Reveal>
      )}

      <div className="section-head" style={{ marginTop: 36 }}>
        <span className="section-title">Estado de los agentes</span>
      </div>
      <div className="services-grid">
        {projectAgentKeys.map((key, i) => {
          const meta = AGENT_META[key];
          const config = agentConfigs[key] || DEFAULTS[key];
          const status = agentStatus[key];
          return (
            <Reveal key={key} delay={i * 60}>
              <div className="service-row" onClick={() => navigate(`/agentes/${key}`)}>
                <div className={`avatar ${meta.cls}`} style={{ width: 40, height: 40, fontSize: 12 }}>
                  <div className="avatar-ring" />
                  {meta.initials}
                </div>
                <div className="service-info">
                  <div className="service-name">
                    {config.name} · {meta.short}
                  </div>
                  <div className="service-detail">{status?.last_action || 'Todavía no ha corrido'}</div>
                </div>
                <div className="service-stat">
                  <div className="service-stat-value tabular">{status?.execution_count_month ?? 0}</div>
                  <div className="service-stat-label">este mes</div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Reveal>
  );
}
