import { useEffect, useState } from 'react';
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
  const { lodgeId, guests, pmsFeatures } = usePmsData();
  const roomViews = pmsFeatures ? pmsFeatures.pms_room_views : true;
  const [addons, setAddons] = useState<PmsAddon[] | null>(null);

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

  const guest = guests.find((g) => g.GuestID === booking.GuestID);

  return (
    <Modal title={booking.GuestName || 'Huésped'} sub="Detalle ejecutivo de la estadía" onClose={onClose}>
      <div className="exec-detail-head">
        <span className={`pill ${booking.Status.toLowerCase()}`}>{booking.Status}</span>
        <span className={`pill ${PAYMENT_PILL[booking.Financials.PaymentStatus] || 'pending-pay'}`}>{booking.Financials.PaymentStatus}</span>
        <span className="cell-sub">
          {Number(booking.Financials.TotalAmount).toLocaleString('es-CL')} {booking.Financials.Currency}
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
          <div className="exec-detail-value">{booking.RoomID}</div>
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
                <strong style={{ color: 'var(--ink)' }}>{a.ServiceName}</strong>
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
