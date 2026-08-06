import { useState, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import { usePmsData } from '../../context/PmsDataContext';

export default function NewBookingModal({ onClose }: { onClose: () => void }) {
  const { guests, createBooking, pmsFeatures } = usePmsData();
  // Clientes sin habitaciones (pms_room_views apagado, ej. viajes guiados)
  // igual necesitan un RoomID - el backend lo exige (pms_models.Booking) -
  // pero acá no tiene sentido pedirles una "cabaña": se relabela para que
  // el staff anote el programa/actividad en el mismo campo.
  const roomViews = pmsFeatures ? pmsFeatures.pms_room_views : true;
  const [guestId, setGuestId] = useState(guests[0]?.GuestID || '');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [partyMembers, setPartyMembers] = useState('2');
  const [currency, setCurrency] = useState('CLP');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = guestId && roomId.trim() && checkIn && checkOut && checkOut > checkIn;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setError('');
    try {
      await createBooking({
        GuestID: guestId,
        RoomID: roomId.trim(),
        CheckIn: checkIn,
        CheckOut: checkOut,
        PartyMembers: Number(partyMembers) || 1,
        Financials: { Currency: currency, TotalAmount: Number(totalAmount) || 0, PaymentStatus: paymentStatus },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la reserva');
    } finally {
      setSaving(false);
    }
  }

  if (!guests.length) {
    return (
      <Modal title="Nueva reserva" onClose={onClose}>
        <div className="modal-hint">Todavía no hay huéspedes registrados. Creá un huésped primero desde la pestaña Huéspedes.</div>
        <div className="send-actions" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nueva reserva" sub="Reserva directa (llamada, mail, walk-in) — se marca automáticamente como origen Direct." onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="crm-field">
          <label>Huésped</label>
          <select value={guestId} onChange={(e) => setGuestId(e.target.value)}>
            {guests.map((g) => (
              <option key={g.GuestID} value={g.GuestID}>
                {g.FullName}
              </option>
            ))}
          </select>
        </div>
        <div className="crm-field">
          <label>{roomViews ? 'Cabaña / habitación' : 'Programa / actividad'}</label>
          <input
            autoFocus
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder={roomViews ? 'Ej. Cabaña Sur' : 'Ej. Pesca con mosca 3 días'}
          />
        </div>
        <div className="modal-row-3">
          <div className="crm-field">
            <label>Check-in</label>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="crm-field">
            <label>Check-out</label>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <div className="crm-field">
            <label>Personas</label>
            <input type="number" min="1" value={partyMembers} onChange={(e) => setPartyMembers(e.target.value)} />
          </div>
        </div>
        <div className="modal-row-3">
          <div className="crm-field">
            <label>Moneda</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="crm-field">
            <label>Total</label>
            <input type="number" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="crm-field">
            <label>Estado de pago</label>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PAID">Pagado</option>
              <option value="REFUNDED">Reembolsado</option>
            </select>
          </div>
        </div>
        {checkIn && checkOut && checkOut <= checkIn && <div className="modal-hint">El check-out debe ser posterior al check-in.</div>}
        {error && <div className="login-error" style={{ minHeight: 'auto' }}>{error}</div>}
        <div className="send-actions" style={{ marginTop: 18 }}>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || saving}>
            {saving ? 'Guardando…' : 'Crear reserva'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
