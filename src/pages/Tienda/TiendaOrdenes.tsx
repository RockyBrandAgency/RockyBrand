import { useMemo, useState } from 'react';
import { formatWhen } from '../../api';
import { useTiendaData } from '../../context/TiendaDataContext';
import TiendaOrdenDetalleModal from './TiendaOrdenDetalleModal';
import type { StoreOrderStatus } from '../../types';

function money(clp: number | undefined): string {
  return (clp ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

const ESTADOS: { value: StoreOrderStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'revision_monto', label: 'Revisión manual' },
  { value: 'pagada', label: 'Pagada' },
  { value: 'pago_iniciado', label: 'Pago iniciado' },
  { value: 'pendiente_pago', label: 'Pendiente de pago' },
  { value: 'pago_rechazado', label: 'Pago rechazado' },
  { value: 'pago_anulado', label: 'Pago anulado' },
  { value: 'expirada', label: 'Expirada' },
];

const ESTADO_LABEL: Record<string, string> = {
  pendiente_pago: 'Pendiente de pago',
  pago_iniciado: 'Pago iniciado',
  pagada: 'Pagada',
  pago_rechazado: 'Pago rechazado',
  pago_anulado: 'Pago anulado',
  expirada: 'Expirada',
  revision_monto: 'Revisión manual',
};

const ESTADO_PILL: Record<string, string> = {
  pagada: 'confirmed',
  pendiente_pago: 'pending',
  pago_iniciado: 'pending',
  pago_rechazado: 'cancelled',
  pago_anulado: 'cancelled',
  expirada: 'cancelled',
  revision_monto: 'bounced',
};

export default function TiendaOrdenes() {
  const { ordenes, loading, error } = useTiendaData();
  const [filtro, setFiltro] = useState<StoreOrderStatus | ''>('');
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const lista = useMemo(() => (filtro ? ordenes.filter((o) => o.estado === filtro) : ordenes), [ordenes, filtro]);

  if (loading && !ordenes.length) return <div className="empty-state">Cargando…</div>;
  if (error) return <div className="empty-state">{error}</div>;

  return (
    <div>
      <div className="crm-toolbar">
        <select className="crm-search" style={{ maxWidth: 240 }} value={filtro} onChange={(e) => setFiltro(e.target.value as StoreOrderStatus | '')}>
          {ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {!lista.length ? (
        <div className="empty-state">Sin pedidos en este filtro.</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th className="tabular">Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => (
                <tr
                  key={o.order_id}
                  className="row-clickable"
                  style={o.estado === 'revision_monto' ? { background: 'rgba(192,80,58,0.08)' } : undefined}
                  onClick={() => setDetalleId(o.order_id)}
                >
                  <td className="cell-name">{o.order_id}</td>
                  <td className="cell-sub">{o.email || '—'}</td>
                  <td>
                    <span className={`pill ${ESTADO_PILL[o.estado] || 'pending'}`}>
                      <span className="pill-dot" />
                      {ESTADO_LABEL[o.estado] || o.estado}
                    </span>
                  </td>
                  <td className="tabular">{money(o.total_clp)}</td>
                  <td className="tabular">{formatWhen(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalleId && <TiendaOrdenDetalleModal orderId={detalleId} onClose={() => setDetalleId(null)} />}
    </div>
  );
}
