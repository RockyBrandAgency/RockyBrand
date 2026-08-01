import { usePanelData } from '../context/PanelDataContext';
import { AGENT_META, AGENT_FUNCTION_KEYS, TOOL_META, TOOL_KEYS, PROJECT_LOGO } from '../constants';
import ServicesToggleCard from './ServicesToggleCard';
import type { AgentKey, Project, ToolKey } from '../types';

// Tarjeta de un cliente: qué agentes y qué herramientas tiene habilitados.
// Reusada en 2 lugares (para no duplicar la lógica de toggle): la sección
// "Asignación por cliente" de la página global Agentes (todas las tarjetas)
// y el tab "Configuración" de un cliente activo (una sola tarjeta).
export default function AgentToolToggleCard({ project }: { project: Project }) {
  const { updateProject } = usePanelData();
  const agents = project.agents?.length ? project.agents : AGENT_FUNCTION_KEYS;
  const tools = project.tools?.length ? project.tools : TOOL_KEYS;

  function toggleAgent(key: AgentKey) {
    const next = agents.includes(key) ? agents.filter((k) => k !== key) : [...agents, key];
    updateProject(project.id, { agents: next });
  }

  function toggleTool(key: ToolKey) {
    const next = tools.includes(key) ? tools.filter((k) => k !== key) : [...tools, key];
    updateProject(project.id, { tools: next });
  }

  return (
    <div className="card config-project-card">
      <div className="config-project-header">
        {PROJECT_LOGO[project.id] && (
          <div className="config-project-logo-wrap">
            <img src={PROJECT_LOGO[project.id]} alt={project.name} className="config-project-logo" />
          </div>
        )}
        <div>
          <div className="config-project-name">{project.name}</div>
          <div className="config-project-id tabular">clientes/{project.id}</div>
        </div>
      </div>

      <ServicesToggleCard project={project} />

      <div className="desc-label" style={{ marginTop: 18 }}>
        Agentes disponibles <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(qué se ve en el panel, no si el cliente lo tiene contratado)</span>
      </div>
      <div className="config-chip-row">
        {AGENT_FUNCTION_KEYS.map((key) => {
          const meta = AGENT_META[key];
          const selected = agents.includes(key);
          return (
            <button key={key} type="button" className={`config-chip${selected ? ' selected' : ''}`} onClick={() => toggleAgent(key)}>
              <span className={`avatar ${meta.cls}`} style={{ width: 22, height: 22, fontSize: 9 }}>
                {meta.initials}
              </span>
              {meta.short}
            </button>
          );
        })}
      </div>

      <div className="desc-label" style={{ marginTop: 18 }}>
        Herramientas disponibles
      </div>
      <div className="config-chip-row">
        {TOOL_KEYS.map((key) => {
          const meta = TOOL_META[key];
          const selected = tools.includes(key);
          return (
            <button key={key} type="button" className={`config-chip${selected ? ' selected' : ''}`} onClick={() => toggleTool(key)}>
              <span className="ico">{meta.icon}</span> {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
