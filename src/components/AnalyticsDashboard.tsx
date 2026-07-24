import { useEffect, useState } from 'react';
import { usePanelData } from '../context/PanelDataContext';
import type { MetricsReport } from '../types';
import TrendChart from './TrendChart';

function SourceRow({ name, connected, detail }: { name: string; connected: boolean; detail: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: connected ? 'var(--sage)' : 'var(--dim-2)',
          flexShrink: 0,
        }}
      />
      <div style={{ width: 110, fontSize: 12.5, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 12, color: 'var(--dim)' }}>{detail}</div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { scopedAction, activeProjectId } = usePanelData();
  const [report, setReport] = useState<MetricsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    scopedAction<MetricsReport>('get_metrics_report', { days: 90 })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, scopedAction]);

  if (!activeProjectId || loading) return <div className="empty-state" style={{ marginTop: 24 }}>Cargando fuentes de datos…</div>;
  if (failed || !report) return null;

  const maxTraffic = report.youtube.fuentes_de_trafico[0]?.views || 1;

  return (
    <div style={{ marginTop: 28 }}>
      <div className="desc-label">Fuentes que alimentan este análisis (últimos 90 días)</div>
      <div className="card" style={{ padding: '4px 18px', marginBottom: 18 }}>
        <SourceRow
          name="Meta / Instagram"
          connected={report.social.seguidores_actuales != null}
          detail={report.social.seguidores_actuales != null ? `${report.social.seguidores_actuales} seguidores` : 'Sin conectar'}
        />
        <SourceRow
          name="YouTube"
          connected={report.youtube.suscriptores_actuales != null}
          detail={report.youtube.suscriptores_actuales != null ? `${report.youtube.suscriptores_actuales} suscriptores` : 'Sin conectar'}
        />
        <SourceRow
          name="SEO"
          connected={report.seo.posicion_actual != null}
          detail={report.seo.posicion_actual != null ? `posición ${report.seo.posicion_actual} — "${report.seo.keyword}"` : 'Sin conectar'}
        />
        <SourceRow
          name="Email marketing"
          connected={report.email.enviados > 0}
          detail={report.email.enviados > 0 ? `${report.email.enviados} enviados` : 'Sin envíos en el período'}
        />
      </div>

      <div className="chart-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <div className="card2 chart-card">
          <div className="chart-card-title">Seguidores Instagram</div>
          <TrendChart points={report.social.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores }))} />
        </div>
        <div className="card2 chart-card">
          <div className="chart-card-title">Suscriptores YouTube</div>
          <TrendChart points={report.youtube.snapshots.map((s) => ({ fecha: s.fecha, valor: s.suscriptores }))} />
        </div>
      </div>

      {!!report.youtube.fuentes_de_trafico.length && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="mini-card-label" style={{ marginBottom: 12 }}>De dónde vienen las vistas de YouTube</div>
          {report.youtube.fuentes_de_trafico.map((f) => (
            <div key={f.insightTrafficSourceType} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <div style={{ width: 130, fontSize: 12, color: 'var(--dim)' }}>{f.insightTrafficSourceType}</div>
              <div style={{ flex: 1, background: 'var(--line)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${(f.views / maxTraffic) * 100}%`, background: 'var(--youtube-red)', height: '100%' }} />
              </div>
              <div className="tabular" style={{ width: 50, textAlign: 'right', fontSize: 12 }}>{f.views}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
