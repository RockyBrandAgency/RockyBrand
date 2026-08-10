import { useState, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import { usePmsData } from '../../context/PmsDataContext';
import { createAddon } from '../../pmsApi';

export default function NewAddonModal({ bookingId, onClose, onCreated }: { bookingId: string; onClose: () => void; onCreated: () => void }) {
  const { lodgeId } = usePmsData();
  const [serviceName, setServiceName] = useState('');
  const [operationBase, setOperationBase] = useState('');
  const [guidingZone, setGuidingZone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [guideAssigned, setGuideAssigned] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = serviceName.trim() && operationBase.trim() && guidingZone.trim() && date;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setError('');
    try {
      await createAddon(lodgeId, bookingId, {
        ServiceName: serviceName.trim(),
        ...(price && { Price: Number(price) }),
        Logistics: {
          OperationBase: operationBase.trim(),
          GuidingZone: guidingZone.trim(),
          Date: date,
          ...(time && { Time: time }),
          ...(guideAssigned.trim() && { GuideAssigned: guideAssigned.trim() }),
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la experiencia');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Agregar experiencia"
      sub="Base de operación y zona de guiado son campos separados a propósito: uno es de dónde sale la logística, el otro hacia dónde va la excursión."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="crm-field">
          <label>Servicio</label>
          <input autoFocus value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Ej. Pesca con mosca día completo" />
        </div>
        <div className="pms-route-field-pair">
          <div className="crm-field">
            <label>Base de operación</label>
            <input value={operationBase} onChange={(e) => setOperationBase(e.target.value)} placeholder="Ej. Coyhaique" />
          </div>
          <div className="pms-route-field-arrow">→</div>
          <div className="crm-field">
            <label>Zona de guiado</label>
            <input value={guidingZone} onChange={(e) => setGuidingZone(e.target.value)} placeholder="Ej. Cerro Castillo" />
          </div>
        </div>
        <div className="modal-row-3">
          <div className="crm-field">
            <label>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="crm-field">
            <label>Hora (opcional)</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="crm-field">
            <label>Guía asignado (opcional)</label>
            <input value={guideAssigned} onChange={(e) => setGuideAssigned(e.target.value)} placeholder="Nombre del guía" />
          </div>
        </div>
        <div className="crm-field">
          <label>Precio (opcional)</label>
          <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Dejar vacío si va incluido en el paquete" />
        </div>
        {error && <div className="login-error" style={{ minHeight: 'auto' }}>{error}</div>}
        <div className="send-actions" style={{ marginTop: 18 }}>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || saving}>
            {saving ? 'Guardando…' : 'Agregar experiencia'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
