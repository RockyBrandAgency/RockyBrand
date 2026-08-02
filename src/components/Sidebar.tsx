import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePanelData } from '../context/PanelDataContext';
import { AGENT_META, AGENT_FUNCTION_KEYS, TOOL_META, TOOL_KEYS } from '../constants';
import { formatTodayEs } from '../api';
import type { AgentKey, ToolKey } from '../types';

export default function Sidebar() {
  const { logout } = useAuth();
  const { projects, activeProjectId, activeServices, deleteProject, addProject } = usePanelData();
  const navigate = useNavigate();

  // "Modo cliente aislado": con un cliente activo, Herramientas se filtra
  // por lo que ESE cliente tiene contratado de verdad (services real, no
  // el `tools` cosmético) - reduce ruido de staff trabajando un cliente a
  // la vez. Sin cliente activo, o mientras carga, se ve todo (nunca se
  // esconde algo por un false negativo de carga).
  const showPms = !activeProjectId || activeServices === null || activeServices.pms;
  const showEmailMarketing = !activeProjectId || activeServices === null || activeServices.email_marketing;

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAgents, setNewAgents] = useState<AgentKey[]>(AGENT_FUNCTION_KEYS);
  const [newTools, setNewTools] = useState<ToolKey[]>(TOOL_KEYS);

  function toggleNewAgent(key: AgentKey) {
    setNewAgents((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleNewTool(key: ToolKey) {
    setNewTools((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function cancelAdding() {
    setAdding(false);
    setNewName('');
    setNewAgents(AGENT_FUNCTION_KEYS);
    setNewTools(TOOL_KEYS);
  }

  async function commitNewProject() {
    if (newName.trim()) {
      await addProject(newName.trim(), newAgents, newTools);
    }
    setAdding(false);
    setNewName('');
    setNewAgents(AGENT_FUNCTION_KEYS);
    setNewTools(TOOL_KEYS);
  }

  return (
    <div className="sidebar">
      <div className="logo-row" onClick={() => navigate('/')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
        <img className="logo-image" src="/rocky-brand-logo.png" alt="RockyBrand" />
        <div className="logo-tagline">AI Powered Brand &amp; Execution</div>
      </div>

      <div>
        <div className="nav-label">Clientes</div>
        {projects.map((p) => (
          <div
            key={p.id}
            className={`proj-item${p.id === activeProjectId ? ' active' : ''}`}
            onClick={() => navigate(`/p/${p.id}`)}
          >
            <span className="proj-dot" />
            {p.name}
            {!p.protected && (
              <span
                className="proj-delete"
                title="Eliminar cliente"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProject(p.id);
                }}
              >
                ×
              </span>
            )}
          </div>
        ))}
        {adding ? (
          <div className="new-project-form">
            <input
              className="add-project-input"
              autoFocus
              placeholder="Nombre del cliente"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNewProject();
                if (e.key === 'Escape') cancelAdding();
              }}
            />
            <div className="new-project-agents-label">Agentes para este cliente</div>
            <div className="new-project-chips">
              {AGENT_FUNCTION_KEYS.map((key) => {
                const meta = AGENT_META[key];
                const selected = newAgents.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`agent-chip${selected ? ' selected' : ''}`}
                    title={meta.short}
                    onClick={() => toggleNewAgent(key)}
                  >
                    {meta.initials}
                  </button>
                );
              })}
            </div>
            <div className="new-project-agents-label">Herramientas para este cliente</div>
            <div className="new-project-tools">
              {TOOL_KEYS.map((key) => {
                const meta = TOOL_META[key];
                const selected = newTools.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`tool-chip${selected ? ' selected' : ''}`}
                    onClick={() => toggleNewTool(key)}
                  >
                    <span className="ico">{meta.icon}</span> {meta.label}
                  </button>
                );
              })}
            </div>
            <div className="new-project-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={commitNewProject} disabled={!newName.trim()}>
                Crear
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelAdding}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="add-project" onClick={() => setAdding(true)}>
            <span>+</span> Agregar cliente
          </div>
        )}
      </div>

      <div>
        <div className="nav-label">General</div>
        <NavLink to="/" end className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
          <span className="ico">▣</span> Overview
        </NavLink>
        <NavLink to="/agentes" className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
          <span className="ico">◈</span> Agentes
        </NavLink>
        <NavLink to="/reportes" className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
          <span className="ico">▤</span> Reportes
        </NavLink>
        <NavLink to="/costos" className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
          <span className="ico">$</span> Costos
        </NavLink>
        <NavLink to="/usuarios-acceso" className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
          <span className="ico">⚿</span> Usuarios y accesos
        </NavLink>
      </div>

      <div>
        <div className="nav-label">Herramientas</div>
        {showEmailMarketing && (
          <NavLink to="/email-marketing" className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
            <span className="ico">✉</span> Email Marketing
          </NavLink>
        )}
        {showPms && (
          <NavLink to="/pms" className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
            <span className="ico">⌂</span> PMS
          </NavLink>
        )}
        <NavLink to="/thelma-studio" className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
          <span className="ico">▶</span> Thelma Studio
        </NavLink>
        <NavLink to="/configuraciones" className={({ isActive }) => `config-link${isActive ? ' current' : ''}`}>
          <span className="ico">⚙</span> Configuraciones
        </NavLink>
      </div>

      <div className="sidebar-foot">
        By Matías Araneda
        <br />
        {formatTodayEs()}
        <div style={{ marginTop: 10 }}>
          <a
            href="#"
            className="logout-link"
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
          >
            Cerrar sesión
          </a>
        </div>
      </div>
    </div>
  );
}
