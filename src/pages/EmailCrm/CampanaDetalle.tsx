import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrmData } from '../../context/CrmDataContext';
import { formatWhen } from '../../api';
import { statusLabel } from './crmUtils';
import type { CampaignRecipient, EmailCampaign } from '../../types';

/** Fecha y hora completas. `formatWhen` corta el año, y en una campaña
 *  enviada lo primero que se pregunta es "¿cuándo salió exactamente?". */
function formatWhenFull(iso?: string): string {
  if (!iso) return '';
  try {
    const withZone = /[zZ+-]\d{0,2}:?\d{0,2}$/.test(iso) ? iso : iso + 'Z';
    const d = new Date(withZone);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-CL', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** A qué base se mandó, en palabras. El segmento se guarda como
 *  `{type: 'tag', value: 'x'}`, que no significa nada para quien lee. */
function describirBase(segment?: { type: string; value?: string }): string {
  if (!segment || segment.type === 'all') return 'Toda la base suscrita';
  if (segment.type === 'tag') return `Contactos con la etiqueta "${segment.value}"`;
  return segment.value || segment.type;
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ minWidth: 150, opacity: 0.62, fontSize: 13 }}>{etiqueta}</div>
      <div style={{ flex: 1, fontSize: 14 }}>{children}</div>
    </div>
  );
}

