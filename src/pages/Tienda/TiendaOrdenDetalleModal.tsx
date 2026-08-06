import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { formatWhen } from '../../api';
import { useTiendaData } from '../../context/TiendaDataContext';
import type { StoreOrder } from '../../types';

function money(clp: number | undefined): string {
  return (clp ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

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

export default function TiendaOrdenDetalleModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { obtenerDetalleOrden, marcarDespachado } = useTiendaData();
  const [orden, setOrden] = useState<StoreOrder | null>(null);
  const [loadError, setLoadError] = useState('');
  const [numeroSeguimiento, setNumeroSeguimiento] = useState('');
  const [despachando, setDespachando] = useState(false);
  const [despachoError, setDespachoError] = useState('');

  useEffect(() => {
    let cancelled = false;
    obtenerDetalleOrden(orderId)
      .then((o) => {
        if (!cancelled) setOrden(o);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'No se pudo cargar el pedido.');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, obtenerDetalleOrden]);

  async function despachar() {
    if (!numeroSeguimiento.trim()) {
      setDespachoError('Ingresa un número de seguimiento.');
      return;
    }
    setDespachando(true);
    setDespachoError('');
    try {
      await marcarDespachado(orderId, numeroSeguimiento.trim());
      const actualizada = await obtenerDetalleOrden(orderId);
      setOrden(actualizada);
    } catch (e) {
      setDespachoError(e instanceof Error ? e.message : 'No se pudo marcar como despachado.');
    } finally {
      setDespachando(false);
    }
  }

  return (
    <Modal title={orderId} sub="Detalle del pedido" onClose={onClose}>
      {loadError && <div className="empty-state">{loadError}</div>}
      {!orden && !loadError && <div className="cell-sub">Cargando…</div>}
      {orden && (
        <>
          <div className="exec-detail-head">
            <span className={`pill ${ESTADO_PILL[orden.estado] || 'pending'}`}>
              <span className="pill-dot" />
              {ESTADO_LABEL[orden.estado] || orden.estado}
            </span>
            {orden.estado === 'revision_monto' && (
              <span className="cell-sub" style={{ color: 'var(--err)' }}>
                Transbank cobró un monto distinto al esperado — no se restaura stock automáticamente.
              </span>
            )}
          </div>

          <div className="exec-detail-grid">
            <div className="exec-detail-item">
              <div className="post-popup-field-label">Cliente</div>
              <div className="exec-detail-value">{orden.cliente?.nombre || orden.email || '—'}</div>
            </div>
            <div className="exec-detail-item">
              <div className="post-popup-field-label">Email</div>
              <div className="exec-detail-value">{orden.cliente?.email || orden.email || '—'}</div>
            </div>
            <div className="exec-detail-item">
              <div className="post-popup-field-label">Teléfono</div>
              <div className="exec-detail-value">{orden.cliente?.telefono || '—'}</div>
            </div>
            <div className="exec-detail-item">
              <div className="post-popup-field-label">Fecha</div>
              <div className="exec-detail-value">{formatWhen(orden.created_at)}</div>
            </div>
            <div className="exec-detail-item">
              <div className="post-popup-field-label">Dirección</div>
              <div className="exec-detail-value">
                {orden.cliente ? `${orden.cliente.direccion}, ${orden.cliente.comuna}, ${orden.cliente.region}` : '—'}
              </div>
            </div>
            <div className="exec-detail-item">
              <div className="post-popup-field-label">Total</div>
              <div className="exec-detail-value">{money(orden.total_clp)}</div>
            </div>
          </div>

          <div className="post-popup-field-label" style={{ marginTop: 22, marginBottom: 10 }}>
            Items
          </div>
          <div className="result-list">
            {(orden.items || []).map((item) => (
              <div className="result-list-item" key={item.sku}>
                <div className="exec-detail-addon-head">
                  <strong style={{ color: 'var(--ink)' }}>{item.nombre}</strong>
                  <span className="exec-detail-when">
                    {item.cantidad} × {money(item.precio_unitario_clp)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {orden.estado === 'pagada' && !orden.despachado_en && (
            <>
              <div className="post-popup-field-label" style={{ marginTop: 22, marginBottom: 10 }}>
                Marcar como despachado
              </div>
              {despachoError && (
                <div className="footnote" style={{ color: 'var(--err)', marginBottom: 8 }}>
                  {despachoError}
                </div>
              )}
              <div className="crm-field">
                <input
                  placeholder="Número de seguimiento"
                  value={numeroSeguimiento}
                  onChange={(e) => setNumeroSeguimiento(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-sm" disabled={despachando} onClick={() => void despachar()}>
                {despachando ? 'Guardando…' : 'Marcar como despachado'}
              </button>
            </>
          )}

          {orden.despachado_en && (
            <div className="footnote" style={{ marginTop: 18 }}>
              Despachado el {formatWhen(orden.despachado_en)} · seguimiento {orden.numero_seguimiento}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
