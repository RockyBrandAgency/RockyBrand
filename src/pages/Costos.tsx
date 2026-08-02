import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Reveal from '../components/Reveal';
import {
  deleteFixedCost,
  getCostsOverview,
  refreshCostsNow,
  saveClientRevenue,
  saveFixedCost,
} from '../api';
import type { AwsMonth, CostsOverview, FixedCost } from '../types';

// ---------------------------------------------------------------- formato --

/** Sin redondeo a centavos: Lambda gasta del orden de USD 0,00002 y
 *  mostrarlo como "$0,00" sería justo el cero disfrazado que no queremos.
 *  Los decimales se adaptan al tamaño del número. */
function usd(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v === 0) return '$0';
  const abs = Math.abs(v);
  if (abs < 0.000001) return v > 0 ? '<$0,000001' : '>-$0,000001';
  const dec = abs >= 0.01 ? 2 : 6;
  return `$${v.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function clp(v: number | null | undefined, tasa: number | null): string {
  if (v === null || v === undefined || tasa === null) return '—';
  return `$${Math.round(v * tasa).toLocaleString('es-CL')}`;
}

function num(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('es-CL');
}

function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** "actualizado hace X" a partir del collected_at que escribe el recolector. */
function hace(iso: string | null | undefined): string {
  if (!iso) return 'sin fecha';
  const t = Date.parse(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (Number.isNaN(t)) return 'sin fecha';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function mesLargo(periodo: string): string {
  const [a, m] = periodo.split('-');
  return `${MESES[parseInt(m, 10) - 1] ?? periodo} ${a}`;
}

// ------------------------------------------------------- barras de AWS (SVG) --

/** Gráfico a mano, sin librerías: barras horizontales de uso bruto por
 *  servicio. Muestra TODOS los servicios, incluidos los que no llegan a un
 *  centavo — "quiero saber cada centavo" (Mato, 2026-08-02). */
function BarrasAws({ mes }: { mes: AwsMonth }) {
  const lineas = mes.servicios
    .map((s) => ({ ...s, bruto: s.uso + s.soporte + s.otro }))
    .filter((s) => s.bruto !== 0)
    .sort((a, b) => b.bruto - a.bruto);
  if (!lineas.length) return <div className="empty-state">Sin movimiento registrado en {mesLargo(mes.periodo)}.</div>;

  const max = Math.max(...lineas.map((s) => Math.abs(s.bruto)));
  const alto = 26;

  return (
    <div className="costos-barras-wrap">
      <svg
        className="costos-barras"
        width="100%"
        height={lineas.length * alto + 8}
        viewBox={`0 0 100 ${lineas.length * alto + 8}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Uso bruto de AWS por servicio en ${mesLargo(mes.periodo)}`}
      >
        {lineas.map((s, i) => (
          <rect
            key={s.servicio}
            x="0"
            y={i * alto + 4}
            width={max > 0 ? Math.max((Math.abs(s.bruto) / max) * 100, 0.4) : 0.4}
            height={alto - 12}
            rx="1.5"
            className={s.credito !== 0 ? 'costos-barra costos-barra-cubierta' : 'costos-barra'}
          />
        ))}
      </svg>
      <div className="costos-barras-labels" style={{ ['--fila' as string]: `${alto}px` }}>
        {lineas.map((s) => (
          <div className="costos-barra-fila" key={s.servicio} style={{ height: alto }}>
            <span className="costos-barra-nombre">{s.servicio}</span>
            <span className="costos-barra-valor tabular">{usd(s.bruto)}</span>
            <span className="costos-barra-credito tabular">
              {s.credito !== 0 ? `${usd(s.credito)} crédito` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------- modal suscripción --

const VACIA = {
  nombre: '', monto: '', moneda: 'USD' as const, ciclo: 'mensual' as const,
  dia_cobro: '', icono: '', nota: '',
};

function ModalSuscripcion({
  inicial, onCerrar, onGuardado,
}: {
  inicial: FixedCost | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [f, setF] = useState(() =>
    inicial
      ? {
          nombre: inicial.nombre, monto: String(inicial.monto),
          moneda: inicial.moneda, ciclo: inicial.ciclo,
          dia_cobro: inicial.dia_cobro ? String(inicial.dia_cobro) : '',
          icono: inicial.icono ?? '', nota: inicial.nota ?? '',
        }
      : { ...VACIA }
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);
    const monto = Number(f.monto.replace(',', '.'));
    if (!f.nombre.trim()) return setError('Ponle un nombre.');
    if (!Number.isFinite(monto) || monto < 0) return setError('El monto tiene que ser un número positivo.');
    setGuardando(true);
    try {
      await saveFixedCost({
        nombre: f.nombre.trim(),
        monto,
        moneda: f.moneda,
        ciclo: f.ciclo,
        dia_cobro: f.dia_cobro ? Number(f.dia_cobro) : null,
        icono: f.icono || null,
        nota: f.nota || null,
        slug: inicial ? inicial.cost_id.replace('subscription#', '') : undefined,
      });
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="login-overlay" onClick={onCerrar}>
      <div className="modal-box card" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">{inicial ? 'Editar suscripción' : 'Nueva suscripción'}</div>
        <div className="modal-sub">
          Costo fijo: lo pagas exista o no un cliente. Se guarda en su moneda original
          y se convierte a USD con el tipo de cambio del día para el total.
        </div>

        <div className="crm-field">
          <label>Nombre</label>
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })}
                 placeholder="Claude Code MAX" />
        </div>

        <div className="modal-row-3">
          <div className="crm-field">
            <label>Monto</label>
            <input value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })}
                   inputMode="decimal" placeholder="100000" />
          </div>
          <div className="crm-field">
            <label>Moneda</label>
            <select value={f.moneda} onChange={(e) => setF({ ...f, moneda: e.target.value as 'USD' | 'CLP' })}>
              <option value="USD">USD</option>
              <option value="CLP">CLP</option>
            </select>
          </div>
          <div className="crm-field">
            <label>Ciclo</label>
            <select value={f.ciclo} onChange={(e) => setF({ ...f, ciclo: e.target.value as 'mensual' | 'anual' })}>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        </div>

        <div className="modal-row-3">
          <div className="crm-field">
            <label>Día de cobro</label>
            <input value={f.dia_cobro} onChange={(e) => setF({ ...f, dia_cobro: e.target.value })}
                   inputMode="numeric" placeholder="1" />
          </div>
          <div className="crm-field">
            <label>Ícono</label>
            <input value={f.icono} onChange={(e) => setF({ ...f, icono: e.target.value })} placeholder="◆" />
          </div>
          <div className="crm-field">
            <label>Nota</label>
            <input value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })}
                   placeholder="opcional" />
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="send-actions">
          <button className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- la página --

export default function Costos() {
  const [datos, setDatos] = useState<CostsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<'USD' | 'CLP'>('USD');
  const [modal, setModal] = useState<{ abierto: boolean; inicial: FixedCost | null }>({ abierto: false, inicial: null });
  const [refrescando, setRefrescando] = useState(false);
  const [editandoPago, setEditandoPago] = useState<string | null>(null);
  const [valorPago, setValorPago] = useState('');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await getCostsOverview());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la sección de costos.');
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const tasa = datos?.tipo_cambio?.valor_clp ?? null;
  const money = useMemo(
    () => (v: number | null | undefined) => (moneda === 'CLP' ? clp(v, tasa) : usd(v)),
    [moneda, tasa]
  );

  async function actualizarAhora() {
    const ok = window.confirm(
      'Consultar Cost Explorer cuesta USD 0,01 por consulta.\n\n' +
      'Los datos de AWS tienen ~24 h de retraso, así que actualizar ahora ' +
      'no traerá el gasto de hoy.\n\n¿Actualizar igual?'
    );
    if (!ok) return;
    setRefrescando(true);
    try {
      await refreshCostsNow();
      // El recolector corre asincrónico: se le da un margen antes de releer.
      setTimeout(() => { void cargar(); setRefrescando(false); }, 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo disparar el recolector.');
      setRefrescando(false);
    }
  }

  async function guardarPago(clientId: string) {
    const monto = Number(valorPago.replace(',', '.'));
    if (!Number.isFinite(monto) || monto < 0) return;
    await saveClientRevenue(clientId, monto);
    setEditandoPago(null);
    void cargar();
  }

  if (error) {
    return (
      <div className="main">
        <div className="page-title">Costos</div>
        <div className="empty-state">{error}</div>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="main">
        <div className="page-title">Costos</div>
        <div className="page-sub">Cargando lo que dejó el recolector…</div>
      </div>
    );
  }

  const r = datos.resumen;
  const awsMes = datos.aws.mes_actual;
  const awsAnterior = datos.aws.mes_anterior;
  const claude = datos.claude.mes_actual;

  return (
    <div className="main">
      <div className="page-header costos-header">
        <div>
          <div className="page-title">Costos</div>
          <div className="page-sub">
            Solo agencia · {mesLargo(datos.mes_actual)} ·{' '}
            {datos.ultima_corrida
              ? `actualizado ${hace(datos.ultima_corrida.collected_at)}`
              : 'el recolector todavía no ha corrido'}
          </div>
        </div>
        <div className="costos-toolbar">
          <div className="range-pills">
            <button className={`range-pill${moneda === 'USD' ? ' current' : ''}`} onClick={() => setMoneda('USD')}>USD</button>
            <button className={`range-pill${moneda === 'CLP' ? ' current' : ''}`}
                    onClick={() => setMoneda('CLP')} disabled={tasa === null}>CLP</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={actualizarAhora} disabled={refrescando}>
            {refrescando ? 'Actualizando…' : 'Actualizar ahora'}
          </button>
        </div>
      </div>

      {moneda === 'CLP' && datos.tipo_cambio && (
        <div className="costos-aviso">
          Convertido a {datos.tipo_cambio.descripcion.toLowerCase()} de{' '}
          <strong>${datos.tipo_cambio.valor_clp.toLocaleString('es-CL')}</strong>, dato del{' '}
          {datos.tipo_cambio.fecha_dato}. No es de hoy: el Banco Central no publica fines de semana
          ni el mismo día.
        </div>
      )}
      {tasa === null && (
        <div className="costos-aviso costos-aviso-warn">
          Sin tipo de cambio: no se puede mostrar en CLP ni convertir suscripciones en pesos.
        </div>
      )}

      {/* ===== RESUMEN SUPERIOR ===== */}
      <div className="mini-dash costos-resumen">
        {[
          { ico: '▤', label: 'Costos fijos', valor: money(r.fijo_mensual_usd), sub: 'al mes, existan clientes o no', cls: 'c-email' },
          { ico: '◈', label: 'Costo variable', valor: money(r.variable_mes_usd), sub: `${mesLargo(datos.mes_actual)}, crece con el uso`, cls: 'c-social' },
          { ico: '$', label: 'Costo total del mes', valor: money(r.total_mes_usd), sub: `≈ ${money(r.equivalente_diario_usd)} por día`, cls: 'c-seo' },
          { ico: '↑', label: 'Ingreso recurrente', valor: money(r.ingreso_recurrente_usd), sub: r.ingreso_recurrente_usd ? 'suma de lo que pagan los clientes' : 'todavía no cargas lo que te paga cada cliente', cls: 'c-opens' },
          { ico: '=', label: 'Margen', valor: r.ingreso_recurrente_usd ? money(r.margen_usd) : '—', sub: r.ingreso_recurrente_usd ? pct(r.margen_pct) : 'necesita el ingreso por cliente', cls: r.margen_usd >= 0 ? 'c-social' : 'c-rebote' },
          { ico: '☁', label: 'AWS (plataforma)', valor: money(r.aws_plataforma_usd), sub: 'compartido, no repartible por cliente', cls: 'c-facebook' },
        ].map((k, i) => (
          <Reveal key={k.label} delay={i * 50}>
            <div className={`mini-card ${k.cls}`}>
              <div className="mini-card-icon">{k.ico}</div>
              <div className="mini-card-label">{k.label}</div>
              <div className="mini-card-value tabular">{k.valor}</div>
              <div className="mini-card-sub">{k.sub}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {r.suscripciones_sin_convertir.length > 0 && (
        <div className="costos-aviso costos-aviso-warn">
          Sin tipo de cambio, estas suscripciones en pesos no entran en el total:{' '}
          {r.suscripciones_sin_convertir.join(', ')}.
        </div>
      )}

      {/* ===== BLOQUE 1: COSTOS FIJOS ===== */}
      <div className="section-head costos-header" style={{ marginTop: 40 }}>
        <span className="section-title">Costos fijos de plataforma</span>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ abierto: true, inicial: null })}>
          Agregar suscripción
        </button>
      </div>
      <div className="section-sub">Lo que pagas exista o no un cliente. Lo cargas tú; no se mide en ninguna parte.</div>

      {datos.fijos.length === 0 ? (
        <div className="empty-state">
          Todavía no cargaste ninguna suscripción. Agrega Claude Code MAX, ElevenLabs, Figma y los dominios.
        </div>
      ) : (
        <div className="costos-tabla-wrap"><table>
          <thead>
            <tr>
              <th>Suscripción</th>
              <th>Monto real</th>
              <th>Ciclo</th>
              <th>Cobro</th>
              <th className="tabular">Equivale al mes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {datos.fijos.map((f) => (
              <tr key={f.cost_id}>
                <td className="cell-name">
                  {f.icono ? `${f.icono} ` : ''}{f.nombre}
                  {f.nota && <div className="cell-sub">{f.nota}</div>}
                </td>
                <td className="tabular">
                  {f.moneda === 'CLP'
                    ? `$${f.monto.toLocaleString('es-CL')} CLP`
                    : `${usd(f.monto)} USD`}
                </td>
                <td>{f.ciclo}</td>
                <td>{f.dia_cobro ? `día ${f.dia_cobro}` : '—'}</td>
                <td className="tabular">
                  {f.mensual_usd === null
                    ? <span className="costos-nodato">sin tipo de cambio</span>
                    : money(f.mensual_usd)}
                </td>
                <td className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal({ abierto: true, inicial: f })}>Editar</button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      if (!window.confirm(`¿Borrar "${f.nombre}" de los costos fijos?`)) return;
                      await deleteFixedCost(f.cost_id);
                      void cargar();
                    }}
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {/* ===== BLOQUE 2: COSTO VARIABLE ===== */}
      <div className="section-head" style={{ marginTop: 44 }}>
        <span className="section-title">Costo variable</span>
      </div>
      <div className="section-sub">Crece con el uso. Todo medido, nada estimado.</div>

      {/* --- AWS --- */}
      <div className="card costos-card">
        <div className="costos-card-head">
          <div>
            <div className="section-title">Amazon Web Services</div>
            <div className="section-sub">
              {awsMes
                ? <>Uso bruto de {mesLargo(awsMes.periodo)}
                    {awsMes.estimado && <span className="costos-tag">estimado por AWS</span>}
                    <span className="costos-tag">~24 h de retraso</span>
                    <span className="costos-nodato"> · actualizado {hace(awsMes.collected_at)}</span>
                  </>
                : 'Sin datos todavía'}
            </div>
          </div>
          {awsMes && (
            <div className="costos-card-total">
              <div className="mini-card-label">Uso bruto</div>
              <div className="mini-card-value tabular">{money(awsMes.total_bruto_usd)}</div>
              {awsMes.total_credito_usd !== 0 && (
                <div className="mini-card-sub">
                  {money(Math.abs(awsMes.total_credito_usd))} cubierto por créditos →
                  pagas {money(awsMes.total_neto_usd)}
                </div>
              )}
            </div>
          )}
        </div>

        {datos.aws.error ? (
          <div className="empty-state">No se pudo consultar Cost Explorer: {datos.aws.error}</div>
        ) : !awsMes ? (
          <div className="empty-state">
            El recolector todavía no ha guardado datos de AWS para este mes.
          </div>
        ) : (
          <>
            <BarrasAws mes={awsMes} />
            {awsMes.total_credito_usd !== 0 && (
              <div className="costos-aviso costos-aviso-warn" style={{ marginTop: 16 }}>
                Hoy pagas {money(awsMes.total_neto_usd)} porque los créditos cubren el uso.
                La cifra que importa es el <strong>uso bruto</strong>: eso es lo que vas a pagar
                cuando los créditos se acaben. AWS no expone el saldo restante por API —
                está solo en la consola de Billing.
              </div>
            )}
            {awsAnterior && (
              <div className="costos-comparacion">
                <span>{mesLargo(awsAnterior.periodo)}</span>
                <span className="tabular">{money(awsAnterior.total_bruto_usd)}</span>
                <span className="costos-nodato">uso bruto del mes anterior (cerrado)</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- Anthropic --- */}
      <div className="card costos-card">
        <div className="costos-card-head">
          <div>
            <div className="section-title">API de Anthropic (Claude)</div>
            <div className="section-sub">
              Consumo de los agentes, calculado por nosotros con los tokens reales — casi en tiempo real.
              {claude?.tarifa_introductoria_vigente && (
                <span className="costos-tag">tarifa introductoria hasta {claude.tarifa_introductoria_vence}</span>
              )}
            </div>
          </div>
          {claude && !claude.sin_datos && (
            <div className="costos-card-total">
              <div className="mini-card-label">Este mes</div>
              <div className="mini-card-value tabular">{money(claude.total_usd)}</div>
            </div>
          )}
        </div>

        {datos.claude.error ? (
          <div className="empty-state">No se pudo leer el consumo de tokens: {datos.claude.error}</div>
        ) : !claude || claude.sin_datos ? (
          <div className="empty-state">
            {claude?.motivo ?? 'Ningún agente registró consumo de tokens en este mes.'}
          </div>
        ) : (
          <div className="costos-tabla-wrap"><table>
            <thead>
              <tr>
                <th>Cliente / agente</th>
                <th>Modelo</th>
                <th className="tabular">Entrada</th>
                <th className="tabular">Salida</th>
                <th className="tabular">Caché (esc/lec)</th>
                <th className="tabular">Costo</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(claude.por_cliente).map(([clientId, d]) => (
                <Fragment key={clientId}>
                  <tr className="costos-fila-cliente">
                    <td className="cell-name">{clientId}</td>
                    <td colSpan={4} />
                    <td className="tabular">{money(d.costo_usd)}</td>
                  </tr>
                  {d.agentes.map((a) => (
                    <tr key={`${clientId}-${a.agent_key}`}>
                      <td className="cell-sub costos-indent">{a.agent_name}</td>
                      <td className="cell-sub">{a.modelo}</td>
                      <td className="tabular">{num(a.tokens_entrada)}</td>
                      <td className="tabular">{num(a.tokens_salida)}</td>
                      <td className="tabular">
                        {a.tokens_cache_escritura || a.tokens_cache_lectura
                          ? `${num(a.tokens_cache_escritura)} / ${num(a.tokens_cache_lectura)}`
                          : <span className="costos-nodato">—</span>}
                      </td>
                      <td className="tabular">{money(a.costo_usd)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* --- WhatsApp / Meta --- */}
      <div className="card costos-card">
        <div className="costos-card-head">
          <div>
            <div className="section-title">WhatsApp (Meta)</div>
            <div className="section-sub">Conversaciones y costo por cuenta de WhatsApp Business.</div>
          </div>
        </div>
        {datos.meta.error ? (
          <div className="empty-state">No se pudo consultar Meta: {datos.meta.error}</div>
        ) : datos.meta.por_cliente.length === 0 ? (
          <div className="empty-state">El recolector todavía no ha consultado Meta.</div>
        ) : (
          <div className="costos-tabla-wrap"><table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Número</th>
                <th className="tabular">Conversaciones</th>
                <th className="tabular">Costo</th>
              </tr>
            </thead>
            <tbody>
              {datos.meta.por_cliente.map((m) => {
                const mes = m.por_mes?.[datos.mes_actual];
                return (
                  <tr key={m.client_id}>
                    <td className="cell-name">{m.client_id}</td>
                    <td className="cell-sub">
                      {m.sin_whatsapp
                        ? <span className="costos-nodato">WhatsApp no configurado</span>
                        : <>{m.numero}{m.es_numero_de_prueba && <span className="costos-tag">número de prueba</span>}</>}
                    </td>
                    <td className="tabular">{m.sin_whatsapp ? '—' : num(mes?.conversaciones ?? 0)}</td>
                    <td className="tabular">
                      {m.sin_whatsapp
                        ? <span className="costos-nodato">no aplica</span>
                        : m.es_numero_de_prueba
                          ? <span className="costos-nodato">sin costo — número de prueba</span>
                          : money(mes?.costo_usd ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {/* ===== MARGEN POR CLIENTE ===== */}
      <div className="section-head" style={{ marginTop: 44 }}>
        <span className="section-title">Margen por cliente</span>
      </div>
      <div className="section-sub">
        El costo variable de cada cliente es lo que solo él genera: sus tokens de Claude y su WhatsApp.
      </div>

      {datos.margenes.length === 0 ? (
        <div className="empty-state">Todavía no hay costo atribuible a ningún cliente este mes.</div>
      ) : (
        <div className="costos-tabla-wrap"><table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th className="tabular">Costo variable del mes</th>
              <th className="tabular">Lo que me paga</th>
              <th className="tabular">Margen</th>
              <th className="tabular">% margen</th>
            </tr>
          </thead>
          <tbody>
            {datos.margenes.map((m) => (
              <tr key={m.client_id}>
                <td className="cell-name">{m.client_id}</td>
                <td className="tabular">
                  {money(m.costo_variable_usd)}
                  <div className="cell-sub">
                    Claude {money(m.costo_claude_usd)}
                    {m.whatsapp_sin_configurar
                      ? ' · sin WhatsApp'
                      : m.whatsapp_es_numero_de_prueba
                        ? ' · WhatsApp sin costo (prueba)'
                        : ` · WhatsApp ${money(m.costo_whatsapp_usd)}`}
                  </div>
                </td>
                <td className="tabular">
                  {editandoPago === m.client_id ? (
                    <span className="costos-inline-edit">
                      <input
                        autoFocus
                        value={valorPago}
                        inputMode="decimal"
                        onChange={(e) => setValorPago(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void guardarPago(m.client_id); }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => void guardarPago(m.client_id)}>OK</button>
                    </span>
                  ) : (
                    <button
                      className="costos-editable"
                      onClick={() => { setEditandoPago(m.client_id); setValorPago(m.paga_usd != null ? String(m.paga_usd) : ''); }}
                    >
                      {m.paga_usd === null ? <span className="costos-nodato">sin cargar</span> : money(m.paga_usd)}
                    </button>
                  )}
                </td>
                <td className="tabular">
                  {m.margen_usd === null
                    ? <span className="costos-nodato">—</span>
                    : <span className={m.margen_usd >= 0 ? 'costos-ok' : 'costos-mal'}>{money(m.margen_usd)}</span>}
                </td>
                <td className="tabular">
                  {m.margen_pct === null ? <span className="costos-nodato">—</span> : pct(m.margen_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      <div className="costos-aviso" style={{ marginTop: 18 }}>
        <strong>AWS no está repartido entre clientes, a propósito.</strong> Una misma Lambda,
        una misma tabla y una misma API sirven a todos: cualquier reparto sería una fórmula
        inventada. Se muestra como costo de plataforma ({money(r.aws_plataforma_usd)} este mes).
        Los recursos sí atribuibles a un cliente —como la zona DNS de su dominio— son de centavos
        y no cambian ningún margen.
      </div>

      {datos.ultima_corrida && (
        <div className="footnote">
          Última corrida del recolector: {hace(datos.ultima_corrida.collected_at)} ({datos.ultima_corrida.invocacion}).{' '}
          {Object.entries(datos.ultima_corrida.resultados)
            .map(([fuente, res]) => `${fuente}: ${res}`)
            .join(' · ')}
        </div>
      )}

      {modal.abierto && (
        <ModalSuscripcion
          inicial={modal.inicial}
          onCerrar={() => setModal({ abierto: false, inicial: null })}
          onGuardado={() => { setModal({ abierto: false, inicial: null }); void cargar(); }}
        />
      )}
    </div>
  );
}
