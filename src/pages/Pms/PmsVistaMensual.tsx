import { useCallback, useEffect, useState } from 'react';
import { usePmsData } from '../../context/PmsDataContext';
import { getMonthlyOverview } from '../../pmsApi';
import { UnauthorizedError } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Reveal from '../../components/Reveal';
import type { PmsMonthlyOverview } from '../../types';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function addMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function weekRangeLabel(dias: string[]) {
  if (!dias.length) return '';
  const first = dias[0].slice(8, 10);
  const last = dias[dias.length - 1].slice(8, 10);
  return dias.length === 1 ? `Día ${first}` : `${first} – ${last}`;
}

export default function PmsVistaMensual() {
  const { lodgeId } = usePmsData();
  const { handleUnauthorized } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<PmsMonthlyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    (y: number, m: number) => {
      setLoading(true);
      setError(false);
      setDisabled(false);
      getMonthlyOverview(lodgeId, y, m)
        .then((res) => setData(res))
        .catch((e) => {
          if (e instanceof UnauthorizedError) return handleUnauthorized();
          if (e instanceof Error && /no est[aá] habilitada/i.test(e.message)) {
            setDisabled(true);
            return;
          }
          setError(true);
        })
        .finally(() => setLoading(false));
    },
    [lodgeId, handleUnauthorized]
  );

  useEffect(() => {
    load(year, month);
  }, [year, month, load]);

  function shift(delta: number) {
    const next = addMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  return (
    <Reveal>
      <div className="itinerary-daynav">
        <button className="btn btn-ghost btn-sm" onClick={() => shift(-1)}>
          ← Mes anterior
        </button>
        <div className="itinerary-daynav-current">
          <span className="itinerary-daynav-label">
            {MESES[month - 1]} {year}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => shift(1)}>
          Mes siguiente →
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Cargando…</div>
      ) : disabled ? (
        <div className="empty-state">
          La vista mensual no está habilitada para este cliente todavía — actívala en Agentes → Asignación por
          cliente → Servicios contratados → PMS → Habitaciones.
        </div>
      ) : error ? (
        <div className="empty-state">No se pudo cargar la vista mensual.</div>
      ) : !data || data.semanas.length === 0 ? (
        <div className="empty-state">Sin datos para este mes.</div>
      ) : (
        <div className="result-list">
          {data.semanas.map((semana) => (
            <div className="result-list-item" key={semana.semana_iso}>
              <div className="itinerary-guest-row">
                <strong style={{ color: 'var(--ink)' }}>Semana {weekRangeLabel(semana.dias)}</strong>
                <span className="itinerary-stay-badge staying">
                  {semana.viajeros.cantidad_llegadas} {semana.viajeros.cantidad_llegadas === 1 ? 'llegada' : 'llegadas'}
                </span>
              </div>

              {semana.viajeros.detalle.length > 0 && (
                <div className="cell-sub" style={{ margin: '6px 0 10px' }}>
                  {semana.viajeros.detalle.map((v) => (
                    <div key={v.BookingID}>
                      {v.FullName} · {v.RoomID} · llega {v.CheckIn.slice(8, 10)}
                    </div>
                  ))}
                </div>
              )}

              {semana.habitaciones.length > 0 && (
                <div className="pms-month-legend" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  {semana.habitaciones.map((h) => (
                    <span key={h.room_id} className="tabular">
                      {h.room_id}: {h.noches_ocupadas}/{h.noches_totales} noches
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Reveal>
  );
}
