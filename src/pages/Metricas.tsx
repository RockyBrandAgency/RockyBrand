import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelData } from '../context/PanelDataContext';
import { formatWhen } from '../api';
import { TOOL_KEYS } from '../constants';
import type { MetricsReport } from '../types';
import Reveal from '../components/Reveal';
import KpiStrip from '../components/KpiStrip';
import TrendChart from '../components/TrendChart';
import BarChart from '../components/BarChart';
import KeywordMatrix from '../components/KeywordMatrix';

const RANGE_OPTIONS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

function average(values: (number | null | undefined)[]): number | null {
  const real = values.filter((v): v is number => v !== null && v !== undefined);
  if (!real.length) return null;
  return Math.round((real.reduce((a, b) => a + b, 0) / real.length) * 10) / 10;
}

export default function Metricas() {
  const { activeProjectName, activeProject, scopedAction, activeProjectId } = usePanelData();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<MetricsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    scopedAction<MetricsReport>('get_metrics_report', { days })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((e) => {
        console.error('Error cargando el reporte de métricas', e);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, activeProjectId, scopedAction]);

  const activeTools = activeProject?.tools?.length ? activeProject.tools : TOOL_KEYS;
  if (!activeTools.includes('metricas')) {
    navigate('..', { replace: true });
    return null;
  }

  const openRate = report && report.email.enviados ? Math.round((report.email.aperturas / report.email.enviados) * 1000) / 10 : null;

  const igPosiciones = report ? report.seo.keyword_matrix.map((k) => k.posicion_actual).filter((p): p is number => p !== null) : [];
  const igPosicionesAnt = report ? report.seo.keyword_matrix.map((k) => k.posicion_anterior).filter((p): p is number => p !== null) : [];
  const posicionMedia = igPosiciones.length ? Math.round((igPosiciones.reduce((a, b) => a + b, 0) / igPosiciones.length) * 10) / 10 : null;
  const posicionMediaAnt = igPosicionesAnt.length ? igPosicionesAnt.reduce((a, b) => a + b, 0) / igPosicionesAnt.length : null;
  const posicionDelta = posicionMedia !== null && posicionMediaAnt !== null ? Math.round((posicionMediaAnt - posicionMedia) * 10) / 10 : null;

  const top3 = report ? igPosiciones.filter((p) => p <= 3).length : 0;
  const top10 = report ? igPosiciones.filter((p) => p <= 10).length : 0;
  const top20 = report ? igPosiciones.filter((p) => p <= 20).length : 0;

  const igAlcanceProm = report ? average(report.social.publicaciones.map((p) => p.alcance)) : null;
  const igReproduccionesProm = report ? average(report.social.publicaciones.map((p) => p.reproducciones)) : null;
  const igEngProm = report ? average(report.social.publicaciones.map((p) => p.engagement_rate_sobre_alcance_pct)) : null;

  const igSparkline = report ? report.social.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores })) : [];
  const fbSparkline = report ? report.facebook.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores })) : [];
  const fbVisualizacionesSparkline = report
    ? report.facebook.visualizaciones_snapshots.map((s) => ({ fecha: s.fecha, valor: s.visualizaciones }))
    : [];
  const ytSparkline = report ? report.youtube.snapshots.map((s) => ({ fecha: s.fecha, valor: s.suscriptores })) : [];
  const seoSparkline = report ? report.seo.clicks_snapshots.map((s) => ({ fecha: s.fecha, valor: s.clics })) : [];
  const seoImpresionesSparkline = report ? report.seo.impressions_snapshots.map((s) => ({ fecha: s.fecha, valor: s.impresiones })) : [];
  const seoPosicionSparkline = report ? report.seo.snapshots.map((s) => ({ fecha: s.fecha, valor: s.posicion })) : [];

  const igPostBars = report
    ? report.social.publicaciones
        .filter((p) => p.reproducciones !== null)
        .map((p) => ({ label: formatWhen(p.fecha), valor: p.reproducciones as number }))
    : [];

  const watchTimeHoras = report && report.youtube.minutos_vistos_periodo != null ? Math.round((report.youtube.minutos_vistos_periodo / 60) * 10) / 10 : null;

  return (
    <Reveal>
        <div className="metrics-toolbar" style={{ marginTop: 8 }}>
          <div>
            <div className="page-title">Métricas del período</div>
            <div className="page-sub">Datos consolidados de todos los canales activos &middot; {activeProjectName}</div>
          </div>
          <div className="metrics-actions no-print">
            <div className="range-pills">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  className={`range-pill${opt.days === days ? ' active' : ''}`}
                  onClick={() => setDays(opt.days)}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()} type="button">
              ⭳ Descargar reporte
            </button>
          </div>
        </div>

        {loading && <div className="empty-state">Cargando métricas…</div>}
        {!loading && error && <div className="empty-state">No se pudo cargar el reporte. Intenta de nuevo.</div>}

        {!loading && !error && report && (
          <>
            <KpiStrip
              items={[
                { label: 'Campañas email', value: report.email.campaigns.length, sub: openRate !== null ? `${openRate}% apertura prom.` : undefined },
                { label: 'Seguidores Instagram', value: report.social.seguidores_actuales ?? '—' },
                { label: 'Cambio neto IG · 7 días', value: report.social.cambio_neto_7d, signed: true },
                { label: 'Suscriptores YT · 7 días', value: report.youtube.suscriptores_netos_7d, signed: true },
                {
                  label: 'Posición SEO media',
                  value: posicionMedia ?? '—',
                  sub: posicionDelta === null ? undefined : posicionDelta > 0 ? `↑ ${posicionDelta} posiciones` : posicionDelta < 0 ? `↓ ${Math.abs(posicionDelta)} posiciones` : 'sin cambio',
                },
                { label: 'Seguidores Facebook', value: report.facebook.seguidores_actuales ?? '—' },
              ]}
            />

            <div className="section-head" style={{ marginTop: 40 }}>
              <span className="section-title">Social Media &amp; Comunidad</span>
              <span className="section-sub">Tendencias de alcance e impresiones — últimos {days} días</span>
            </div>
            <div className="chart-card-grid">
              <Reveal delay={0}>
                <div className="card2 chart-card">
                  <div className="chart-card-head">
                    <span className="chart-card-title">Instagram</span>
                    <span className="chart-card-range">últimos {days} días</span>
                  </div>
                  <div className="chart-card-stats">
                    <div>
                      <span className="chart-card-stat-label">Seguidores</span>
                      <span className="chart-card-stat-value tabular">{report.social.seguidores_actuales !== null ? report.social.seguidores_actuales.toLocaleString('es-CL') : '—'}</span>
                    </div>
                    <div>
                      <span className="chart-card-stat-label">Alcance prom.</span>
                      <span className="chart-card-stat-value tabular">{igAlcanceProm !== null ? igAlcanceProm.toLocaleString('es-CL') : '—'}</span>
                    </div>
                    <div>
                      <span className="chart-card-stat-label">Visualizaciones prom.</span>
                      <span className="chart-card-stat-value tabular">{igReproduccionesProm !== null ? igReproduccionesProm.toLocaleString('es-CL') : '—'}</span>
                    </div>
                    <div>
                      <span className="chart-card-stat-label">Eng. Rate</span>
                      <span className="chart-card-stat-value tabular">{igEngProm !== null ? `${igEngProm}%` : '—'}</span>
                    </div>
                  </div>
                  <TrendChart points={igSparkline} formatDate={(f) => formatWhen(f).slice(0, 5)} />
                  <div className="chart-card-subtitle">Visualizaciones por publicación</div>
                  <BarChart bars={igPostBars} />
                </div>
              </Reveal>
              <Reveal delay={60}>
                <div className="card2 chart-card">
                  <div className="chart-card-head">
                    <span className="chart-card-title">Facebook</span>
                    <span className="chart-card-range">últimos {days} días</span>
                  </div>
                  <div className="card2-value-row" style={{ marginTop: 18 }}>
                    <span className="card2-value-xl tabular">{report.facebook.seguidores_actuales !== null ? report.facebook.seguidores_actuales.toLocaleString('es-CL') : '—'}</span>
                    <span className="card2-value-unit">seguidores</span>
                  </div>
                  <div className="card2-delta-label">{report.facebook.nombre_pagina ?? 'Sin datos todavía'}</div>
                  <TrendChart points={fbSparkline} formatDate={(f) => formatWhen(f).slice(0, 5)} />
                  <div className="chart-card-subtitle">
                    Visualizaciones de Página{report.facebook.visualizaciones_actual !== null ? ` · ${report.facebook.visualizaciones_actual.toLocaleString('es-CL')} hoy` : ''}
                  </div>
                  <TrendChart points={fbVisualizacionesSparkline} formatDate={(f) => formatWhen(f).slice(0, 5)} />
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div className="card2 chart-card">
                  <div className="chart-card-head">
                    <span className="chart-card-title">YouTube</span>
                    <span className="chart-card-range">últimos {days} días</span>
                  </div>
                  <div className="chart-card-stats">
                    <div>
                      <span className="chart-card-stat-label">Suscriptores</span>
                      <span className="chart-card-stat-value tabular">{report.youtube.suscriptores_actuales !== null ? report.youtube.suscriptores_actuales.toLocaleString('es-CL') : '—'}</span>
                    </div>
                    <div>
                      <span className="chart-card-stat-label">Visualizaciones</span>
                      <span className="chart-card-stat-value tabular">{report.youtube.vistas_periodo.toLocaleString('es-CL')}</span>
                    </div>
                    <div>
                      <span className="chart-card-stat-label">Watch Time</span>
                      <span className="chart-card-stat-value tabular">{watchTimeHoras !== null ? `${watchTimeHoras}h` : '—'}</span>
                    </div>
                    <div>
                      <span className="chart-card-stat-label" title="Necesita la duración total del video vía YouTube Data API — no se consulta hoy">
                        Retención
                      </span>
                      <span className="chart-card-stat-value tabular chart-card-stat-nodata">Sin datos</span>
                    </div>
                  </div>
                  <TrendChart points={ytSparkline} formatDate={(f) => formatWhen(f).slice(0, 5)} />
                </div>
              </Reveal>
            </div>

            <div className="section-head" style={{ marginTop: 40 }}>
              <span className="section-title">SEO &amp; Búsqueda Orgánica</span>
              <span className="section-sub">Tendencia de clics vía Google Search Console</span>
            </div>
            <div className="seo-section-grid">
              <Reveal delay={0}>
                <div className="card2 chart-card">
                  <div className="chart-card-head">
                    <span className="chart-card-title">Clics orgánicos</span>
                  </div>
                  <div className="card2-value-row">
                    <span className="card2-value-xl tabular">{report.seo.clics_organicos_actual !== null ? report.seo.clics_organicos_actual.toLocaleString('es-CL') : '—'}</span>
                  </div>
                  <TrendChart points={seoSparkline} formatDate={(f) => formatWhen(f).slice(0, 5)} />
                  <div className="seo-top-counts">
                    <div>
                      <span className="tabular">{top3}</span>
                      <span>Top 3</span>
                    </div>
                    <div>
                      <span className="tabular">{top10}</span>
                      <span>Top 10</span>
                    </div>
                    <div>
                      <span className="tabular">{top20}</span>
                      <span>Top 20</span>
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={60}>
                <div className="card2 chart-card">
                  <div className="chart-card-head">
                    <span className="chart-card-title">Posición promedio</span>
                    <span className="chart-card-range">menor es mejor</span>
                  </div>
                  <div className="card2-value-row">
                    <span className="card2-value-xl tabular">{report.seo.posicion_actual ?? '—'}</span>
                  </div>
                  <TrendChart points={seoPosicionSparkline} formatDate={(f) => formatWhen(f).slice(0, 5)} />
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div className="card2 chart-card">
                  <div className="chart-card-head">
                    <span className="chart-card-title">Impresiones de búsqueda</span>
                  </div>
                  <div className="card2-value-row">
                    <span className="card2-value-xl tabular">
                      {seoImpresionesSparkline.length ? seoImpresionesSparkline[seoImpresionesSparkline.length - 1].valor.toLocaleString('es-CL') : '—'}
                    </span>
                  </div>
                  <TrendChart points={seoImpresionesSparkline} formatDate={(f) => formatWhen(f).slice(0, 5)} />
                </div>
              </Reveal>
              <Reveal delay={180}>
                <div className="card2">
                  <div className="chart-card-head">
                    <span className="chart-card-title">Matriz de Keywords</span>
                    <span className="chart-card-range">{report.seo.keyword_matrix.length} trackeadas</span>
                  </div>
                  <KeywordMatrix rows={report.seo.keyword_matrix} />
                </div>
              </Reveal>
            </div>

            <div className="section-head" style={{ marginTop: 40 }}>
              <span className="section-title">Email Marketing</span>
              <span className="section-sub">Historial de campañas enviadas en el período</span>
            </div>
            <div className="card2" style={{ overflowX: 'auto', marginTop: 14, marginBottom: 30 }}>
              <table>
                <thead>
                  <tr>
                    <th>Campaña</th>
                    <th>Fecha envío</th>
                    <th className="tabular">Enviados</th>
                    <th className="tabular">Tasa apertura</th>
                  </tr>
                </thead>
                <tbody>
                  {report.email.campaigns.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <div className="cell-name">{c.name || 'Sin nombre'}</div>
                      </td>
                      <td className="tabular">{formatWhen(c.sent_at)}</td>
                      <td className="tabular">{c.enviados}</td>
                      <td className="tabular">{c.enviados ? `${Math.round((c.aperturas / c.enviados) * 1000) / 10}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.email.campaigns.length && <div className="empty-state">Sin campañas enviadas en este período.</div>}
            </div>
          </>
        )}
    </Reveal>
  );
}
