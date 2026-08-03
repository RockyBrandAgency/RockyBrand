import { useState } from 'react';
import { useCrmData } from '../../context/CrmDataContext';
import { managementSegments, contactStatusLabel } from './crmUtils';
import ImportarCsv from './ImportarCsv';

export default function Audiencias() {
  const { contacts, refetch, scopedAction } = useCrmData();
  const segments = managementSegments(contacts);
  const [activeSegment, setActiveSegment] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tags, setTags] = useState('');

  const seg = segments.find((s) => s.key === activeSegment) || segments[0];
  const list = contacts
    .filter(seg.filter)
    .filter((c) => {
      const q = search.toLowerCase();
      return !q || (c.email || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q);
    });

  async function handleDelete(email: string) {
    if (!confirm(`¿Eliminar a ${email} de la audiencia?`)) return;
    await scopedAction('delete_email_contact', { email });
    await refetch();
  }

  async function handleSave() {
    if (!email.trim() || !email.includes('@')) {
      alert('Ingresa un email válido.');
      return;
    }
    await scopedAction('save_email_contact', {
      name: name.trim(),
      email: email.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      status: 'subscribed',
    });
    setName('');
    setEmail('');
    setTags('');
    setShowForm(false);
    await refetch();
  }

  return (
    <div className="aud-layout">
      <div className="card" style={{ padding: '8px 0' }}>
        {segments.map((s) => (
          <div
            key={s.key}
            className={`seg-item${s.key === activeSegment ? ' active' : ''}`}
            onClick={() => setActiveSegment(s.key)}
          >
            <span>{s.label}</span>
            <span className="seg-count tabular">{contacts.filter(s.filter).length}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="crm-toolbar">
          <input className="crm-search" placeholder="Buscar contacto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {/* Las dos vias de alta, una al lado de la otra: a mano para un
              contacto suelto, archivo para una base entera. Mismas dos
              opciones que tiene el cliente en su propio panel. */}
          <button className="btn btn-ghost btn-sm" onClick={() => { setShowImport((v) => !v); setShowForm(false); }}>
            ⇪ Importar CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowForm((v) => !v); setShowImport(false); }}>
            + Agregar contacto
          </button>
        </div>

        {showImport && <ImportarCsv onImportado={() => { setShowImport(false); refetch(); }} />}

        {showForm && (
          <div className="card form-section" style={{ maxWidth: 'none' }}>
            <div className="crm-field">
              <label>Nombre</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="crm-field">
              <label>Email</label>
              <input placeholder="nombre@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="crm-field">
              <label>Tags (separados por coma)</label>
              <input placeholder="cliente anterior, VIP" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="send-actions">
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
                Guardar contacto
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Tags</th>
                <th>Alta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.email}>
                  <td>
                    <div className="cell-name">{c.name || '(sin nombre)'}</div>
                    <div className="cell-sub">{c.email}</div>
                  </td>
                  <td>
                    <span className={`pill ${c.status}`}>
                      <span className="pill-dot" />
                      {contactStatusLabel(c.status)}
                    </span>
                  </td>
                  <td>
                    {(c.tags || []).map((t) => (
                      <span className="tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </td>
                  <td className="tabular">{c.created_at || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <span className="icon-btn danger" title="Eliminar" onClick={() => handleDelete(c.email)}>
                        🗑
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="empty-state">Sin contactos en este segmento todavía.</div>}
        </div>
      </div>
    </div>
  );
}
