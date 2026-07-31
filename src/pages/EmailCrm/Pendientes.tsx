import { useCallback, useEffect, useState } from 'react';
import { useCrmData } from '../../context/CrmDataContext';

/**
 * Lo que el equipo tiene que hacer a mano para que los journeys avancen.
 *
 * Existe porque los journeys de Chile Fly Fishing dependen de marcas manuales,
 * y no por una limitacion del motor: el cobro se hace con un payment link de
 * WeTravel, cuya API exige plan Pro. Nadie le avisa al sistema que un pago
 * entro — WeTravel manda un email al equipo y una persona lo registra.
 *
 * Sin estas marcas, 3 de los 4 tracks no arrancan nunca. Por eso viven en una
 * pantalla propia con contadores, y no como botones escondidos en el detalle de
 * un contacto: un boton que hay que ir a buscar es un boton que se olvida.
 */

interface LeadSinResponder {
  email: string;
  name: string;
  created_at: string;
  horas_restantes_sla: number | null;
  vencido: boolean;
}
interface SinConfirmar {
  email: string;
  name: string;
  tipo_programa: string;
  fecha_llegada: string;
}
interface SinVuelo {
  email: string;
  name: string;
  fecha_llegada: string;
}
interface PorCerrar {
  email: string;
  name: string;
  fecha_salida: string;
}
interface Pendientes {
  sin_responder: LeadSinResponder[];
  sin_confirmar: SinConfirmar[];
  sin_registrar_vuelo: SinVuelo[];
  por_cerrar: PorCerrar[];
  totales: Record<string, number>;
}

const VACIO: Pendientes = {
  sin_responder: [],
  sin_confirmar: [],
  sin_registrar_vuelo: [],
  por_cerrar: [],
  totales: {},
};

function Sla({ horas, vencido }: { horas: number | null; vencido: boolean }) {
  // Nunca se inventa: si no se pudo calcular, se dice, no se muestra un cero.
  if (horas === null) return <span className="cell-sub">sin fecha de creación</span>;
  if (vencido) {
    return (
      <span className="status">
        <span className="status-dot never" />
        vencido hace {Math.abs(Math.round(horas))} h
      </span>
    );
  }
  return (
    <span className="status">
      <span className="status-dot ready" />
      quedan {Math.round(horas)} h
    </span>
  );
}

