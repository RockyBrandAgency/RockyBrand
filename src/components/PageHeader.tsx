import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { PROJECT_LOGO } from '../constants';
import { formatTodayEs, getClientDashboardUrl } from '../api';
import type { HealthBadge, HomeSummary } from '../types';
import Modal from './Modal';

type SystemHealth = HomeSummary['system_health'];

const LABELS: Record<keyof SystemHealth, string> = {
  dave: 'Dave (Content Strategist)',
  jimi: 'Jimi (Art Director)',
  gsc_sync: 'GSC Sync',
  meta_api: 'Meta API',
};

// Link real solo para la señal de Meta - el resto no tiene un lugar
// externo específico donde "solucionarse" (son estados de agentes propios).
function linkFor(entryKey: keyof SystemHealth): string | null {
  return entryKey === 'meta_api' ? 'https://developers.facebook.com/tools/explorer/' : null;
}

function NotificationPanel({ systemHealth, onClose }: { systemHealth: SystemHealth; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { opacity: 0, y: -8, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' });
    });
    return () => ctx.revert();
  }, []);

  const entries = (Object.keys(systemHealth) as (keyof SystemHealth)[]).filter(
    (k) => systemHealth[k].tone !== 'ok' && systemHealth[k].tone !== 'off'
  );

  return (
    <div className="notif-panel" ref={panelRef}>
      <div className="notif-panel-title">Notificaciones</div>
      {entries.length === 0 ? (
        <div className="notif-panel-empty">Sin notificaciones — todo al día.</div>
      ) : (
        entries.map((k) => {
          const entry = systemHealth[k];
          const link = linkFor(k);
          return (
            <div className={`notif-item notif-item-${entry.tone}`} key={k}>
              <span className={`sys-dot sys-dot-${entry.tone}`} />
              <div className="notif-item-body">
                <div className="notif-item-title">{LABELS[k]}</div>
                <div className="notif-item-detail">{entry.detail}</div>
                {link && (
                  <a href={link} target="_blank" rel="noreferrer" onClick={onClose}>
                    Ir a solucionarlo →
                  </a>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function AttentionModal({ systemHealth, onClose }: { systemHealth: SystemHealth; onClose: () => void }) {
  const keys = Object.keys(systemHealth) as (keyof SystemHealth)[];
  return (
    <Modal title="Estado del sistema" sub="Detalle real de las 4 señales monitoreadas para este cliente" onClose={onClose}>
      <div className="attention-modal-list">
        {keys.map((k) => {
          const entry = systemHealth[k];
          const link = linkFor(k);
          return (
            <div className={`notif-item notif-item-${entry.tone}`} key={k}>
              <span className={`sys-dot sys-dot-${entry.tone}`} />
              <div className="notif-item-body">
                <div className="notif-item-title">
                  {LABELS[k]} <span className={`sys-mini-value sys-mini-${entry.tone}`}>{entry.label}</span>
                </div>
                <div className="notif-item-detail">{entry.detail}</div>
                {link && (
                  <a href={link} target="_blank" rel="noreferrer">
                    Ir a solucionarlo →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export default function PageHeader({
  projectId,
  projectName,
  worstTone,
  systemHealth,
  hasAlert,
}: {
  projectId: string | null;
  projectName: string;
  worstTone: HealthBadge['tone'] | null;
  systemHealth: SystemHealth | null;
  hasAlert: boolean;
}) {
  const [bellOpen, setBellOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const bellWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bellOpen) return;
    function onDocClick(e: MouseEvent) {
      if (bellWrapRef.current && !bellWrapRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [bellOpen]);

  return (
    <div className="page-header">
      <div className="page-header-logo-wrap">
        {projectId && PROJECT_LOGO[projectId] ? (
          <img className="page-header-logo" src={PROJECT_LOGO[projectId]} alt={projectName} />
        ) : (
          <div className="page-header-logo page-header-logo-fallback">{projectName.slice(0, 2).toUpperCase()}</div>
        )}
      </div>
      <div className="page-header-name">
        <div className="page-header-title">{projectName}</div>
        <div className="page-header-date">{formatTodayEs()}</div>
      </div>
      <div className="page-header-right">
        {projectId && (
          <a
            className="btn btn-ghost btn-sm"
            href={getClientDashboardUrl(projectId)}
            target="_blank"
            rel="noreferrer"
            title="Abre el panel propio del cliente en otra pestaña (necesita su propio login)"
          >
            Ver panel del cliente ↗
          </a>
        )}
        {worstTone && systemHealth && (
          <button type="button" className={`sys-pill sys-pill-${worstTone} sys-pill-clickable`} onClick={() => setModalOpen(true)}>
            <span className={`sys-dot sys-dot-${worstTone}`} />
            {worstTone === 'ok' ? 'Operativo' : worstTone === 'warn' ? 'Atención' : worstTone === 'error' ? 'Con errores' : 'Sin datos'}
          </button>
        )}
        <div className="page-header-bell-wrap" ref={bellWrapRef}>
          <button
            type="button"
            className={`page-header-bell${hasAlert ? ' page-header-bell-active' : ''}`}
            onClick={() => setBellOpen((v) => !v)}
            aria-label="Notificaciones"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {hasAlert && <span className="page-header-bell-dot" />}
          </button>
          {bellOpen && systemHealth && <NotificationPanel systemHealth={systemHealth} onClose={() => setBellOpen(false)} />}
        </div>
      </div>

      {modalOpen && systemHealth && <AttentionModal systemHealth={systemHealth} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
