// Textarea de guion + acciones de IA. Hoy los 3 servicios son stubs
// honestos: el panel muestra literalmente "no conectado" con el motivo,
// nunca un resultado inventado.
import { useState } from 'react';
import { generateVoiceover, orchestrateCuts } from './services/thelmaAIService';
import type { MediaAsset, ThelmaFormat } from './types';

interface AIOrchestratorPanelProps {
  script: string;
  onScriptChange: (script: string) => void;
  assets: MediaAsset[];
  format: ThelmaFormat;
}

type ActionState = { loading: boolean; message: string | null };

const IDLE: ActionState = { loading: false, message: null };

export function AIOrchestratorPanel({ script, onScriptChange, assets, format }: AIOrchestratorPanelProps) {
  const [voiceoverState, setVoiceoverState] = useState<ActionState>(IDLE);
  const [cutsState, setCutsState] = useState<ActionState>(IDLE);

  async function handleGenerateVoiceover() {
    setVoiceoverState({ loading: true, message: null });
    const result = await generateVoiceover({ script });
    setVoiceoverState({
      loading: false,
      message: result.connected ? 'Locución generada.' : result.motivo,
    });
  }

  async function handleAutoAssemble() {
    setCutsState({ loading: true, message: null });
    const result = await orchestrateCuts({ script, assets, format });
    setCutsState({
      loading: false,
      message: result.connected ? 'Timeline auto-ensamblado.' : result.motivo,
    });
  }

  return (
    <div className="thelma-orchestrator">
      <label className="thelma-orchestrator-label" htmlFor="thelma-script">Guion</label>
      <textarea
        id="thelma-script"
        className="thelma-orchestrator-textarea"
        value={script}
        onChange={(e) => onScriptChange(e.target.value)}
        placeholder="Escribí el guion del video…"
        rows={8}
      />
      <div className="thelma-orchestrator-actions">
        <div className="thelma-orchestrator-action">
          <button type="button" className="thelma-btn-primary" disabled={voiceoverState.loading || !script.trim()} onClick={handleGenerateVoiceover}>
            {voiceoverState.loading ? 'Generando…' : 'Generar Locución'}
          </button>
          {voiceoverState.message && <p className="thelma-orchestrator-status">{voiceoverState.message}</p>}
        </div>
        <div className="thelma-orchestrator-action">
          <button type="button" className="thelma-btn-primary" disabled={cutsState.loading || !script.trim() || assets.length === 0} onClick={handleAutoAssemble}>
            {cutsState.loading ? 'Ensamblando…' : 'Auto-ensamblar Timeline'}
          </button>
          {cutsState.message && <p className="thelma-orchestrator-status">{cutsState.message}</p>}
        </div>
      </div>
    </div>
  );
}
