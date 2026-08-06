import { formatWhen } from '../../api';
import { useTiendaData } from '../../context/TiendaDataContext';

export default function TiendaContacto() {
  const { mensajes, loading, error } = useTiendaData();

  if (loading && !mensajes.length) return <div className="empty-state">Cargando…</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!mensajes.length) return <div className="empty-state">Sin mensajes de contacto todavía.</div>;

  return (
    <div className="result-list">
      {mensajes.map((m) => (
        <div className="result-list-item" key={m.order_id}>
          <div className="exec-detail-addon-head">
            <strong style={{ color: 'var(--ink)' }}>{m.cliente.nombre}</strong>
            <span className="exec-detail-when">{formatWhen(m.created_at)}</span>
          </div>
          <div className="cell-sub" style={{ marginTop: 4 }}>
            {m.cliente.email} · {m.cliente.asunto}
          </div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: 'var(--ink)' }}>{m.cliente.mensaje}</div>
        </div>
      ))}
    </div>
  );
}
