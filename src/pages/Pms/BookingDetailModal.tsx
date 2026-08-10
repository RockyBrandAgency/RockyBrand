import { useEffect, useState, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import { usePmsData } from '../../context/PmsDataContext';
import { listAddons } from '../../pmsApi';
import type { PmsAddon, PmsBooking } from '../../types';

function nights(booking: PmsBooking) {
  const ms = new Date(booking.CheckOut).getTime() - new Date(booking.CheckIn).getTime();
  return Math.round(ms / 86400000);
}

function formatDayEs(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PAYMENT_PILL: Record<string, string> = { PAID: 'paid', PENDING: 'pending-pay', PARTIAL: 'partial', REFUNDED: 'refunded' };

export default function BookingDetailModal({ booking, onClose }: { booking: PmsBooking; onClose: () => void }) {
  const { lodgeId, guests, pmsFeatures, roomCatalog, updateBooking } = usePmsData();
  const roomViews = pmsFeatures ? pmsFeatures.pms_room_views : true;
  const [addons, setAddons] = useState<PmsAddon[] | null>(null);
  // Estado local reflejando la habitación real - el prop `booking` es una
  // foto tomada al abrir el modal, no se refresca sola con el refetch del
  // contexto (las 3 páginas que abren este modal guardan su propia
  // referencia). Se actualiza a mano tras un guardado exitoso.
  const [currentRoomId, setCurrentRoomId] = useState(booking.RoomID);
  const [editingRoom, setEditingRoom] = useState(false);
  const [roomDraft, setRoomDraft] = useState(booking.RoomID);
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomError, setRoomError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listAddons(lodgeId, booking.BookingID)
      .then((res) => {
        if (!cancelled) setAddons(res.addons || []);
      })
      .catch(() => {
        if (!cancelled) setAddons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lodgeId, booking.BookingID]);

  async function handleRoomSave(e: FormEvent) {
    e.preventDefault();
    if (!roomDraft.trim() || savingRoom) return;
    setSavingRoom(true);
    setRoomError('');
    try {
      await updateBooking(booking.BookingID, { RoomID: roomDraft.trim() });
      setCurrentRoomId(roomDraft.trim());
      setEditingRoom(false);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'No se pudo cambiar la habitación');
    } finally {
      setSavingRoom(false);
    }
  }

  const addonsAmount = Number(booking.Financials.AddonsAmount || 0);
  const grandTotal = Number(booking.Financials.TotalAmount) + addonsAmount;
  const guest = guests.find((g) => g.GuestID === booking.GuestID);

  return (
    <Modal title={booking.GuestName || 'Huésped'} sub="Detalle ejecutivo de la estadía" onClose={onClose}>
      <div className="exec-detail-head">
        <span className={`pill ${booking.Status.toLowerCase()}`}>{booking.Status}</span>
        <span className={`pill ${PAYMENT_PILL[booking.Financials.PaymentStatus] || 'pending-pay'}`}>{booking.Financials.PaymentStatus}</span>
        <span className="cell-sub">
          {addonsAmount > 0 ? (
            <>
              {grandTotal.toLocaleString('es-CL')} {booking.Financials.Currency}
              {' '}
              <span style={{ opacity: 0.7 }}>
                ({Number(booking.Financials.TotalAmount).toLocaleString('es-CL')} + {addonsAmount.toLocaleString('es-CL')} extras)
              </span>
            </>
          ) : (
            <>
              {Number(booking.Financials.TotalAmount).toLocaleString('es-CL')} {booking.Financials.Currency}
            </>
          )}
        </span>
      </div>

      <div className="exec-detail-grid">
        <div className="exec-detail-item">
          <div className="post-popup-field-label">Llega</div>
          <div className="exec-detail-value">{formatDayEs(booking.CheckIn)}</div>
        </div>
        <div className="exec-detail-item">
          <div className="post-popup-field-label">Sale</div>
          <div className="exec-detail-value">{formatDayEs(booking.CheckOut)}</div>
        </div>
        <div className="exec-detail-item">
          <div className="post-popup-field-label">Noches</div>
          <div className="exec-detail-value">{nights(booking)}</div>
        </div>
        <div className="exec-detail-item">
          <div className="post-popup-field-label">{roomViews ? 'Habitación' : 'Programa'}</div>
          {editingRoom ? (
            <form onSubmit={handleRoomSave} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {roomCatalog.length ? (
                <select value={roomDraft} onChange={(e) => setRoomDraft(e.target.value)} style={{ minWidth: 140 }}>
                  {!roomCatalog.some((r) => r.room_id === roomDraft) && <option value={roomDraft}>{roomDraft}</option>}
                  {roomCatalog.map((r) => (
                    <option key={r.room_id} value={r.room_id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={roomDraft} onChange={(e) => setRoomDraft(e.target.value)} style={{ minWidth: 140 }} />
              )}
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingRoom}>
                {savingRoom ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setEditingRoom(false);
                  setRoomDraft(currentRoomId);
                  setRoomError('');
                }}
              >
                Cancelar
              </button>
            </form>
          ) : (
            <div className="exec-detail-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {currentRoomId}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 8px' }}
                onClick={() => {
                  setRoomDraft(currentRoomId);
                  setEditingRoom(true);
                }}
              >
                {roomViews ? 'Cambiar' : 'Editar'}
              </button>
            </div>
          )}
          {roomError && <div className="login-error" style={{ minHeight: 'auto', marginTop: 4 }}>{roomError}</div>}
        </div>
        <div className="exec-detail-item">
          <div className="post-popup-field-label">Personas</div>
          <div className="exec-detail-value">{booking.PartyMembers}</div>
        </div>
        <div className="exec-detail-item">
          <div className="post-popup-field-label">Origen</div>
          <div className="exec-detail-value">{booking.Source === 'Direct' ? 'Directa' : 'Canal (OTA)'}</div>
        </div>
      </div>

      {guest && (guest.Contact.Email || guest.Contact.WhatsApp || guest.OriginCountry) && (
        <div className="exec-detail-contact">
          {guest.OriginCountry && <span>{guest.OriginCountry}</span>}
          {guest.Contact.Email && <span>{guest.Contact.Email}</span>}
          {guest.Contact.WhatsApp && <span>{guest.Contact.WhatsApp}</span>}
        </div>
      )}

      <div className="post-popup-field-label" style={{ marginTop: 22, marginBottom: 10 }}>
        Experiencias programadas
      </div>
      {addons === null ? (
        <div className="cell-sub">Cargando…</div>
      ) : addons.length === 0 ? (
        <div className="cell-sub">Sin experiencias agendadas durante esta estadía.</div>
      ) : (
        <div className="result-list">
          {addons.map((a) => (
            <div className="result-list-item" key={a.AddonID}>
              <div className="exec-detail-addon-head">
                <strong style={{ color: 'var(--ink)' }}>
                  {a.ServiceName}
                  {Number(a.Price || 0) > 0 && (
                    <span className="cell-sub" style={{ marginLeft: 8, fontWeight: 400 }}>
                      {Number(a.Price).toLocaleString('es-CL')} {booking.Financials.Currency}
                    </span>
                  )}
                </strong>
                <span className="exec-detail-when">
                  {formatDayEs(a.Logistics.Date)}
                  {a.Logistics.Time && ` · ${a.Logistics.Time} hrs`}
                </span>
              </div>
              <div className="pms-route" style={{ marginTop: 8 }}>
                <span className="pms-route-base">{a.Logistics.OperationBase}</span>
                <span className="pms-route-arrow">→</span>
                <span className="pms-route-zone">{a.Logistics.GuidingZone}</span>
              </div>
              {a.Logistics.GuideAssigned && <div className="cell-sub" style={{ marginTop: 6 }}>Guía: {a.Logistics.GuideAssigned}</div>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
