import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { usePanelData } from '../context/PanelDataContext';
import {
  getStrategyPendiente,
  aprobarEstrategia,
  rechazarEstrategia,
  getCalendarioPendiente,
  aprobarCalendario,
  rechazarCalendario,
} from '../api';
import type {
  StrategyPendienteResponse,
  CalendarioPendienteResponse,
  MandatoDeAgente,
} from '../types';

/**
 * Aprobaciones estratégicas.
 *
 * Dos cosas esperan visto bueno acá y las dos son el mismo patrón: el agente
 * propone, un humano aprueba, y hasta que aprueba NADA aguas abajo lo
 * consume.
 *
 * Por qué existe esta pantalla: un error en la estrategia de Rox sesga a
 * cinco agentes por un mes. Revisarla cuesta cinco minutos y evita corregir
 * treinta piezas nacidas de una estrategia equivocada. Es el punto del
 * sistema donde una revisión humana rinde más.
 *
 * Lo que NO hace, a propósito: no muestra las piezas una por una. El
 * calendario se aprueba por su ESTRUCTURA — pilares y distribución — y
 * recién ahí las piezas entran a revisión individual, en la pantalla del
 * cliente. Mandar todo junto a revisión sin escalonar por riesgo produce
 * fatiga del revisor y aprobaciones de trámite.
 */

/**
 * Aviso dentro de una tarjeta. No se usa `.empty-state` para esto: esa clase
 * centra el texto y le pone 36px de padding porque está pensada para "acá no
 * hay nada", y un aviso dentro de una tarjeta con contenido se veía flotando
 * en el medio.
 */
const AVISO: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'rgba(0,0,0,0.2)',
  fontSize: 12.5,
  color: 'var(--dim)',
};

const NOMBRE_DE_AGENTE: Record<string, string> = {
  cameron_mandate: 'Cameron · research',
  dave_mandate: 'Dave · contenido',
  jimi_mandate: 'Jimi · arte',
  thelma_mandate: 'Thelma · video',
  slash_mandate: 'Slash · SEO',
};

function esMandatoNuevo(m: MandatoDeAgente | string): m is MandatoDeAgente {
  return typeof m === 'object' && m !== null && 'directiva' in m;
}

