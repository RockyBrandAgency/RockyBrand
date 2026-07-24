// Jarvis - terminal de comando global, fase 1 (sin ejecucion real). Se monta
// una sola vez en Layout.tsx, cubre toda la superficie autenticada. Atajo
// Cmd/Ctrl+J o el boton flotante lo abren. El historial vive solo en memoria
// del componente (useState) - se pierde al recargar, por decision explicita.
//
// Regla de fase 1: "Aprobar" una proposed_action NUNCA llama a un endpoint
// real - solo cambia el estado local del mensaje con un label explicito de
// modo de prueba, para no insinuar que algo se ejecuto quedeveras.
//
// Voz: entrada via Web Speech API nativa del navegador (gratis, sin backend).
// Salida via ElevenLabs real (jarvis_speak en el backend, reusa el mismo
// modulo que ya usa el agente Filmmaker) - si la voz todavia no esta
// configurada en SSM, se muestra el motivo real en vez de fallar en silencio
// o fabricar audio.
//
// Ghost Navigation: si Jarvis devuelve navigate_to, es SIEMPRE una clave de
// un enum cerrado que el backend valida contra su propio JSON schema - nunca
// un path crudo. El mapeo clave->ruta real vive solo aca (DESTINATION_ROUTES),
// nunca se le pasa un string del modelo directo a navigate().
//
// Visualizador: nivel de audio real via Web Audio API (getUserMedia +
// AnalyserNode al escuchar, createMediaElementSource + AnalyserNode al
// reproducir la respuesta) escrito directo a una CSS custom property por
// requestAnimationFrame - nunca via setState, para no re-renderizar en cada
// frame. Es decorativo: si el navegador no soporta algo o el permiso de mic
// falla, el flujo principal (reconocimiento de voz, respuesta, audio) sigue
// funcionando igual.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { invokeJarvis, speakJarvis } from '../api';
import { usePanelData } from '../context/PanelDataContext';
import type { JarvisProposedAction } from '../types';

type MessageStatus = 'idle' | 'approved' | 'rejected';
type VoiceState = 'idle' | 'loading' | 'error';

interface JarvisMessage {
  id: string;
  role: 'user' | 'jarvis' | 'error';
  text: string;
  proposedAction?: JarvisProposedAction | null;
  actionStatus?: MessageStatus;
  voiceState?: VoiceState;
  voiceError?: string;
  navigatedTo?: string;
}

let messageSeq = 0;
function nextId(): string {
  messageSeq += 1;
  return `jarvis-msg-${messageSeq}`;
}

// Vocabulario cerrado, espejo del NAV_DESTINATIONS del backend
// (jarvis_orchestrator_lambda.py). Cada clave se mapea a una ruta real de
// react-router - si Jarvis manda una clave que no esta aca, simplemente no
// se navega, nunca se intenta con un valor crudo.
const DESTINATION_ROUTES: Record<string, (projectId: string) => string> = {
  resumen: (id) => `/p/${id}`,
  metricas: (id) => `/p/${id}/metricas`,
  gastos: (id) => `/p/${id}/gastos`,
  configuracion: (id) => `/p/${id}/configuracion`,
  agentes: () => '/agentes',
  reportes: () => '/reportes',
  email_marketing: () => '/email-marketing',
  pms: () => '/pms',
  overview: () => '/',
};
const DESTINATION_LABELS: Record<string, string> = {
  resumen: 'Resumen',
  metricas: 'Métricas',
  gastos: 'Resumen de Gastos',
  configuracion: 'Configuración',
  agentes: 'Agentes',
  reportes: 'Reportes',
  email_marketing: 'Email Marketing',
  pms: 'PMS',
  overview: 'Overview',
};

interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean } };
  resultIndex: number;
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitAudioContext?: typeof AudioContext;
  }
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

// Escribe el nivel de volumen (0-1) directo en --level via rAF - nunca
// setState, para no re-renderizar React en cada frame de audio.
function startLevelLoop(analyser: AnalyserNode, target: HTMLElement, rafRef: React.MutableRefObject<number | null>) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  function tick() {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const level = Math.min(1, sum / data.length / 140);
    target.style.setProperty('--level', level.toFixed(3));
    rafRef.current = requestAnimationFrame(tick);
  }
  tick();
}
function stopLevelLoop(rafRef: React.MutableRefObject<number | null>, target?: HTMLElement | null) {
  if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  rafRef.current = null;
  target?.style.setProperty('--level', '0');
}