export default function CampanaDetalle() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { scopedAction } = useCrmData();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verPrevia, setVerPrevia] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    scopedAction<{ campaign: EmailCampaign; recipients: CampaignRecipient[] }>('get_email_campaign_detail', { campaign_id: campaignId })
      .then((data) => {
        if (cancelled) return;
        setCampaign(data.campaign);
        setRecipients(data.recipients || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la campaña');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, scopedAction]);

  if (loading) return <div className="empty-state">Cargando...</div>;
  if (error || !campaign) return <div className="empty-state">{error || 'Campaña no encontrada'}</div>;

  const s = campaign.stats || { enviados: 0, aperturas: 0, clics: 0, rebotes: 0, quejas: 0 };
  const pct = (n: number) => (s.enviados ? ((n / s.enviados) * 100).toFixed(1) : '0.0');
  const clickRate = pct(s.clics);
  const openRate = pct(s.aperturas);
  const bounceRate = pct(s.rebotes);
  const enviadoEl = campaign.sent_at || campaign.scheduled_at || '';

  return (
    <div>
      <button className="back-link" onClick={() => navigate('../campanas')}>
        &larr; Volver a campañas
      </button>
      <div className="eyebrow">Campaña</div>
      <div className="page-title">{campaign.name || 'Sin nombre'}</div>
      <div className="page-sub">
        {campaign.subject} ·{' '}
        <span className={`pill ${campaign.status}`}>
          <span className="pill-dot" />
          {statusLabel(campaign.status)}
        </span>
      </div>

      {/* Ficha del envío: lo que hay que poder responder sin salir de acá. */}
      <div className="card" style={{ padding: '18px 20px', marginTop: 18 }}>
        <div className="desc-label" style={{ marginBottom: 6 }}>Detalle del envío</div>
        <Fila etiqueta="Asunto">{campaign.subject || '—'}</Fila>
        <Fila etiqueta={campaign.status === 'sent' ? 'Enviada el' : 'Programada para'}>
          {enviadoEl ? formatWhenFull(enviadoEl) : 'Todavía no se ha enviado'}
        </Fila>
        <Fila etiqueta="Base">
          {describirBase(campaign.segment)}
          {s.enviados ? ` · ${s.enviados} destinatarios` : ''}
        </Fila>
        <Fila etiqueta="Creada el">{formatWhenFull(campaign.created_at) || '—'}</Fila>
        <div style={{ display: 'flex', gap: 16, padding: '9px 0' }}>
          <div style={{ minWidth: 150, opacity: 0.62, fontSize: 13 }}>Contenido</div>
          <div style={{ flex: 1 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setVerPrevia((v) => !v)}
              disabled={!campaign.html_body}
            >
              {verPrevia ? 'Ocultar vista previa' : 'Ver vista previa del email'}
            </button>
            {!campaign.html_body && (
              <span style={{ marginLeft: 10, opacity: 0.6, fontSize: 13 }}>
                Esta campaña no tiene contenido guardado.
              </span>
            )}
          </div>
        </div>

        {verPrevia && campaign.html_body && (
          <div style={{ marginTop: 12 }}>
            <div style={{ opacity: 0.62, fontSize: 12, marginBottom: 8 }}>
              Es el correo exacto que se envió, tal como salió de la plataforma.
            </div>
            {/* sandbox vacío: el HTML de una campaña es contenido, no código.
                Sin esto, un template pegado desde afuera correría scripts
                dentro del panel. */}
            <iframe
              title="Vista previa del email"
              srcDoc={campaign.html_body}
              sandbox=""
              style={{
                width: '100%', height: 620, border: '1px solid var(--line)',
                borderRadius: 8, background: '#fff',
              }}
            />
          </div>
        )}
      </div>

      <div className="mini-dash" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="mini-card c-social">
          <div className="mini-card-icon">🖱</div>
          <div className="mini-card-label">Clics (métrica principal)</div>
          <div className="mini-card-value tabular">{clickRate}%</div>
          <div className="mini-card-sub">{s.clics} de {s.enviados} enviados</div>
        </div>
        <div className="mini-card c-opens">
          <div className="mini-card-icon">👁</div>
          <div className="mini-card-label">Aperturas</div>
          <div className="mini-card-value tabular">{openRate}%</div>
          <div className="mini-card-sub">Referencial — Apple Mail infla este número automáticamente</div>
        </div>
        <div className="mini-card c-email">
          <div className="mini-card-icon">✉</div>
          <div className="mini-card-label">Enviados</div>
          <div className="mini-card-value tabular">{s.enviados}</div>
        </div>
        <div className="mini-card c-seo">
          <div className="mini-card-icon">⚠</div>
          <div className="mini-card-label">Rebotes</div>
          <div className="mini-card-value tabular">{bounceRate}%</div>
          <div className="mini-card-sub">{s.rebotes} de {s.enviados} enviados</div>
        </div>
      </div>

      <div className="card" style={{ padding: '18px 20px', marginTop: 18, overflowX: 'auto' }}>
        <div className="desc-label" style={{ marginBottom: 12 }}>
          Destinatarios ({recipients.length})
        </div>
        {recipients.length ? (
          <table>
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Enviado</th>
                <th>Apertura</th>
                <th>Clic</th>
                <th>Enlaces</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {recipients
                .slice()
                .sort((a, b) => (a.contact_email || '').localeCompare(b.contact_email || ''))
                .map((r) => (
                  <tr key={r.contact_email}>
                    <td className="cell-name">{r.contact_email || '—'}</td>
                    <td className="tabular cell-fecha">{formatWhen(r.sent_at) || '—'}</td>
                    <td className="tabular cell-fecha">{r.opened ? formatWhen(r.opened_at) || 'Sí' : '—'}</td>
                    <td className="tabular cell-fecha">{r.clicked ? formatWhen(r.clicked_at) || 'Sí' : '—'}</td>
                    <td className="cell-enlace">
                      {r.clicked_links?.length ? (
                        <span title={r.clicked_links.join('\n')}>
                          {r.clicked_links.length === 1
                            ? r.clicked_links[0]
                            : `${r.clicked_links.length} enlaces`}
                        </span>
                      ) : '—'}
                    </td>
                    {/* Una queja de spam y un rebote no son lo mismo y no pueden leerse
                        igual: la queja es lo unico que Gmail castiga de verdad.
                        Mismas palabras que el panel del cliente. */}
                    <td className="tabular cell-fecha">
                      {r.complained ? 'Marcó spam' : r.bounced ? 'Rebotó' : 'Entregado'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            {campaign.status === 'sent'
              ? 'Sin datos de destinatarios individuales todavía — pueden tardar unos minutos en llegar los eventos de SES.'
              : 'Esta campaña todavía no se ha enviado.'}
          </div>
        )}
      </div>
    </div>
  );
}