function fechaCorta(iso?: string | null) {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

/** Caja de rechazo. El motivo es obligatorio y el backend lo vuelve a validar. */
function Rechazo({ onCancelar, onConfirmar, ocupado }: {
  onCancelar: () => void;
  onConfirmar: (motivo: string) => void;
  ocupado: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <div style={{ marginTop: 14 }}>
      <textarea
        className="agent-prompt-textarea"
        rows={3}
        style={{ minHeight: 78 }}
        placeholder="Qué hay que corregir. Sin esto el agente no tiene con qué replanificar."
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={!motivo.trim() || ocupado}
          onClick={() => onConfirmar(motivo.trim())}
        >
          Confirmar rechazo
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function Aprobaciones() {
  const { projects } = usePanelData();
  const [projectId, setProjectId] = useState('');
  const [estrategia, setEstrategia] = useState<StrategyPendienteResponse | null>(null);
  const [calendario, setCalendario] = useState<CalendarioPendienteResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [rechazando, setRechazando] = useState<'estrategia' | 'calendario' | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const cargar = (id: string) => {
    if (!id) return;
    setCargando(true);
    setError('');
    setAviso('');
    setRechazando(null);
    Promise.all([getStrategyPendiente(id), getCalendarioPendiente(id)])
      .then(([e, c]) => {
        setEstrategia(e);
        setCalendario(c);
      })
      .catch((e) => setError(e?.message || 'No se pudo cargar'))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const accion = async (fn: () => Promise<unknown>, mensaje: string) => {
    setOcupado(true);
    setError('');
    try {
      await fn();
      setAviso(mensaje);
      cargar(projectId);
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo completar');
    } finally {
      setOcupado(false);
    }
  };

  const est = estrategia?.pendiente;
  const cal = calendario?.calendario;
  const sinNada = !cargando && !est && !cal;

  return (
    <div className="main">
      <div className="eyebrow">General</div>
      <div className="page-title">Aprobaciones</div>
      <div className="page-sub">
        Lo que los agentes proponen y espera tu visto bueno. Mientras algo está acá, los agentes
        siguen trabajando con lo aprobado antes — nada se bloquea esperando.
      </div>

      <div className="lodge-switcher" style={{ marginTop: 22, width: 'fit-content' }}>
        <span className="lodge-switcher-label">Cliente</span>
        <select
          className="lodge-switcher-select"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <div style={{ ...AVISO, marginTop: 20, borderColor: 'var(--ochre)' }}>{error}</div>}
      {aviso && <div style={{ ...AVISO, marginTop: 20 }}>{aviso}</div>}
      {cargando && <div className="empty-state" style={{ marginTop: 20 }}>Cargando…</div>}
      {sinNada && !error && (
        <div className="empty-state" style={{ marginTop: 20 }}>
          Nada pendiente de aprobación para este cliente.
        </div>
      )}

      {/* ---------------------------------------------- estrategia de Rox --- */}
      {est && (
        <>
          <div className="section-head" style={{ marginTop: 36 }}>
            <span className="section-title">Estrategia de Rox</span>
            <span className="pill scheduled"><span className="pill-dot" /> Pendiente</span>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 14 }}>
              Generada el {fechaCorta(estrategia?.pendiente_generada_at)}
              {estrategia?.vigente && ` · la vigente es del ${fechaCorta(estrategia.vigente_generada_at)}`}
            </div>

            {/*
              El modo limitado se muestra ARRIBA de todo y no al final: una
              estrategia construida sobre objetivos comerciales vencidos o
              ausentes hay que verla antes de aprobarla, no después.
            */}
            {est.estrategia_sin_objetivos_confirmados &&
              est.estrategia_sin_objetivos_confirmados !== 'false' && (
                <div style={{ ...AVISO, marginBottom: 18, borderColor: 'var(--ochre)' }}>
                  <strong style={{ color: 'var(--ochre)' }}>Modo limitado.</strong>{' '}
                  {typeof est.estrategia_sin_objetivos_confirmados === 'string'
                    ? est.estrategia_sin_objetivos_confirmados
                    : 'Se generó sin objetivos comerciales confirmados.'}
                </div>
              )}

            <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 6 }}>Norte de marca</div>
            <div style={{ marginBottom: 18 }}>{est.brand_os?.north_star_statement}</div>

            <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 6 }}>
              Balance de la estrategia anterior
            </div>
            <div style={{ marginBottom: 18, display: 'grid', gap: 8 }}>
              <div><span style={{ color: 'var(--dim)' }}>Qué mandaté: </span>{est.balance_estrategia_anterior?.que_mandate}</div>
              <div><span style={{ color: 'var(--dim)' }}>Qué dice Neil que pasó: </span>{est.balance_estrategia_anterior?.que_dice_neil_que_paso}</div>
              <div><span style={{ color: 'var(--dim)' }}>Qué sostengo: </span>{est.balance_estrategia_anterior?.que_sostengo}</div>
              <div><span style={{ color: 'var(--dim)' }}>Qué corrijo: </span>{est.balance_estrategia_anterior?.que_corrijo}</div>
            </div>

            <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 10 }}>Mandatos por agente</div>
            <div className="result-list">
              {Object.entries(est.agent_mandates || {}).map(([clave, mandato]) => (
                <div className="result-list-item" key={clave}>
                  <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 6 }}>
                    {NOMBRE_DE_AGENTE[clave] || clave}
                  </div>
                  {esMandatoNuevo(mandato) ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div>{mandato.directiva}</div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: 'var(--dim)' }}>Por qué: </span>{mandato.hipotesis}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: 'var(--dim)' }}>Cómo se mide: </span>{mandato.criterio_verificacion}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>{mandato}</div>
                      {/* Formato anterior al 2026-08-11: sin hipótesis ni criterio. */}
                      <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
                        Formato anterior: sin hipótesis ni criterio de verificación.
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {est.data_gaps && est.data_gaps.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 6 }}>
                  Pendientes que Rox detectó ({est.data_gaps.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {est.data_gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}

            {rechazando === 'estrategia' ? (
              <Rechazo
                ocupado={ocupado}
                onCancelar={() => setRechazando(null)}
                onConfirmar={(motivo) =>
                  accion(() => rechazarEstrategia(projectId, motivo),
                    'Estrategia rechazada. Los agentes siguen con la anterior.')}
              />
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                  className="btn btn-primary"
                  disabled={ocupado}
                  onClick={() => accion(() => aprobarEstrategia(projectId),
                    'Estrategia aprobada. Desde ahora los cinco agentes la usan.')}
                >
                  Aprobar
                </button>
                <button className="btn btn-ghost" disabled={ocupado} onClick={() => setRechazando('estrategia')}>
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ------------------------------------------ calendario de la semana --- */}
      {cal && (
        <>
          <div className="section-head" style={{ marginTop: 36 }}>
            <span className="section-title">Calendario semanal de Dave</span>
            <span className="pill scheduled"><span className="pill-dot" /> Pendiente</span>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 14 }}>
              Semana del {cal.semana_desde} al {cal.semana_hasta} · {cal.piezas?.length ?? 0} piezas
            </div>

            <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 6 }}>Por qué esta distribución</div>
            <div style={{ marginBottom: 18 }}>{cal.por_que_esta_distribucion}</div>

            <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 6 }}>Pilares de la semana</div>
            <div style={{ marginBottom: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(cal.pilares_de_la_semana || []).map((p, i) => (
                <span className="pill draft" key={i}>{p}</span>
              ))}
            </div>

            <div className="result-list">
              {(cal.piezas || []).map((pieza, i) => (
                <div className="result-list-item" key={i}>
                  <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}>
                    {pieza.fecha} · {pieza.dia_y_hora_propuestos?.dia || pieza.dia_sugerido || ''}
                    {pieza.dia_y_hora_propuestos?.hora ? ` ${pieza.dia_y_hora_propuestos.hora}` : ''}
                  </div>
                  <div style={{ marginBottom: 6 }}>{pieza.concepto}</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {(pieza.adaptaciones || []).map((a) => a.plataforma).filter(Boolean).join(' · ')}
                    {pieza.objetivo ? ` — ${pieza.objetivo}` : ''}
                  </div>
                  {/*
                    El desvío del mandato se marca en rojo. D1: el mandato es
                    orientativo y Dave PUEDE apartarse, pero el desvío tiene
                    que ser visible, no quedar sepultado en un campo de texto.
                  */}
                  {pieza.cumple_mandato_de_rox?.startsWith('DESVIO:') && (
                    <div style={{ fontSize: 12, marginTop: 6, color: 'var(--ochre)' }}>
                      {pieza.cumple_mandato_de_rox}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 14 }}>
              Al aprobar, cada pieza pasa a revisión individual antes de producirse.
            </div>

            {rechazando === 'calendario' ? (
              <Rechazo
                ocupado={ocupado}
                onCancelar={() => setRechazando(null)}
                onConfirmar={(motivo) =>
                  accion(() => rechazarCalendario(projectId, motivo),
                    'Semana rechazada. No se creó ninguna pieza.')}
              />
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                  className="btn btn-primary"
                  disabled={ocupado}
                  onClick={() => accion(async () => {
                    const r = await aprobarCalendario(projectId);
                    if (!r.piezas_solicitadas) throw new Error(r.nota);
                  }, 'Semana aprobada. Las piezas se están creando para revisión.')}
                >
                  Aprobar la semana
                </button>
                <button className="btn btn-ghost" disabled={ocupado} onClick={() => setRechazando('calendario')}>
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
