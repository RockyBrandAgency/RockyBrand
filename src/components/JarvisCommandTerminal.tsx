// Jarvis - terminal de comando global, fase 1 (sin ejecucion real). Se monta
// una sola vez en Layout.tsx, cubre toda la superficie autenticada. Atajo
// Cmd/Ctrl+J o el boton flotante lo abren. El historial vive solo en memoria
// del componente (useState) - se pierde al recargar, por decision explicita.
//
// Regla de fase 1: "Aprobar" una proposed_action NUNCA llama a un endpoint
// real - solo cambia el estado local del mensaje con un label explicito de
// modo de prueba, para no insinuar que algo se ejecuto quedeveras.
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { invokeJarvis } from '../api';
import { usePanelData } from '../context/PanelDataContext';
import type { JarvisProposedAction } from '../types';

type MessageStatus = 'idle' | 'approved' | 'rejected';

interface JarvisMessage {
  id: string;
  role: 'user' | 'jarvis' | 'error';
  text: string;
  proposedAction?: JarvisProposedAction | null;
  actionStatus?: MessageStatus;
}

let messageSeq = 0;
function nextId(): string {
  messageSeq += 1;
  return `jarvis-msg-${messageSeq}`;
}

export default function JarvisCommandTerminal() {
  const { activeProjectId, activeProjectName } = usePanelData();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' });
      gsap.fromTo(panel, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.28, ease: 'back.out(1.6)' });
    });
    inputRef.current?.focus();
    return () => ctx.revert();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || !activeProjectId || processing) return;
    setInput('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: prompt }]);
    setProcessing(true);
    try {
      const result = await invokeJarvis(prompt, activeProjectId);
      if (!result.ok) {
        setMessages((prev) => [...prev, { id: nextId(), role: 'error', text: result.error || 'Jarvis no pudo responder.' }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'jarvis',
            text: result.reply || '',
            proposedAction: result.proposed_action,
            actionStatus: result.proposed_action ? 'idle' : undefined,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { id: nextId(), role: 'error', text: err instanceof Error ? err.message : 'Error de conexión.' }]);
    } finally {
      setProcessing(false);
    }
  }

  function setActionStatus(messageId: string, status: MessageStatus) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, actionStatus: status } : m)));
  }

  return (
    <>
      <button
        type="button"
        className="jarvis-trigger"
        onClick={() => setOpen(true)}
        title="Jarvis (⌘J)"
      >
        Jarvis <span className="jarvis-trigger-kbd">⌘J</span>
      </button>

      {open && (
        <div
          className="jarvis-overlay"
          ref={overlayRef}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="jarvis-panel" ref={panelRef}>
            <div className="jarvis-panel-head">
              <div>
                <div className="jarvis-panel-title">Jarvis</div>
                <div className="jarvis-panel-sub">
                  {activeProjectName ? `Contexto: ${activeProjectName}` : 'Sin cliente activo'}
                </div>
              </div>
              <button type="button" className="jarvis-close" onClick={() => setOpen(false)}>&times;</button>
            </div>

            <div className="jarvis-history">
              {messages.length === 0 && (
                <p className="jarvis-empty">Preguntale a Jarvis por el estado real de este cliente — SEO, email, redes.</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`jarvis-msg jarvis-msg--${m.role}`}>
                  <div className="jarvis-msg-text">{m.text}</div>
                  {m.proposedAction && (
                    <div className="jarvis-action-block">
                      <div className="jarvis-action-kind">Acción propuesta · {m.proposedAction.kind}</div>
                      <div className="jarvis-action-summary">{m.proposedAction.summary}</div>
                      <div className="jarvis-action-details">{m.proposedAction.details}</div>
                      {m.actionStatus === 'idle' && (
                        <div className="jarvis-action-buttons">
                          <button type="button" className="jarvis-btn-approve" onClick={() => setActionStatus(m.id, 'approved')}>
                            Aprobar
                          </button>
                          <button type="button" className="jarvis-btn-reject" onClick={() => setActionStatus(m.id, 'rejected')}>
                            Rechazar
                          </button>
                        </div>
                      )}
                      {m.actionStatus === 'approved' && (
                        <div className="jarvis-action-status">Aprobado — no se ejecutó nada (modo de prueba)</div>
                      )}
                      {m.actionStatus === 'rejected' && (
                        <div className="jarvis-action-status">Rechazado</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {processing && <div className="jarvis-msg jarvis-msg--jarvis jarvis-msg--processing">Pensando…</div>}
            </div>

            <form className="jarvis-input-row" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!activeProjectId || processing}
                placeholder={activeProjectId ? 'Preguntale algo a Jarvis…' : 'Elegí un cliente activo primero'}
              />
              <button type="submit" disabled={!activeProjectId || processing || !input.trim()}>
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
