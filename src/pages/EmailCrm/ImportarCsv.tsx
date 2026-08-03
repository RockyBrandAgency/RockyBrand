import { useState } from 'react';
import { useCrmData } from '../../context/CrmDataContext';

// Carga de una base de contactos desde CSV, en el panel de staff.
//
// Es la misma operación que ofrece el panel del cliente y corre sobre el
// MISMO backend compartido (contact_import): no puede pasar que importar
// desde acá deje los contactos suscritos y desde allá pendientes.
//
// El flujo es a propósito en dos pasos: primero se muestra qué pasaría, y
// recién después se escribe. Importar una base sucia es la principal fuente
// de rebotes duros, y la cuenta de envío es COMPARTIDA entre todos los
// clientes: una base mala de uno le sube el rebote a los demás y puede
// terminar en una suspensión que afecta a gente que no hizo nada.

interface Informe {
  leidas: number;
  validas: number;
  descartadas: number;
  email_invalido: string[];
  duplicadas_en_archivo: string[];
  sin_email: number;
  truncado: boolean;
}

interface Resultado {
  vista_previa?: boolean;
  importados?: number;
  ya_existian?: number;
  nota?: string;
  muestra?: { email: string; name: string; tags: string[] }[];
  informe: Informe;
}

export default function ImportarCsv({ onImportado }: { onImportado: () => void }) {
  const { scopedAction } = useCrmData();
  const [csv, setCsv] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Resultado | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function leerArchivo(file: File) {
    setError(null);
    setPrevia(null);
    setResultado(null);
    setNombreArchivo(file.name);
    const lector = new FileReader();
    lector.onload = () => setCsv(String(lector.result ?? ''));
    lector.onerror = () => setError('No se pudo leer el archivo.');
    lector.readAsText(file, 'utf-8');
  }

  async function ejecutar(vistaPrevia: boolean) {
    if (!csv.trim()) {
      setError('Primero elige un archivo.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const r = await scopedAction<Resultado>('import_email_contacts', { csv, vista_previa: vistaPrevia });
      if (vistaPrevia) {
        setPrevia(r);
        setResultado(null);
      } else {
        setResultado(r);
        setPrevia(null);
        onImportado();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar el archivo.');
    } finally {
      setCargando(false);
    }
  }

  const inf = (previa ?? resultado)?.informe;

  return (
    <div className="card form-section" style={{ maxWidth: 'none' }}>
      <div className="desc-label">Importar desde archivo</div>
      <p className="crm-hint">
        La primera fila tiene que ser la cabecera e incluir una columna de correo (<code>email</code> o{' '}
        <code>correo</code>). Opcionales: <code>nombre</code> y <code>etiquetas</code>. Sirve separado por comas o por
        punto y coma. Si tienes un Excel, guárdalo como CSV antes de subirlo.
      </p>

      <div className="crm-import-actions">
        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
          Elegir archivo CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) leerArchivo(f);
            }}
          />
        </label>
        {nombreArchivo && <span className="cell-sub">{nombreArchivo}</span>}

        {csv.trim() && !resultado && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => ejecutar(true)} disabled={cargando}>
              {cargando ? 'Revisando…' : 'Revisar antes de importar'}
            </button>
            {previa && previa.informe.validas > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => ejecutar(false)} disabled={cargando}>
                Importar {previa.informe.validas}
              </button>
            )}
          </>
        )}
      </div>

      {error && <div className="crm-aviso critico">{error}</div>}

      {resultado && (
        <div className="crm-aviso ok">
          <strong>Importados {resultado.importados}.</strong>{' '}
          {resultado.ya_existian ? `${resultado.ya_existian} ya estaban en la lista. ` : ''}
          {resultado.nota}
        </div>
      )}

      {inf && (
        <>
          <div className="crm-import-cifras">
            <div>
              <div className="mini-card-label">Filas leídas</div>
              <div className="crm-import-num tabular">{inf.leidas}</div>
            </div>
            <div>
              <div className="mini-card-label">Válidas</div>
              <div className="crm-import-num tabular ok">{inf.validas}</div>
            </div>
            <div>
              <div className="mini-card-label">Descartadas</div>
              <div className={`crm-import-num tabular${inf.descartadas > 0 ? ' alerta' : ''}`}>{inf.descartadas}</div>
            </div>
          </div>

          {inf.truncado && (
            <div className="crm-aviso alerta">
              El archivo es más grande que el máximo permitido y se leyó solo una parte. Divídelo y súbelo por tandas.
            </div>
          )}

          {/* Lo descartado se muestra con el motivo, nunca en silencio: casi
              siempre es una columna mal exportada, y verlo es lo único que
              permite corregirla. */}
          {inf.descartadas > 0 && (
            <div className="crm-import-descartes">
              {inf.email_invalido.length > 0 && (
                <div>
                  <strong>Correos mal escritos ({inf.email_invalido.length}):</strong>{' '}
                  {inf.email_invalido.slice(0, 8).join(', ')}
                  {inf.email_invalido.length > 8 ? '…' : ''}
                </div>
              )}
              {inf.duplicadas_en_archivo.length > 0 && (
                <div>
                  <strong>Repetidos dentro del archivo ({inf.duplicadas_en_archivo.length}):</strong>{' '}
                  {inf.duplicadas_en_archivo.slice(0, 8).join(', ')}
                  {inf.duplicadas_en_archivo.length > 8 ? '…' : ''}
                </div>
              )}
              {inf.sin_email > 0 && (
                <div>
                  <strong>Filas sin correo:</strong> {inf.sin_email}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {previa?.muestra && previa.muestra.length > 0 && (
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          <div className="desc-label">Así se van a importar</div>
          <table>
            <thead>
              <tr>
                <th>Correo</th>
                <th>Nombre</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {previa.muestra.slice(0, 10).map((m) => (
                <tr key={m.email}>
                  <td>{m.email}</td>
                  <td className="cell-sub">{m.name || '—'}</td>
                  <td>
                    {m.tags.length
                      ? m.tags.map((t) => (
                          <span className="tag" key={t}>
                            {t}
                          </span>
                        ))
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
