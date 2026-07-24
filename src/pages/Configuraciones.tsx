import { useState } from 'react';
import { usePanelData } from '../context/PanelDataContext';
import { AGENT_META, AGENT_FUNCTION_KEYS, DEFAULTS } from '../constants';
import type { AgentKey } from '../types';
import Reveal from '../components/Reveal';

function AgentIdentityRow({ agentKey }: { agentKey: AgentKey }) {
  const { agentConfigs, updateAgentConfig } = usePanelData();
  const meta = AGENT_META[agentKey];
  const config = agentConfigs[agentKey] || DEFAULTS[agentKey];
  const [name, setName] = useState(config.name);
  const [desc, setDesc] = useState(config.desc);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = name !== config.name || desc !== config.desc;

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await updateAgentConfig(agentKey, { name: name.trim() || config.name, desc });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className={`avatar ${meta.cls}`} style={{ width: 44, height: 44, fontSize: 13, flexShrink: 0 }}>
          <div className="avatar-ring" />
          {meta.initials}
        </div>
        <div>
          <div className="chart-card-title">{meta.role}</div>
          <div className="chart-card-range">{meta.short}</div>
        </div>
      </div>
      <div className="crm-field" style={{ marginBottom: 0 }}>
        <label>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="crm-field" style={{ marginBottom: 0 }}>
        <label>Descripción</label>
        <textarea style={{ minHeight: 70 }} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="manual-invoke-btn" style={{ marginTop: 0 }} onClick={save} disabled={busy || !dirty}>
          {busy ? 'Guardando...' : 'Guardar'}
        </button>
        {saved && !dirty && <span className="manual-invoke-msg" style={{ marginTop: 0 }}>Guardado.</span>}
      </div>
    </div>
  );
}

export default function Configuraciones() {
  return (
    <Reveal>
      <div className="page-title" style={{ marginTop: 8 }}>
        Configuraciones
      </div>
      <div className="page-sub">Identidad de los agentes — aplica a todos los clientes</div>

      <div className="section-head" style={{ marginTop: 32 }}>
        <span className="section-title">Agentes</span>
      </div>
      <div className="card2-grid card2-grid-2" style={{ marginTop: 16 }}>
        {AGENT_FUNCTION_KEYS.map((key, i) => (
          <Reveal key={key} delay={i * 60}>
            <AgentIdentityRow agentKey={key} />
          </Reveal>
        ))}
      </div>
    </Reveal>
  );
}