export default function Pendientes() {
  const { scopedAction } = useCrmData();
  const [datos, setDatos] = useState<Pendientes>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [vuelo, setVuelo] = useState<Record<string, { numero: string; hora: string }>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await scopedAction<Pendientes>('list_pendientes_email'));
    } catch (e) {
      console.error('Error cargando pendientes de email', e);
    } finally {
      setCargando(false);
    }
  }, [scopedAction]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function marcar(accion: string, email: string, extra: Record<string, unknown> = {}) {
    setOcupado(`${accion}:${email}`);
    try {
      await scopedAction(accion, { email, ...extra });
      await cargar();
    } catch (e) {
      console.error(`Error en ${accion}`, e);
    } finally {
      setOcupado(null);
    }
  }

  const t = datos.totales;
  const nadaPendiente =
    !cargando &&
    !datos.sin_responder.length &&
    !datos.sin_confirmar.length &&
    !datos.sin_registrar_vuelo.length &&
    !datos.por_cerrar.length;

  return (
    <div>
      <div className="desc-label" style={{ marginBottom: 14 }}>
        Marcas manuales que hacen avanzar los journeys. El pago se cobra con un link de WeTravel y su
        API no avisa cuándo entra: alguien tiene que registrarlo acá.
      </div>

      <div className="kpi-strip" style={{ marginBottom: 18 }}>
        {[
          ['Sin responder', t.sin_responder, t.vencidos_sla ? `${t.vencidos_sla} vencidos` : 'dentro del SLA'],
          ['Sin confirmar pago', t.sin_confirmar, 'esperando WeTravel'],
          ['Sin registrar vuelo', t.sin_registrar_vuelo, 'ya pagaron'],
          ['Por cerrar', t.por_cerrar, 'ya volvieron'],
        ].map(([label, valor, sub]) => (
          <div key={String(label)} className="mini-card">
            <div className="desc-label">{label}</div>
            <div className="mini-card-value tabular" style={{ fontSize: 26 }}>
              {valor ?? 0}
            </div>
            <div className="cell-sub">{sub}</div>
          </div>
        ))}
      </div>

      {cargando && <div className="card empty-state">Cargando pendientes…</div>}
      {nadaPendiente && <div className="card empty-state">No hay nada pendiente. Todo al día.</div>}

      {!!datos.sin_responder.length && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div className="cell-name" style={{ marginBottom: 4 }}>Leads sin responder</div>
          <div className="cell-sub" style={{ marginBottom: 14 }}>
            Si nadie contesta, el motor manda el toque suave a las 72 h. Marcar como respondido lo cancela.
          </div>
          {datos.sin_responder.map((l) => (
            <div key={l.email} className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
              <div>
                <div className="cell-name">{l.name || l.email}</div>
                <div className="cell-sub">{l.email}</div>
              </div>
              <Sla horas={l.horas_restantes_sla} vencido={l.vencido} />
              <button
                className="btn btn-primary"
                disabled={ocupado === `marcar_lead_respondido:${l.email}`}
                onClick={() => marcar('marcar_lead_respondido', l.email)}
              >
                {ocupado === `marcar_lead_respondido:${l.email}` ? 'Marcando…' : 'Ya le respondí'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!!datos.sin_confirmar.length && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div className="cell-name" style={{ marginBottom: 4 }}>Reservas sin confirmar el pago</div>
          <div className="cell-sub" style={{ marginBottom: 14 }}>
            Al confirmar arranca toda la línea de la expedición: detalle, pre-llegada y día de viaje.
          </div>
          {datos.sin_confirmar.map((r) => (
            <div key={r.email} className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
              <div>
                <div className="cell-name">{r.name || r.email}</div>
                <div className="cell-sub">
                  {r.tipo_programa || 'sin programa'} · llega {r.fecha_llegada || 'sin fecha'}
                </div>
              </div>
              <button
                className="btn btn-primary"
                disabled={ocupado === `marcar_reserva_pagada:${r.email}`}
                onClick={() => marcar('marcar_reserva_pagada', r.email)}
              >
                {ocupado === `marcar_reserva_pagada:${r.email}` ? 'Confirmando…' : 'Confirmar pago'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!!datos.sin_registrar_vuelo.length && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div className="cell-name" style={{ marginBottom: 4 }}>Vuelos sin registrar</div>
          <div className="cell-sub" style={{ marginBottom: 14 }}>
            El pescador lo manda respondiendo al email de confirmación. Si no se registra, el email del
            día de viaje sale igual, pero por fecha de llegada en vez de por el vuelo.
          </div>
          {datos.sin_registrar_vuelo.map((v) => {
            const actual = vuelo[v.email] || { numero: '', hora: '' };
            return (
              <div key={v.email} className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', flexWrap: 'wrap' }}>
                <div>
                  <div className="cell-name">{v.name || v.email}</div>
                  <div className="cell-sub">llega {v.fecha_llegada || 'sin fecha'}</div>
                </div>
                <input
                  className="input"
                  placeholder="Vuelo (ej. LA285)"
                  value={actual.numero}
                  onChange={(e) => setVuelo({ ...vuelo, [v.email]: { ...actual, numero: e.target.value } })}
                  style={{ maxWidth: 150 }}
                />
                <input
                  className="input"
                  placeholder="Hora (ej. 14:30)"
                  value={actual.hora}
                  onChange={(e) => setVuelo({ ...vuelo, [v.email]: { ...actual, hora: e.target.value } })}
                  style={{ maxWidth: 130 }}
                />
                <button
                  className="btn btn-primary"
                  disabled={!actual.numero.trim() || ocupado === `guardar_datos_vuelo:${v.email}`}
                  onClick={() => marcar('guardar_datos_vuelo', v.email, { numero_vuelo: actual.numero, hora_llegada: actual.hora })}
                >
                  {ocupado === `guardar_datos_vuelo:${v.email}` ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!!datos.por_cerrar.length && (
        <div className="card" style={{ padding: 20 }}>
          <div className="cell-name" style={{ marginBottom: 4 }}>Expediciones por cerrar</div>
          <div className="cell-sub" style={{ marginBottom: 14 }}>
            Ya pasó la fecha de salida. Al cerrar sale el agradecimiento y, a la semana, el pedido de reseña.
          </div>
          {datos.por_cerrar.map((e) => (
            <div key={e.email} className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
              <div>
                <div className="cell-name">{e.name || e.email}</div>
                <div className="cell-sub">salió {e.fecha_salida}</div>
              </div>
              <button
                className="btn btn-primary"
                disabled={ocupado === `marcar_viaje_terminado:${e.email}`}
                onClick={() => marcar('marcar_viaje_terminado', e.email)}
              >
                {ocupado === `marcar_viaje_terminado:${e.email}` ? 'Cerrando…' : 'Cerrar expedición'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
