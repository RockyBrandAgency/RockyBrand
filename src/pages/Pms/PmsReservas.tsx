import { Fragment, useState } from 'react';
import { usePmsData } from '../../context/PmsDataContext';
import { listAddons } from '../../pmsApi';
import Reveal from '../../components/Reveal';
import NewBookingModal from './NewBookingModal';
import NewAddonModal from './NewAddonModal';
import BookingDetailModal from './BookingDetailModal';
import type { PmsAddon, PmsBooking } from '../../types';

function nights(booking: PmsBooking) {
  const ms = new Date(booking.CheckOut).getTime() - new Date(booking.CheckIn).getTime();
  return Math.round(ms / 86400000);
}

const SOURCE_LABEL: Record<string, string> = { Direct: 'Directa', OTA_Headless: 'Canal (OTA)' };
const PAYMENT_PILL: Record<string, string> = { PAID: 'paid', PENDING: 'pending-pay', PARTIAL: 'partial', REFUNDED: 'refunded' };

export default function PmsReservas() {
  const { bookings, loading, loadError, lodgeId, pmsFeatures, refetch } = usePmsData();
  const roomViews = pmsFeatures ? pmsFeatures.pms_room_views : true;
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addonsByBooking, setAddonsByBooking] = useState<Record<string, PmsAddon[]>>({});
  const [addonsLoading, setAddonsLoading] = useState<string | null>(null);
  const [addonModalFor, setAddonModalFor] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<PmsBooking | null>(null);

  const sorted = [...bookings].sort((a, b) => b.CheckIn.localeCompare(a.CheckIn));

  async function toggleExpand(bookingId: string) {
    if (expanded === bookingId) {
      setExpanded(null);
      return;
    }
    setExpanded(bookingId);
    if (!addonsByBooking[bookingId]) {
      setAddonsLoading(bookingId);
      try {
        const res = await listAddons(lodgeId, bookingId);
        setAddonsByBooking((prev) => ({ ...prev, [bookingId]: res.addons || [] }));
      } catch {
        setAddonsByBooking((prev) => ({ ...prev, [bookingId]: [] }));
      } finally {
        setAddonsLoading(null);
      }
    }
  }

  async function refreshAddons(bookingId: string) {
    const res = await listAddons(lodgeId, bookingId);
    setAddonsByBooking((prev) => ({ ...prev, [bookingId]: res.addons || [] }));
    // Un add-on con precio cambia Financials.AddonsAmount de la reserva -
    // refetch de la lista completa para que la columna Total lo refleje sin
    // que el staff tenga que recargar la página a mano.
    await refetch();
  }

  return (
    <Reveal>
      <div className="crm-toolbar">
        <div className="section-title" style={{ margin: 0 }}>
          Reservas ({bookings.length})
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
          + Nueva reserva
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Cargando…</div>
      ) : loadError ? (
        <div className="empty-state">No se pudo conectar con el PMS.</div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          Todavía no hay reservas registradas en este lodge.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(true)}>
              Crear la primera
            </button>
          </div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Huésped</th>
              <th>{roomViews ? 'Cabaña' : 'Programa'}</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Noches</th>
              <th>Pax</th>
              <th>Estado</th>
              <th>Origen</th>
              <th>Pago</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const isOpen = expanded === b.BookingID;
              const addons = addonsByBooking[b.BookingID];
              return (
                <Fragment key={b.BookingID}>
                  <tr className="row-clickable" onClick={() => toggleExpand(b.BookingID)}>
                    <td className="cell-name">{b.GuestName}</td>
                    <td>{b.RoomID}</td>
                    <td className="tabular">{b.CheckIn}</td>
                    <td className="tabular">{b.CheckOut}</td>
                    <td className="tabular">{nights(b)}</td>
                    <td className="tabular">{b.PartyMembers}</td>
                    <td>
                      <span className={`pill ${b.Status.toLowerCase()}`}>{b.Status}</span>
                    </td>
                    <td className="cell-sub">{SOURCE_LABEL[b.Source] || b.Source}</td>
                    <td>
                      <span className={`pill ${PAYMENT_PILL[b.Financials.PaymentStatus] || 'pending-pay'}`}>{b.Financials.PaymentStatus}</span>
                    </td>
                    <td className="tabular">
                      {(Number(b.Financials.TotalAmount) + Number(b.Financials.AddonsAmount || 0)).toLocaleString('es-CL')} {b.Financials.Currency}
                      {Number(b.Financials.AddonsAmount || 0) > 0 && (
                        <div className="cell-sub">+{Number(b.Financials.AddonsAmount).toLocaleString('es-CL')} extras</div>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailFor(b);
                        }}
                      >
                        Detalle
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={11} style={{ background: 'rgba(255,255,255,0.015)' }}>
                        <div className="addon-panel">
                          <div className="addon-panel-head">
                            <span className="desc-label" style={{ margin: 0 }}>
                              Experiencias de esta reserva
                            </span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddonModalFor(b.BookingID);
                              }}
                            >
                              + Agregar experiencia
                            </button>
                          </div>
                          {addonsLoading === b.BookingID ? (
                            <div className="cell-sub">Cargando…</div>
                          ) : !addons || addons.length === 0 ? (
                            <div className="cell-sub">Sin experiencias agregadas todavía.</div>
                          ) : (
                            <div className="result-list">
                              {addons.map((a) => (
                                <div className="result-list-item" key={a.AddonID}>
                                  <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 6 }}>
                                    {a.ServiceName}
                                    {Number(a.Price || 0) > 0 && (
                                      <span className="cell-sub" style={{ marginLeft: 8, fontWeight: 400 }}>
                                        {Number(a.Price).toLocaleString('es-CL')} {b.Financials.Currency}
                                      </span>
                                    )}
                                  </div>
                                  <div className="pms-route">
                                    <span className="pms-route-base">{a.Logistics.OperationBase}</span>
                                    <span className="pms-route-arrow">→</span>
                                    <span className="pms-route-zone">{a.Logistics.GuidingZone}</span>
                                  </div>
                                  <div className="cell-sub" style={{ marginTop: 6 }}>
                                    {a.Logistics.Date}
                                    {a.Logistics.Time && ` · ${a.Logistics.Time} hrs`}
                                    {a.Logistics.GuideAssigned && ` · Guía: ${a.Logistics.GuideAssigned}`}
                                    {' · '}
                                    <span className={`pill ${a.Status.toLowerCase()}`}>{a.Status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {showNew && <NewBookingModal onClose={() => setShowNew(false)} />}
      {detailFor && <BookingDetailModal booking={detailFor} onClose={() => setDetailFor(null)} />}
      {addonModalFor && (
        <NewAddonModal
          bookingId={addonModalFor}
          onClose={() => setAddonModalFor(null)}
          onCreated={() => refreshAddons(addonModalFor)}
        />
      )}
    </Reveal>
  );
}