export default function JarvisCommandTerminal() {
  const { activeProjectId, activeProjectName } = usePanelData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);

  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechSupported = getSpeechRecognitionCtor() !== null;

  // Visualizador: escuchando (mic real via getUserMedia)
  const micVizRef = useRef<HTMLButtonElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);

  // Visualizador: Jarvis hablando (sobre el <audio> de la respuesta)
  const speakVizRef = useRef<HTMLDivElement>(null);
  const speakAudioCtxRef = useRef<AudioContext | null>(null);
  const speakRafRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      audioRef.current?.pause();
      stopMicVisualizer();
      stopSpeakVisualizer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startMicVisualizer() {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new Ctor();
      micAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      if (micVizRef.current) startLevelLoop(analyser, micVizRef.current, micRafRef);
    } catch {
      // Decorativo - si no hay permiso de mic para esto, SpeechRecognition
      // igual puede seguir escuchando por su cuenta.
    }
  }
  function stopMicVisualizer() {
    stopLevelLoop(micRafRef, micVizRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    void micAudioCtxRef.current?.close().catch(() => {});
    micAudioCtxRef.current = null;
  }

  function startSpeakVisualizer(audio: HTMLAudioElement) {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      speakAudioCtxRef.current = ctx;
      void ctx.resume();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      // Hay que reconectar a destination o el audio queda mudo - createMediaElementSource
      // redirige la salida del <audio> a traves del grafo de Web Audio.
      source.connect(analyser);
      analyser.connect(ctx.destination);
      if (speakVizRef.current) startLevelLoop(analyser, speakVizRef.current, speakRafRef);
    } catch {
      // Decorativo - el audio se reproduce normal aunque esto falle.
    }
  }
  function stopSpeakVisualizer() {
    stopLevelLoop(speakRafRef, speakVizRef.current);
    void speakAudioCtxRef.current?.close().catch(() => {});
    speakAudioCtxRef.current = null;
  }

  async function playJarvisReply(messageId: string, text: string) {
    if (!voiceOutputEnabled || !text.trim()) return;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, voiceState: 'loading' } : m)));
    try {
      const result = await speakJarvis(text);
      if (!result.ok || !result.audio_base64) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, voiceState: 'error', voiceError: result.error || 'Voz no disponible.' } : m)));
        return;
      }
      audioRef.current?.pause();
      stopSpeakVisualizer();
      const audio = new Audio(`data:audio/mpeg;base64,${result.audio_base64}`);
      audioRef.current = audio;
      audio.onended = () => stopSpeakVisualizer();
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, voiceState: 'idle' } : m)));
      startSpeakVisualizer(audio);
      await audio.play();
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, voiceState: 'error', voiceError: err instanceof Error ? err.message : 'Voz no disponible.' } : m)));
    }
  }

  async function sendPrompt(prompt: string) {
    if (!prompt.trim() || !activeProjectId || processing) return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: prompt }]);
    setProcessing(true);
    try {
      const result = await invokeJarvis(prompt, activeProjectId);
      if (!result.ok) {
        setMessages((prev) => [...prev, { id: nextId(), role: 'error', text: result.error || 'Jarvis no pudo responder.' }]);
      } else {
        const msgId = nextId();
        const navKey = result.navigate_to;
        const routeFn = navKey ? DESTINATION_ROUTES[navKey] : undefined;
        const navPath = routeFn ? routeFn(activeProjectId) : undefined;
        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            role: 'jarvis',
            text: result.reply || '',
            proposedAction: result.proposed_action,
            actionStatus: result.proposed_action ? 'idle' : undefined,
            navigatedTo: navPath ? navKey ?? undefined : undefined,
          },
        ]);
        if (navPath) navigate(navPath);
        if (result.reply) void playJarvisReply(msgId, result.reply);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { id: nextId(), role: 'error', text: err instanceof Error ? err.message : 'Error de conexión.' }]);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prompt = input.trim();
    setInput('');
    await sendPrompt(prompt);
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !activeProjectId) return;
    const recognition = new Ctor();
    recognition.lang = 'es-CL';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; event.results[i]; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interimTranscript += result[0].transcript;
      }
      setInput(finalTranscript || interimTranscript);
      if (finalTranscript.trim()) {
        setInput('');
        void sendPrompt(finalTranscript.trim());
      }
    };
    recognition.onend = () => {
      setListening(false);
      stopMicVisualizer();
    };
    recognition.onerror = () => {
      setListening(false);
      stopMicVisualizer();
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
    void startMicVisualizer();
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
              <div className="jarvis-panel-head-title">
                <div ref={speakVizRef} className="jarvis-viz jarvis-viz--speak" title="Jarvis hablando" />
                <div>
                  <div className="jarvis-panel-title">Jarvis</div>
                  <div className="jarvis-panel-sub">
                    {activeProjectName ? `Contexto: ${activeProjectName}` : 'Sin cliente activo'}
                  </div>
                </div>
              </div>
              <div className="jarvis-panel-head-actions">
                <button
                  type="button"
                  className={`jarvis-voice-toggle${voiceOutputEnabled ? ' active' : ''}`}
                  onClick={() => setVoiceOutputEnabled((v) => !v)}
                  title={voiceOutputEnabled ? 'Silenciar voz de Jarvis' : 'Activar voz de Jarvis'}
                >
                  {voiceOutputEnabled ? '🔊' : '🔇'}
                </button>
                <button type="button" className="jarvis-close" onClick={() => setOpen(false)}>&times;</button>
              </div>
            </div>

            <div className="jarvis-history">
              {messages.length === 0 && (
                <p className="jarvis-empty">Preguntale a Jarvis por el estado real de este cliente — SEO, email, redes.</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`jarvis-msg jarvis-msg--${m.role}`}>
                  <div className="jarvis-msg-text">{m.text}</div>
                  {m.navigatedTo && (
                    <div className="jarvis-nav-note">→ Te llevo a {DESTINATION_LABELS[m.navigatedTo] || m.navigatedTo}</div>
                  )}
                  {m.role === 'jarvis' && m.voiceState === 'loading' && (
                    <div className="jarvis-voice-status">🔊 generando audio…</div>
                  )}
                  {m.role === 'jarvis' && m.voiceState === 'error' && (
                    <div className="jarvis-voice-status jarvis-voice-status--error">🔇 voz no disponible: {m.voiceError}</div>
                  )}
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
              {speechSupported && (
                <button
                  type="button"
                  ref={micVizRef}
                  className={`jarvis-mic jarvis-viz${listening ? ' listening' : ''}`}
                  onClick={toggleListening}
                  disabled={!activeProjectId || processing}
                  title={listening ? 'Escuchando… click para detener' : 'Hablarle a Jarvis'}
                >
                  {listening ? '● ' : '🎙'}
                </button>
              )}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!activeProjectId || processing}
                placeholder={
                  !activeProjectId
                    ? 'Elegí un cliente activo primero'
                    : listening
                    ? 'Escuchando…'
                    : 'Preguntale algo a Jarvis…'
                }
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
