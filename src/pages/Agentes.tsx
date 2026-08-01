import { useNavigate } from 'react-router-dom';
import { usePanelData } from '../context/PanelDataContext';
import { AGENT_META, AGENT_FUNCTION_KEYS, DEFAULTS, TOOL_KEYS, statusMeta } from '../constants';
import Reveal from '../components/Reveal';
import AgentToolToggleCard from '../components/AgentToolToggleCard';

export default function Agentes() {
  const { agentConfigs, agentStatus, activeProjectId, activeProject, projects, setActiveProjectId } = usePanelData();
  const navigate = useNavigate();

  const projectAgentKeys = activeProject?.agents?.length ? activeProject.agents : AGENT_FUNCTION_KEYS;
  const activeTools = activeProject?.tools?.length ? activeProject.tools : TOOL_KEYS;
  const agentesHabilitado = activeTools.includes('agentes');

  return (
    <div className="main">
      <div className="eyebrow">General</div>
      <div className="page-title">Agentes</div>
      <div className="page-sub">Métricas, invocación manual y asignación por cliente de los 6 agentes.</div>

      <div className="lodge-switcher" style={{ marginTop: 22, width: 'fit-content' }}>
        <span className="lodge-switcher-label">Cliente</span>
        <select
          className="lodge-switcher-select"
          value={activeProjectId ?? ''}
          onChange={(e) => setActiveProjectId(e.target.value || null)}
        >
          <option value="">Selecciona un cliente…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="section-head" style={{ marginTop: 32 }}>
        <span className="section-title">{activeProjectId ? `Agentes de ${activeProject?.name ?? activeProjectId}` : 'Agentes'}</span>
      </div>

      {!activeProjectId && <div className="card empty-state">Selecciona un cliente arriba para ver sus agentes.</div>}

      {activeProjectId && !agentesHabilitado && (
        <div className="card empty-state">Este cliente no tiene la herramienta "Agentes" habilitada — actívala en Asignación por cliente, abajo.</div>
      )}

      {activeProjectId && agentesHabilitado && !projectAgentKeys.length && (
        <div className="card empty-state">Este cliente no tiene agentes asignados todavía.</div>
      )}

      {activeProjectId && agentesHabilitado && !!projectAgentKeys.length && (
        <div className="agents-grid">
          {projectAgentKeys.map((key, i) => {
            const meta = AGENT_META[key];
            const config = agentConfigs[key] || DEFAULTS[key];
            const status = agentStatus[key] || { status: 'NUNCA_EJECUTADO', last_action: '', execution_count: 0 };
            const sMeta = statusMeta(status.status);
            return (
              <Reveal key={key} delay={i * 70}>
                <div className="agent-card" onClick={() => navigate(key)}>
                  <div className="agent-top">
                    <div className={`avatar ${meta.cls}`}>
                      <div className="avatar-ring" />
                      {meta.initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="name-fixed">{config.name}</div>
                      <div className="role-fixed">{meta.role}</div>
                    </div>
                  </div>
                  <div className="status">
                    <span className={`status-dot ${sMeta.cls}`} />
                    {sMeta.label}
                    {status.execution_count ? (
                      <span className="exec-count">
                        &middot; {status.execution_count} ejecucion{status.execution_count === 1 ? '' : 'es'}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <div className="desc-label">Descripción</div>
                    <div className="week-summary-text">{config.desc}</div>
                  </div>
                  <div className="agent-detail">
                    <div className="desc-label">Lo que hizo esta semana</div>
                    <div className="week-summary-text">{status.last_action || 'Todavía no ha corrido.'}</div>
                  </div>
                  <div>
                    <button
                      className="enter-agent-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(key);
                      }}
                    >
                      Entrar →
                    </button>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      <div className="section-head" style={{ marginTop: 40 }}>
        <span className="section-title">Asignación por cliente</span>
      </div>
      <div className="page-sub" style={{ marginTop: -8, marginBottom: 18 }}>
        "Servicios contratados" es real: decide si el cliente tiene el servicio de verdad, guardado en
        rockybrand-client-config. "Agentes disponibles"/"Herramientas disponibles" abajo solo controlan qué se ve en
        este panel — se aplica a los actuales y a cualquiera que agregues después.
      </div>
      <div className="config-projects-list">
        {projects.map((p, i) => (
          <Reveal key={p.id} delay={i * 60}>
            <AgentToolToggleCard project={p} />
          </Reveal>
        ))}
      </div>

      <div className="footnote">
        Cada agente se invoca manualmente desde su página de detalle — todavía no hay automatización por horario
        (EventBridge) ni flujo de aprobación por email. El estado de cada tarjeta (Procesando / Listo / Error) y "lo
        que hizo esta semana" se actualizan solos cada vez que el agente corre para el cliente seleccionado.
      </div>
    </div>
  );
}
