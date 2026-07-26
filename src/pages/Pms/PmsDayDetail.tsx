import Modal from '../../components/Modal';
import type { PmsBooking } from '../../types';

function formatDayEs(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function PmsDayDetail({
  date,
  bookings,
  freeRoomLabels,
  onSelectBooking,
  onClose,
}: {
  date: string;
  bookings: PmsBooking[];
  freeRoomLabels: string[];
  onSelectBooking: (b: PmsBooking) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={formatDayEs(date)} sub={bookings.length ? `${bookings.length} habitación(es) ocupada(s)` : 'Sin reservas este día'} onClose={onClose}>
      {bookings.length > 0 && (
        <div className="result-list">
          {bookings.map((b) => (
            <button key={b.BookingID} className="result-list-item pms-day-detail-row" onClick={() => onSelectBooking(b)}>
              <div>
                <strong style={{ color: 'var(--ink)' }}>{b.GuestName || 'Huésped'}</strong>
                <div className="cell-sub">{b.RoomID}</div>
              </div>
              <span className={`pill ${b.Status.toLowerCase()}`}>{b.Status}</span>
            </button>
          ))}
        </div>
      )}

      {freeRoomLabels.length > 0 && (
        <>
          <div className="post-popup-field-label" style={{ marginTop: bookings.length ? 22 : 0, marginBottom: 10 }}>
            Habitaciones libres
          </div>
          <div className="pms-day-detail-free">
            {freeRoomLabels.map((label) => (
              <span key={label} className="calendar-tag contrast">
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
