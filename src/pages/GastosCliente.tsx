import { useEffect, useState } from 'react';
import { usePanelData } from '../context/PanelDataContext';
import { callAction } from '../api';
import { AGENT_META, DEFAULTS } from '../constants';
import Reveal from '../components/Reveal';
import type { AgentKey, AiSpendClientLine, AiSpendOverview } from '../types';

function money(v: number | null) {
  return v === null ? '—' : `$${v.toFixed(2)}`;
}

export default function GastosCliente() {
  const { activeProjectId, activeProjectName } = usePanelData();
  const [spend, setSpend] = useState<AiSpendClientLine | null>(null);
  const [periodMonth, setPeriodMonth] = useState<string>('');
  const [error, setError] = useState(false);
  // Distinguir "cargando" de "no hay consumo": sin esto los KPI se quedaban
  // en "…" para siempre cuando el mes no tenía datos — que es exactamente lo
  // que pasa con los agentes pausados. `no_data_reason` lo manda el backend.
  const [cargando, setCargando] = useState(true);
  const [sinDatos, setSinDatos] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    setSpend(null);
    setError(false);
    setCargando(true);
    setSinDatos(null);
    callAction<AiSpendOverview>('get_ai_spend_overview', { project_ids: [activeProjectId] })
      .then((data) => {
        if (!cancelled) {
          const linea = data.by_client[0] ?? null;
          setSpend(linea);
          setPeriodMonth(data.period_month);
          setSinDatos(linea ? null : (data.no_data_reason ?? 'Sin consumo registrado este mes.'));
          setCargando(false);
        }
      })
      .catch((e) => {
        console.error('Error cargando el gasto de este cliente', e);
        if (!cancelled) { setError(true); setCargando(false); }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  return (
    <div>
      <div className="page-title">Resumen de Gastos</div>
      <div className="page-sub">
        Gasto real de Claude para {activeProjectName} {periodMonth ? `· ${periodMonth}` : ''}
      </div>

      {error && <div className="empty-state">No se pudo cargar el gasto de este cliente.</div>}

      {!error && sinDatos && !cargando && (
        <div className="empty-state">{sinDatos}</div>
      )}

      {!error && !sinDatos && (
        <>
          <div className="mini-dash">
            <Reveal delay={0}>
              <div className="mini-card c-pms">
                <div className="mini-card-icon">$</div>
                <div className="mini-card-label">Costo total del mes</div>
                <div className="mini-card-value tabular">{spend ? money(spend.cost_usd) : cargando ? '…' : '—'}</div>
                <div className="mini-card-sub">{spend ? `${(spend.input_tokens + spend.output_tokens).toLocaleString('es-CL')} tokens (in + out)` : cargando ? 'Cargando…' : 'sin datos'}</div>
              </div>
            </Reveal>
            <Reveal delay={60}>
              <div className="mini-card c-pms">
                <div className="mini-card-icon">◆</div>
                <div className="mini-card-label">Tokens de entrada</div>
                <div className="mini-card-value tabular">{spend ? spend.input_tokens.toLocaleString('es-CL') : cargando ? '…' : '—'}</div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="mini-card c-pms">
                <div className="mini-card-icon">◈</div>
                <div className="mini-card-label">Tokens de salida</div>
                <div className="mini-card-value tabular">{spend ? spend.output_tokens.toLocaleString('es-CL') : cargando ? '…' : '—'}</div>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="mini-card c-pms">
                <div className="mini-card-icon">◎</div>
                <div className="mini-card-label">Tokens de razonamiento</div>
                <div className="mini-card-value tabular">{spend ? spend.thinking_tokens.toLocaleString('es-CL') : cargando ? '…' : '—'}</div>
                <div className="mini-card-sub">Ya incluidos en el costo de output</div>
              </div>
            </Reveal>
          </div>

          <div className="section-head" style={{ marginTop: 36 }}>
            <span className="section-title">Desglose por agente</span>
          </div>
          {spend && spend.agents.length === 0 && (
            <div className="empty-state">Ningún agente de este cliente registró consumo de tokens este mes todavía.</div>
          )}
          {spend && spend.agents.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>Modelo</th>
                  <th className="tabular">Tokens entrada</th>
                  <th className="tabular">Tokens salida</th>
                  <th className="tabular">Costo</th>
                </tr>
              </thead>
              <tbody>
                {spend.agents.map((a) => {
                  const key = a.agent_key as AgentKey;
                  return (
                    <tr key={a.agent_key}>
                      <td className="cell-name">
                        {DEFAULTS[key]?.name || a.agent_key} · {AGENT_META[key]?.short || ''}
                      </td>
                      <td className="cell-sub">{a.model}</td>
                      <td className="tabular">{a.input_tokens.toLocaleString('es-CL')}</td>
                      <td className="tabular">{a.output_tokens.toLocaleString('es-CL')}</td>
                      <td className="tabular">{money(a.cost_usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
