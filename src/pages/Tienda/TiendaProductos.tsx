import { useState } from 'react';
import { useTiendaData } from '../../context/TiendaDataContext';

function money(clp: number): string {
  return clp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

type Campo = 'precio_clp' | 'stock';

export default function TiendaProductos() {
  const { productos, loading, error, actualizarProducto } = useTiendaData();
  const [editando, setEditando] = useState<{ sku: string; campo: Campo } | null>(null);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  function empezarEdicion(sku: string, campo: Campo, actual: number) {
    setEditando({ sku, campo });
    setValor(String(actual));
    setSaveError('');
  }

  async function guardar() {
    if (!editando) return;
    const numero = Math.round(Number(valor.replace(',', '.')));
    if (!Number.isFinite(numero) || numero < 0) {
      setSaveError('Ingresa un número válido.');
      return;
    }
    setGuardando(editando.sku);
    setSaveError('');
    try {
      await actualizarProducto(editando.sku, { [editando.campo]: numero });
      setEditando(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(null);
    }
  }

  if (loading && !productos.length) return <div className="empty-state">Cargando…</div>;
  if (error) return <div className="empty-state">{error}</div>;

  return (
    <div>
      <div className="section-sub" style={{ marginBottom: 14 }}>
        Precio y stock se editan acá — reemplaza a <code>store_seed_products.py</code> como forma
        normal de actualizar el catálogo. El sitio de la tienda lee estos valores en vivo (con
        hasta 1 hora de caché).
      </div>
      {saveError && (
        <div className="footnote" style={{ color: 'var(--err)', marginBottom: 10 }}>
          {saveError}
        </div>
      )}
      {!productos.length ? (
        <div className="empty-state">Sin productos cargados todavía.</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Modelo</th>
                <th>SKU</th>
                <th className="tabular">Precio</th>
                <th className="tabular">Stock</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.sku}>
                  <td>
                    <div className="cell-name">{p.nombre}</div>
                    {p.familia && <div className="cell-sub">{p.familia}</div>}
                  </td>
                  <td className="cell-sub">{p.sku}</td>
                  <td className="tabular">
                    {editando?.sku === p.sku && editando.campo === 'precio_clp' ? (
                      <span className="costos-inline-edit">
                        <input
                          autoFocus
                          value={valor}
                          inputMode="numeric"
                          onChange={(e) => setValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void guardar();
                            if (e.key === 'Escape') setEditando(null);
                          }}
                        />
                        <button className="btn btn-primary btn-sm" disabled={guardando === p.sku} onClick={() => void guardar()}>
                          OK
                        </button>
                      </span>
                    ) : (
                      <button className="costos-editable" onClick={() => empezarEdicion(p.sku, 'precio_clp', p.precio_clp)}>
                        {money(p.precio_clp)}
                      </button>
                    )}
                  </td>
                  <td className="tabular">
                    {editando?.sku === p.sku && editando.campo === 'stock' ? (
                      <span className="costos-inline-edit">
                        <input
                          autoFocus
                          value={valor}
                          inputMode="numeric"
                          onChange={(e) => setValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void guardar();
                            if (e.key === 'Escape') setEditando(null);
                          }}
                        />
                        <button className="btn btn-primary btn-sm" disabled={guardando === p.sku} onClick={() => void guardar()}>
                          OK
                        </button>
                      </span>
                    ) : (
                      <button className="costos-editable" onClick={() => empezarEdicion(p.sku, 'stock', p.stock)}>
                        <span className={p.stock <= 2 ? 'costos-mal' : undefined}>{p.stock}</span>
                      </button>
                    )}
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
