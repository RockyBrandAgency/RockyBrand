import { useEffect, useState } from 'react';
import { usePanelData } from '../context/PanelDataContext';
import { useAuth } from '../context/AuthContext';
import { UnauthorizedError } from '../api';
import { AGENT_META, AGENT_FUNCTION_KEYS, DEFAULTS } from '../constants';
import type { AgentKey, AgentPromptState } from '../types';
import Reveal from '../components/Reveal';

function AgentIdentityRow({ agentKey }: { agentKey: AgentKey }) {
  const { agentConfigs, updateAgentConfig, scopedAction } = usePanelData();
  const { handleUnauthorized } = useAuth();
  const meta = AGENT_META[agentKey];
  const config = agentConfigs[agentKey] || DEFAULTS[agentKey];
  const [name, setName] = useState(config.name);
  const [desc, setDesc] = useState(config.desc);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [promptState, setPromptState] = useState<AgentPromptState | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptMsg, setPromptMsg] = useState('');

  const dirty = name !== config.name || desc !== config.desc;

  useEffect(() => {
    let cancelled = false;
    setPromptLoading(true);
    scopedAction<AgentPromptState>('get_agent_prompt', { agent_key: agentKey })
      .then((data) => {
        if (cancelled) return;
        setPromptState(data);
        setPromptDraft(data.prompt);
      })
      .catch((e) => {
        if (e instanceof UnauthorizedError) handleUnauthorized();
      })
      .finally(() => {
        if (!cancelled) setPromptLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

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

  async function savePrompt() {
    setPromptBusy(true);
    setPromptMsg('');
    try {
      const result = await scopedAction<{ ok: boolean; is_custom: boolean }>('update_agent_prompt', {
        agent_key: agentKey,
        prompt: promptDraft,
      });
      setPromptState((prev) => (prev ? { ...prev, prompt: promptDraft, is_custom: result.is_custom } : prev));
      setPromptMsg('Guardado.');
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      setPromptMsg(e instanceof Error && e.message ? e.message : 'No se pudo guardar.');
    } finally {
      setPromptBusy(false);
    }
  }

  function restoreDefaultPrompt() {
    if (!promptState) return;
    setPromptDraft(promptState.default_prompt);
    setPromptMsg('');
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

      <div className="crm-field" style={{ marginBottom: 0 }}>
        <label>
          Instrucción del sistema
          {promptState?.is_custom && <span className="pill sending" style={{ marginLeft: 8 }}>Personalizado</span>}
        </label>
        {promptLoading ? (
          <div className="empty-state">Cargando instrucción actual…</div>
        ) : (
          <>
            <textarea
              className="agent-prompt-textarea"
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              spellCheck={false}
            />
            <div className="agent-prompt-actions">
              <button className="manual-invoke-btn" style={{ marginTop: 0 }} onClick={savePrompt} disabled={promptBusy || !promptDraft.trim()}>
                {promptBusy ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={restoreDefaultPrompt} disabled={promptBusy}>
                Restaurar default
              </button>
              <div className="manual-invoke-msg">{promptMsg}</div>
            </div>
          </>
        )}
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
      <div className="page-sub">
        Identidad e instrucción del sistema de los 7 agentes — aplica a todos los clientes. Rox (CMO)
        es el único orquestador real del sistema: define el norte de marca y las directivas que Dave,
        Jimi, Cameron, Thelma y Slash leen antes de generar el suyo.
      </div>

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
