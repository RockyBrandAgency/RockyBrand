import { useNavigate } from 'react-router-dom';
import Reveal from '../../components/Reveal';
import { formatWhen } from '../../api';
import { useTiendaData } from '../../context/TiendaDataContext';

function money(clp: number): string {
  return clp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

export default function TiendaResumen() {
  const { resumen, loading, error } = useTiendaData();
  const navigate = useNavigate();

  if (loading && !resumen) return <div className="empty-state">Cargando…</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!resumen) return <div className="empty-state">Sin datos todavía.</div>;

  const { ventas_semana, riesgo_quiebre_stock, despachos_pendientes, en_revision_monto } = resumen;

  return (
    <Reveal>
      {en_revision_monto.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--err)', marginBottom: 22 }}>
          <div className="desc-label" style={{ color: 'var(--err)' }}>
            ⚠ {en_revision_monto.length} pedido{en_revision_monto.length === 1 ? '' : 's'} requiere{en_revision_monto.length === 1 ? '' : 'n'} revisión manual
          </div>
          <div className="timeline" style={{ border: 'none', padding: 0, background: 'none' }}>
            {en_revision_monto.map((o) => (
              <div className="timeline-item clickable" key={o.order_id} onClick={() => navigate('pedidos')}>
                <span className="timeline-when">{formatWhen(o.created_at)}</span>
                <span className="timeline-text">
                  <strong style={{ color: 'var(--ink)' }}>{o.order_id}</strong> · {o.email} · {money(o.total_clp || 0)}
                </span>
                <span className="timeline-view-hint">Revisar →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mini-dash">
        <Reveal delay={0}>
          <div className="mini-card">
            <div className="mini-card-icon">$</div>
            <div className="mini-card-label">Ventas de la semana</div>
            <div className="mini-card-value tabular">{money(ventas_semana.total_clp)}</div>
            <div className="mini-card-sub">{ventas_semana.cantidad} pedido{ventas_semana.cantidad === 1 ? '' : 's'} pagado{ventas_semana.cantidad === 1 ? '' : 's'}</div>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <div className="mini-card">
            <div className="mini-card-icon">⚠</div>
            <div className="mini-card-label">Riesgo de quiebre de stock</div>
            <div className="mini-card-value tabular">{riesgo_quiebre_stock.length}</div>
            <div className="mini-card-sub">modelo{riesgo_quiebre_stock.length === 1 ? '' : 's'} con stock bajo</div>
            <button className="mini-card-cta" onClick={() => navigate('catalogo')}>
              Ver catálogo →
            </button>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="mini-card">
            <div className="mini-card-icon">▤</div>
            <div className="mini-card-label">Despachos pendientes</div>
            <div className="mini-card-value tabular">{despachos_pendientes.length}</div>
            <div className="mini-card-sub">pedido{despachos_pendientes.length === 1 ? '' : 's'} pagado{despachos_pendientes.length === 1 ? '' : 's'} sin despachar</div>
            <button className="mini-card-cta" onClick={() => navigate('pedidos')}>
              Ver pedidos →
            </button>
          </div>
        </Reveal>
      </div>

      <div className="section-head" style={{ marginTop: 36 }}>
        <span className="section-title">Modelos con stock bajo</span>
      </div>
      {riesgo_quiebre_stock.length === 0 ? (
        <div className="empty-state">Ningún modelo está bajo el umbral de stock.</div>
      ) : (
        <div className="timeline">
          {riesgo_quiebre_stock.map((p) => (
            <div key={p.sku} className="timeline-item clickable" onClick={() => navigate('catalogo')}>
              <span className="timeline-text">
                <strong style={{ color: 'var(--ink)' }}>{p.nombre}</strong> · {p.sku}
              </span>
              <span className={`pill ${p.stock === 0 ? 'bounced' : 'pending'}`}>
                <span className="pill-dot" />
                {p.stock} en stock
              </span>
            </div>
          ))}
        </div>
      )}
    </Reveal>
  );
}
